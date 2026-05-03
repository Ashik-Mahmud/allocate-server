import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Bookings, BookingStatus, NotificationType, PlanType, Prisma, Role, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateBookingDto, UpdateBookingDto, UpdateBookingStatusDto } from '../dto/bookings.dto';
import GLOBAL_CONFIG from 'src/shared/constant/global.constant';
import { AllBookingsQueryDto, BookingStatsQueryDto, MyBookingsHistoryQueryDto } from '../dto/booking-filter.dto';
import { BookingCalendarData } from '../interfaces/booking.interface';
import { NotificationManager } from 'src/modules/inbox/service/notification-manager.service';
import { BookingUtilService } from './bookingUtil.service';
import { Response } from 'express';
import { SharedService } from 'src/shared/services/shared.service';
import {
    getDateKeyInTimezone,
    getEndOfDayUtc,
    getMonthKeyInTimezone,
    getStartOfDayUtc,
    getWeekKeyInTimezone,
    getWeekdayInTimezone,
    parseDateTimeInTimezone,
    resolveTimezone,
    resolveUserTimezone,
    formatInTimezone,
} from 'src/shared/utils/timezone.util';

@Injectable()
export class BookingsService {

    constructor(
        private prisma: PrismaService,
        private notificationManager: NotificationManager,
        private bookingUtilService: BookingUtilService,
        private sharedService: SharedService
    ) { }

    // Create a booking for a resource
    async createBooking(currentUser: User, createBookingDto: CreateBookingDto, res: Response) {
        const { user_id, resource_id, start_time, end_time, notes } = createBookingDto;
        const timezone = resolveUserTimezone(currentUser as any);

        // basic time variables for later use
        const startTime = parseDateTimeInTimezone(start_time, timezone);
        const endTime = parseDateTimeInTimezone(end_time, timezone);
        const now = new Date();
        const userId = user_id || currentUser.id
        const ipAddress = (res.req?.headers['x-forwarded-for'] as string) || res.req?.ip || res.req?.connection?.remoteAddress || '';

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
                const bookingDay = getWeekdayInTimezone(startTime, timezone);
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

            const user = await tx.user.findUnique({ where: { id: userId } });
            if (!user) throw new NotFoundException('User not found');

            // Check pending bookings for the user to calculate pending credits
            const pendingBookings = await tx.bookings.aggregate({
                where: { user_id: userId, status: 'PENDING', deletedAt: null },
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
                    user_id: userId,
                    resource_id,
                    org_id: currentUser.org_id,
                    start_time: startTime,
                    end_time: endTime,
                    total_cost: totalCost,
                    notes,
                    metadata: {
                        hourly_rate: hourlyRate,
                        resource_name: resource.name,
                        resource_type: resource.type,
                        user_name: user.name,
                        user_email: user.email,
                        ipAdress: ipAddress,
                        userAgent: res.req?.headers['user-agent'] || '',
                        duration_hours: hoursDifference,
                    },
                    created_by: currentUser.id,
                    status: bookingStatus,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            personal_credits: true,
                        }
                    },
                    resource: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                        }
                    },
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        }
                    }
                },
            });

            // Deduct credits from user
            if (bookingStatus === BookingStatus.CONFIRMED) {
                if (Number(user.personal_credits || 0) < totalCost) {
                    throw new BadRequestException('Not enough credits to confirm this booking');
                }
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        personal_credits: {
                            decrement: totalCost,
                        },
                    },
                });
            }

            // Send notification 

            await this.bookingUtilService.handlePostBookingActions(booking, tx, currentUser, {
                ipAddress: ipAddress,
                userAgent: res.req?.headers['user-agent'] || '',
                queries: {
                    queryOne: `start:${booking.start_time.toISOString()}`,
                    queryTwo: `end:${booking.end_time.toISOString()}`,
                },
                notifications: {
                    staff: {
                        message: `Your booking for {{resourceName}} has been created with status {{status}}.`,
                    },
                    orgAdmin: {
                        enabled: booking.status === BookingStatus.PENDING,
                        message: `{{requesterName}} created a booking request for {{resourceName}}.`,
                    },
                },
                activityLog: {
                    action: 'BOOKING_CREATED',
                    details: 'Booking #{{bookingId}} created for {{resourceName}} by {{actorName}}',
                },
            });

            return booking;
        });

    }



    // Update booking status (e.g. cancel a booking)
    async updateBookingStatus(user: User, bookingId: string, updateBookingStatusDto: UpdateBookingStatusDto, res?: Response): Promise<Bookings | void> {

        const { status, cancellation_reason } = updateBookingStatusDto;

        const booking = await this.prisma.bookings.findUnique({
            where: { id: bookingId, deletedAt: null },
            include: { user: true, resource: true }
        });

        if (!booking) throw new NotFoundException('Booking not found');

        if (user.role === Role.STAFF && booking.user_id !== user.id) {
            throw new BadRequestException('You can only update your own bookings');
        }
        return await this.prisma.$transaction(async (tx) => {
            let finalStatus = status;
            let refundAmount = 0;
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

                refundAmount = (Number(booking.total_cost) || 0) * refundMultiplier;

                if (refundAmount > 0) {
                    await tx.user.update({
                        where: { id: booking.user_id },
                        data: { personal_credits: { increment: refundAmount } }
                    });
                }
            }

            // Send notification to user about the status update
            const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
            await this.bookingUtilService.handlePostBookingActions({
                ...booking,
                status: finalStatus,

            }, tx, user, {
                ipAddress: ipAddress,
                userAgent: res?.req?.headers['user-agent'] || '',
                queries: {
                    queryOne: `status:${finalStatus}`,
                    queryTwo: `resource:${booking.resource?.name || 'resource'}`,
                },
                notifications: {
                    staff: {
                        message: `Your booking for {{resourceName}} is now {{status}}. ${cancellation_reason ? `Reason: ${cancellation_reason}` : ''}`,
                    },
                    orgAdmin: {
                        enabled: user.role !== Role.ORG_ADMIN || booking.user_id !== user.id,
                        message: `Booking for {{resourceName}} by {{requesterName}} is now {{status}}. ${cancellation_reason ? `Reason: ${cancellation_reason}` : ''}`,
                    },
                },
                creditTransaction: {
                    enabled:
                        (booking.status === BookingStatus.PENDING && finalStatus === BookingStatus.CONFIRMED) ||
                        (booking.status === BookingStatus.CONFIRMED && finalStatus === BookingStatus.CANCELLED && refundAmount > 0),
                    type:
                        booking.status === BookingStatus.CONFIRMED && finalStatus === BookingStatus.CANCELLED
                            ? 'REFUND'
                            : 'SPEND',
                    amount:
                        booking.status === BookingStatus.CONFIRMED && finalStatus === BookingStatus.CANCELLED
                            ? refundAmount
                            : Number(booking.total_cost || 0),
                    description:
                        booking.status === BookingStatus.CONFIRMED && finalStatus === BookingStatus.CANCELLED
                            ? 'Credits refunded for cancelled booking #{{bookingId}} ({{resourceName}})'
                            : 'Credits spent for booking #{{bookingId}} ({{resourceName}})',
                },
                activityLog: {
                    action: `BOOKING_${finalStatus}`,
                    details: `Booking #{{bookingId}} for {{resourceName}} changed to {{status}} by {{actorName}}`,
                    metadata: {
                        previous_status: booking.status,
                    },
                },
            });

            return await tx.bookings.update({
                where: { id: bookingId },
                data: {
                    status: finalStatus,
                    ...(finalStatus === BookingStatus.CANCELLED && cancellation_reason ? { cancellation_reason: cancellation_reason } : {}),
                },
            });
        });

    }

    // Update booking notes 
    async updateBookingDetails(user: User, bookingId: string, updateBookingDto: UpdateBookingDto, res?: Response): Promise<Bookings> {

        const booking = await this.prisma.bookings.findUnique({
            where: { id: bookingId, deletedAt: null },
            include: { user: true }
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.user_id !== user.id) {
            throw new ForbiddenException('You are not authorized to update this booking');
        }

        // dont allow user to update notes if the booking is already cancelled or completed and rejected 
        if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
            throw new BadRequestException('You cannot update a booking that is not pending or confirmed');
        }

        this.sharedService.logActivity(this.prisma, {
            action: 'BOOKING_UPDATED',
            details: `Booking #${booking.id} for ${booking.resource_id || 'resource'} updated by ${user.name}`,
            metadata: {
                previous_notes: booking.notes,
                new_notes: updateBookingDto.notes,
                booking_status: booking.status,
                bookingId: booking.id,
                resourceId: booking.resource_id || 'resource',
            },
            orgId: booking.org_id,
            userId: user.id,
            ipAddress: (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '',
            userAgent: res?.req?.headers['user-agent'] || '',
        });


        return await this.prisma.bookings.update({
            where: { id: bookingId },
            data: {
                notes: updateBookingDto.notes,
                //metadata: updateBookingDto.metadata ? { ...booking.metadata, ...updateBookingDto.metadata } : booking.metadata,
            },
        });
    }

    // Get available slots for a resource within a date 
  async getAvailableSlotsByResource(resourceId: string, date: string, timezone?: string) {
    const resource = await this.prisma.resources.findUnique({
        where: { id: resourceId },
        include: {
            resourcesRules: true,
            organization: {
                select: {
                    timezone: true,
                },
            },
        }
    });

    if (!resource) throw new NotFoundException('Resource not found');

    const resolvedTimezone = resolveTimezone(timezone, resource.organization?.timezone, process.env.DEFAULT_TIMEZONE, 'UTC');
    const rules = resource.resourcesRules[0];
    const availableDays = (rules?.availableDays as string[]) || [];

 
    const dayName = getWeekdayInTimezone(date, resolvedTimezone);
    
    if (availableDays.length > 0 && !availableDays.includes(dayName)) {
        throw new BadRequestException(`Resource is not available on ${dayName}`);
    }

    const workStart = parseDateTimeInTimezone(`${date}T${String(rules?.opening_hours || 9).padStart(2, '0')}:00:00`, resolvedTimezone);
    const workEnd = parseDateTimeInTimezone(`${date}T${String(rules?.closing_hours || 18).padStart(2, '0')}:00:00`, resolvedTimezone);

    const slotDurationMs = (rules.slot_duration_min || 30) * 60 * 1000;
    const bufferMs = (rules.buffer_time || 0) * 60 * 60 * 1000;

    
    const bookings = await this.prisma.bookings.findMany({
        where: {
            resource_id: resourceId,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
            deletedAt: null,
            start_time: { lte: workEnd },
            end_time: { gte: workStart }
        }
    });

    const availableSlots: { start: string; end: string }[] = [];
    let currentSlotStart = new Date(workStart);
    const now = new Date();

    while (currentSlotStart.getTime() + slotDurationMs <= workEnd.getTime()) {
        const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDurationMs);

        if (currentSlotStart < now) {
            currentSlotStart = new Date(currentSlotStart.getTime() + slotDurationMs);
            continue;
        }

        const isOccupied = bookings.some(booking => {
            const bStartWithBuffer = booking.start_time.getTime() - bufferMs;
            const bEndWithBuffer = booking.end_time.getTime() + bufferMs;
            
            return (currentSlotStart.getTime() < bEndWithBuffer && currentSlotEnd.getTime() > bStartWithBuffer);
        });

        if (!isOccupied) {
            availableSlots.push({
                start: formatInTimezone(currentSlotStart, resolvedTimezone, { dateStyle: 'short', timeStyle: 'short' }),
                end: formatInTimezone(currentSlotEnd, resolvedTimezone, { dateStyle: 'short', timeStyle: 'short' })
            });
        }

        currentSlotStart = new Date(currentSlotStart.getTime() + slotDurationMs);
    }

    return { date, day: dayName, timezone: resolvedTimezone, availableSlots };
}

    // Get my booking history
    async getMyBookingsHistoryService(user: User, query: MyBookingsHistoryQueryDto) {

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
        const timezone = resolveUserTimezone(user as any);

        const [startRaw, endRaw] = dateRange ? dateRange.split(' to ') : [null, null];
        const startDate = startRaw ? getStartOfDayUtc(startRaw, timezone) : null;
        const endDate = endRaw ? getEndOfDayUtc(endRaw, timezone) : null;

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

        const timezone = resolveUserTimezone(user as any);

        // Calculate the start and end dates for the given month and year
        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(Date.UTC(year, month, 0));

        const resource = await this.prisma.resources.findUnique({
            where: { id: resourceId },
            include: { resourcesRules: true }
        });

        if (!resource) {
            throw new NotFoundException('Resource not found');
        }

        const rules = resource.resourcesRules[0];
        const calendarData: BookingCalendarData[] = [];

        // Loop through each day of the month to get available slots and booking status
        let currentLoopDate = new Date(startDate);

        while (currentLoopDate <= endDate) {
            // Format the date to YYYY-MM-DD for querying
            const yyyy = currentLoopDate.getUTCFullYear();
            const mm = String(currentLoopDate.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(currentLoopDate.getUTCDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;

            const dayName = getWeekdayInTimezone(dateStr, timezone);

            let slots: { start: string; end: string }[] = [];
            let status = 'AVAILABLE';

            try {
                const result = await this.getAvailableSlotsByResource(resourceId, dateStr, timezone);
                slots = result.availableSlots;

                if (slots.length === 0) {
                    const isAvailableDay = (rules?.availableDays as string[])?.includes(dayName);
                    status = isAvailableDay ? 'FULLY_BOOKED' : 'OFF_DAY';
                } else {
                    status = 'PARTIALLY_BOOKED';
                }
            } catch (error) {
                status = 'OFF_DAY';
            }

            calendarData.push({
                date: dateStr,
                day: dayName,
                availableSlotsCount: slots.length,
                slots: slots,
                status: status
            });

    
            currentLoopDate.setUTCDate(currentLoopDate.getUTCDate() + 1);
        }

        return { resourceId, month, year, calendar: calendarData };
    }

    // Get booking statistics (for ORG_ADMIN)
    async getBookingStats(user: User, query: BookingStatsQueryDto) {
        const { startDate, endDate, groupBy } = query;
        const timezone = resolveUserTimezone(user as any);

        if (!user.org_id) {
            throw new BadRequestException('User does not belong to any organization');
        }
        const organization = await this.prisma.organizations.findUnique({ where: { id: user.org_id, deletedAt: null } });
        if (!organization) {
            throw new NotFoundException('Organization not found');
        }

        // month grouping is only allowed for PRO and ENTERPRISE plans due to complexity of calculating month keys and grouping by them in code, while day and week grouping can be easily achieved by just formatting the date in the query
        if (organization.plan_type === PlanType.FREE && (groupBy === 'month' || groupBy === 'week')) {
            throw new ForbiddenException(`Monthly and Weekly statistics are only available in ${PlanType.PRO} or ${PlanType.ENTERPRISE} plan`);
        }

        const whereClause: Prisma.BookingsWhereInput = {
            org_id: user.org_id,
            deletedAt: null,
            ...(startDate && endDate ? {
                start_time: {
                    gte: getStartOfDayUtc(startDate, timezone),
                    lte: getEndOfDayUtc(endDate, timezone),
                },
            } : {}),
        };

        try {

            // time based
            if (['day', 'week', 'month'].includes(groupBy)) {
                const bookings = await this.prisma.bookings.findMany({
                    where: whereClause,
                    select: { start_time: true, total_cost: true },
                    orderBy: { start_time: 'asc' },
                });

                const grouped = new Map<string, { count: number; totalCost: number }>();

                for (const booking of bookings) {
                    let key: string;

                    if (groupBy === 'day') {
                        key = getDateKeyInTimezone(booking.start_time, timezone);
                    } else if (groupBy === 'month') {
                        key = getMonthKeyInTimezone(booking.start_time, timezone);
                    } else {
                        key = getWeekKeyInTimezone(booking.start_time, timezone);
                    }

                    const current = grouped.get(key) || { count: 0, totalCost: 0 };
                    current.count += 1;
                    current.totalCost += Number(booking.total_cost || 0);
                    grouped.set(key, current);
                }

                return Array.from(grouped.entries()).map(([period, values]) => ({
                    period,
                    bookingsCount: values.count,
                    totalCredits: values.totalCost,
                    averageCredits: values.count > 0 ? (values.totalCost / values.count).toFixed(2) : 0,
                }));
            }

            const allowedGroupByFields: Prisma.BookingsScalarFieldEnum[] = ['resource_id', 'user_id', 'status'];
            const byField = allowedGroupByFields.includes(groupBy as any) ? (groupBy as any) : 'resource_id';

            const stats = await this.prisma.bookings.groupBy({
                by: [byField],
                where: whereClause,
                _count: { id: true },
                _sum: { total_cost: true },
                _avg: { total_cost: true },
            });

            return stats;
        } catch (error: any) {
            throw new InternalServerErrorException(error?.message || 'Error fetching booking statistics');
        }
    }




}
