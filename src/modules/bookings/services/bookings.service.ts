import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateBookingDto } from '../dto/bookings.dto';

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

}
