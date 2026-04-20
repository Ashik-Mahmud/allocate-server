import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Bookings, BookingStatus, Prisma, Role, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateBookingDto } from '../dto/bookings.dto';
import GLOBAL_CONFIG from 'src/shared/constant/global.constant';
import { AllBookingsQueryDto, MyBookingsHistoryQueryDto } from '../dto/booking-filter.dto';
import { BookingCalendarData } from '../interfaces/booking.interface';


@Injectable()
export class BookingsService {

    constructor(private prisma: PrismaService) { }

    // Create a booking for a resource
    async createBooking(currentUser: User, createBookingDto: CreateBookingDto) {
        const { user_id, resource_id, start_time, end_time, notes, metadata } = createBookingDto;

        // basic time variables for later use
        const startTime = new Date(start_time);
        const endTime = new Date(end_time);
        const now = new Date();


        // If the start time is in the past or end time is before start time, throw an error
        if (startTime < now || endTime <= startTime) {
            throw new BadRequestException('Invalid time slot. Start time must be in the future.');
        }

        return await this.prisma.$transaction(async (tx) => {

            // Check if the resource exists and belongs to an active organization
            const resource = await tx.resources.findUnique({
                where: { id: resource_id, },
                include: {
                    organization: true,
                    resourcesRules: true
                },
            });

            if (!resource || !resource.organization.is_active) {
                throw new NotFoundException('Resource is not available or organization is inactive');
            }

            if (resource.org_id !== currentUser.org_id) {
                throw new BadRequestException('Resource does not belong to your organization');
            }

            if (resource.is_maintenance) {
                throw new BadRequestException('Resource is under maintenance');
            }

            // Validate booking against resource rules (if any)
            const rules = resource?.resourcesRules[0];
            const hoursDifference = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);


            // check if the booking duration should be greater than 0 and less than max allowed hours (if set)
            if (hoursDifference <= 0) {
                throw new BadRequestException('Invalid time slot. End time must be after start time.');
            }

            if (rules) {
                // check if weekend is allow 
                const bookingDay = startTime.toLocaleDateString('en-US', { weekday: 'long' });
                const isWeekend = GLOBAL_CONFIG.WEEKEND_DAYS.includes(bookingDay);
                if (isWeekend && !rules.is_weekend_allowed) {
                    throw new BadRequestException('Booking is not allowed on weekends');
                }

                // check if booking is only allowed on specific days
                const availableDays = rules.availableDays as string[];
                if (availableDays && availableDays?.length > 0) {
                    if (!availableDays.includes(bookingDay)) {
                        throw new BadRequestException(`Resource is only available on: ${availableDays.join(', ')}`);
                    }
                }

                // check if the booking duration exceeds maximum allowed hours
                if (rules.max_booking_hours && hoursDifference > rules.max_booking_hours) {
                    throw new BadRequestException(`Maximum booking allowed is ${rules.max_booking_hours} hours`);
                }

                // Check if the booking duration exceeds maximum allowed hours
                if (rules.max_booking_hours && hoursDifference > rules.max_booking_hours) {
                    throw new BadRequestException(`Maximum booking allowed is ${rules.max_booking_hours} hours`);
                }

                const minLeadTimeMs = (rules.min_lead_time || 0) * 60 * 60 * 1000;
                if (startTime.getTime() < now.getTime() + minLeadTimeMs) {
                    throw new BadRequestException(`Must book at least ${rules.min_lead_time} hours in advance`);
                }
            }

            // Check for overlapping bookings considering buffer time
            const bufferMs = (rules?.buffer_time || 0) * 60 * 60 * 1000;

            const overlappingBooking = await tx.bookings.findFirst({
                where: {
                    resource_id,
                    status: { in: ['CONFIRMED', 'PENDING'] },
                    deletedAt: null,
                    AND: [
                        { start_time: { lt: new Date(endTime.getTime() + bufferMs) } },
                        { end_time: { gt: new Date(startTime.getTime() - bufferMs) } }
                    ]
                }
            });

            if (overlappingBooking) {
                throw new BadRequestException('Resource is already booked or in buffer period');
            }

            // Credits calculation and pending credits check
            const hourlyRate = Number(resource?.hourly_rate || 0);
            const totalCost = hoursDifference * hourlyRate;

            const user = await tx.user.findUnique({ where: { id: user_id } });
            if (!user) throw new NotFoundException('User not found');

            // Check pending bookings for the user to calculate pending credits
            const pendingBookings = await tx.bookings.aggregate({
                where: { user_id, status: 'PENDING', deletedAt: null },
                _sum: { total_cost: true }
            });
            const pendingCredits = pendingBookings._sum.total_cost || 0;
            const bookingStatus = (currentUser.role === 'ORG_ADMIN') ? 'CONFIRMED' : 'PENDING';            // Check if user is STAFF then credits will be deducted from personal credits otherwise from organization credits

            const userTotalRequired = totalCost + pendingCredits;
            if (Number(user.personal_credits || 0) < userTotalRequired) {
                throw new BadRequestException('Insufficient personal credits');
            }

            // Create the booking
            const booking = await tx.bookings.create({
                data: {
                    user_id,
                    resource_id,
                    org_id: currentUser.org_id,
                    start_time: startTime,
                    end_time: endTime,
                    total_cost: totalCost,
                    notes,
                    metadata,
                    created_by: currentUser.id,
                    status: bookingStatus,
                },
            });

            // Deduct credits from user
            if (bookingStatus === 'CONFIRMED') {
                if (Number(user.personal_credits || 0) < totalCost) {
                    throw new BadRequestException('Not enough credits to confirm this booking');
                }
                await tx.user.update({
                    where: { id: user_id },
                    data: {
                        personal_credits: {
                            decrement: totalCost,
                        },
                    },
                });
            }

            return booking;
        });

    }


    // Update booking status (e.g. cancel a booking)
    async updateBookingStatus(user: User, bookingId: string, status: BookingStatus): Promise<Bookings | void> {

        const booking = await this.prisma.bookings.findUnique({
            where: { id: bookingId, deletedAt: null },
            include: { user: true }
        });

        if (!booking) throw new NotFoundException('Booking not found');

        if (user.role === Role.STAFF && booking.user_id !== user.id) {
            throw new BadRequestException('You can only update your own bookings');
        }
        return await this.prisma.$transaction(async (tx) => {
            let finalStatus = status;
            // If booking is pending and org admin is confirming it, then we will check if user has enough credits to confirm this booking and then deduct the credits from user
            if (booking.status === BookingStatus.PENDING && status === BookingStatus.CONFIRMED) {
                if (user?.role !== Role.ORG_ADMIN) {
                    throw new BadRequestException('Only organization admins can confirm bookings');
                }

                // Check if user has enough credits to confirm this booking
                if (Number(booking.user.personal_credits || 0) < Number(booking.total_cost || 0) || Number(booking.user.personal_credits || 0) < 0) {
                    throw new BadRequestException('Not enough credits to confirm this booking');
                }

                // Deduct credits from user
                await this.prisma.user.update({
                    where: { id: booking.user_id },
                    data: {
                        personal_credits: {
                            decrement: booking?.total_cost || 0,
                        },
                    },
                });
            }

            if (booking.status === BookingStatus.CONFIRMED && status === BookingStatus.CANCELLED) {
                const now = new Date();
                const startTime = new Date(booking.start_time);
                const timeDifference = startTime.getTime() - now.getTime();
                const refundPolicyMs = Number(GLOBAL_CONFIG.REFUND_POLICY.FULL_REFUND_IF_CANCELLED_WITHIN) * 60 * 60 * 1000;

                let refundMultiplier = 1; // Default Full Refund for ADMIN REJECT

                if (status === BookingStatus.CANCELLED && timeDifference < refundPolicyMs) {
                    refundMultiplier = GLOBAL_CONFIG.REFUND_POLICY.PARTIAL_REFUND_IF_CANCELLED_WITHIN;
                }

                const refundAmount = (Number(booking.total_cost) || 0) * refundMultiplier;

                if (refundAmount > 0) {
                    await tx.user.update({
                        where: { id: booking.user_id },
                        data: { personal_credits: { increment: refundAmount } }
                    });
                }
            }

            return await tx.bookings.update({
                where: { id: bookingId },
                data: {
                    status: finalStatus,
                },
            });
        });

    }


    // Get available slots for a resource within a date 
    async getAvailableSlotsByResource(resourceId: string, date: string) {
        const resource = await this.prisma.resources.findUnique({
            where: { id: resourceId },
            include: { resourcesRules: true }
        });

        if (!resource) {
            throw new NotFoundException('Resource not found');
        }

        const rules = resource.resourcesRules[0];

        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(date));
        const availableDays = (rules?.availableDays as string[]) || [];
        // check if resource is available on the requested day
        if (availableDays?.length > 0 && !availableDays?.includes(dayName)) {
            throw new BadRequestException(`Resource is not available on ${dayName}`);
        }

        // opening and closing hours
        const workStart = new Date(`${date}T${String(rules.opening_hours || 9).padStart(2, '0')}:00:00.000Z`);
        const workEnd = new Date(`${date}T${String(rules.closing_hours || 18).padStart(2, '0')}:00:00.000Z`);

        // slot duration and buffer time in milliseconds
        const slotDurationMs = (rules.slot_duration_min || 30) * 60 * 1000;
        const bufferMs = (rules.buffer_time || 0) * 60 * 60 * 1000;

        const bookings = await this.prisma.bookings.findMany({
            where: {
                resource_id: resourceId,
                status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
                deletedAt: null,
                start_time: { gte: workStart, lte: workEnd }
            }
        });

        const availableSlots: { start: string; end: string }[] = [];
        let currentSlotStart = new Date(workStart);
        const now = new Date();

        while (currentSlotStart.getTime() + slotDurationMs <= workEnd.getTime()) {
            const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDurationMs);

            // Deducted past slots and slots that are in buffer time from now to avoid showing them as available
            if (currentSlotStart < now) {
                currentSlotStart = currentSlotEnd;
                continue;
            }

            // Overlap and buffer check
            const isOccupied = bookings.some(booking => {
                const bStart = new Date(booking.start_time.getTime() - bufferMs);
                const bEnd = new Date(booking.end_time.getTime() + bufferMs);
                return (currentSlotStart < bEnd && currentSlotEnd > bStart);
            });

            if (!isOccupied) {
                availableSlots.push({
                    start: currentSlotStart.toISOString(),
                    end: currentSlotEnd.toISOString()
                });
            }

            currentSlotStart = currentSlotEnd;
        }

        return {
            date,
            day: dayName,
            availableSlots
        };
    }


    // Get my booking history
    async getMyBookingsHistory(user: User, query: MyBookingsHistoryQueryDto) {

        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;
        const { status, search } = query;

        if (!user.org_id) {
            throw new BadRequestException('User does not belong to any organization');
        }

        const whereClause: Prisma.BookingsWhereInput = {
            user_id: user.id,
            deletedAt: null,
            org_id: user?.org_id,
            ...(status ? { status } : {}),
            ...(search ? {
                resource: {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { type: { contains: search, mode: 'insensitive' } },
                    ],
                },
            } : {}),
        };

        try {
            const [bookings, total] = await this.prisma.$transaction([
                this.prisma.bookings.findMany({
                    where: whereClause,
                    include: {
                        resource: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                this.prisma.bookings.count({ where: whereClause }),
            ]);
            return {
                items: bookings,
                total,
                page: page,
                limit: limit,
                totalPages: Math.ceil(total / limit),
            };

        } catch (error: any) {
            throw new InternalServerErrorException(error?.message || 'Error fetching booking history');
        }


    }


    // Get all bookings for organization (for ORG_ADMIN)
    async getAllBookings(user: User, query: AllBookingsQueryDto) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;
        const { status, search, userId, resourceId, dateRange } = query;

        const [startDate, endDate] = dateRange ? dateRange.split(' to ').map(dateStr => new Date(dateStr)) : [null, null];
        if (startDate && endDate) {
            endDate.setHours(23, 59, 59, 999);
        }

        if (!user.org_id) {
            throw new BadRequestException('User does not belong to any organization');
        }

        const whereClause: Prisma.BookingsWhereInput = {
            org_id: user.org_id,
            deletedAt: null,
            ...(status ? { status } : {}),
            ...(search ? {
                // also allowing search by resources name and type in addition to user name to make it easier for org admins to find specific bookings
                OR: [
                    { resource: { name: { contains: search, mode: 'insensitive' } } },
                    { resource: { type: { contains: search, mode: 'insensitive' } } },
                    { user: { name: { contains: search, mode: 'insensitive' } } },
                    { user: { email: { contains: search, mode: 'insensitive' } } },
                ]
            } : {}),
            ...(userId ? { user_id: userId } : {}),
            ...(resourceId ? { resource_id: resourceId } : {}),
            ...(startDate && endDate ? {
                start_time: {
                    gte: startDate,
                    lte: endDate,
                },
            } : {}),
        };
        try {
            const [bookings, total] = await this.prisma.$transaction([
                this.prisma.bookings.findMany({
                    where: whereClause,
                    include: {
                        resource: true,
                        user: { select: { id: true, name: true, email: true, photo: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                this.prisma.bookings.count({ where: whereClause }),
            ]);
            return {
                items: bookings,
                total,
                page: page,
                limit: limit,
                totalPages: Math.ceil(total / limit),
            };

        } catch (error: any) {
            throw new InternalServerErrorException(error?.message || 'Error fetching all bookings');
        }

    }

    // Get all bookings for a resource for a specific month and year (for ORG_ADMIN and STAFF)
    async getBookingsByResourceAndMonth(user: User, resourceId: string, month: number, year: number) {

        if (!user.org_id) {
            throw new BadRequestException('User does not belong to any organization');
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        // check if resource exists and belongs to user's organization
        const resource = await this.prisma.resources.findUnique({
            where: { id: resourceId },
            include: { resourcesRules: true }
        });

        if (!resource) {
            throw new NotFoundException('Resource not found');
        }
        const rules = resource.resourcesRules[0];
        const calendarData: BookingCalendarData[] = [];

        // loop through each day in the month
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });


            let slots: { start: string; end: string }[] = [];
            let status = 'AVAILABLE';

            try {
                const result = await this.getAvailableSlotsByResource(resourceId, dateStr);
                slots = result.availableSlots;

                // Add the status logic based on available slots and resource rules
                if (slots.length === 0) {
                    // check if it's off day based on resource rules
                    const isAvailableDay = (rules?.availableDays as string[])?.includes(dayName);
                    status = isAvailableDay ? 'FULLY_BOOKED' : 'OFF_DAY';
                } else {
                    // check if all slots are booked
                    status = 'PARTIALLY_BOOKED';
                    // you can calculate maxSlots and compare if needed
                }
            } catch (error) {
                // if getAvailableSlotsByResource throws an error (e.g., for off-days)
                status = 'OFF_DAY';
            }

            calendarData.push({
                date: dateStr,
                day: dayName,
                availableSlotsCount: slots.length,
                status: status
            });
        }



        return { resourceId, month, year, calendar: calendarData };
    }






}
