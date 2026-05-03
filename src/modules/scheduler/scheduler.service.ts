// scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(private prisma: PrismaService) { }

    // Task 1: Auto-cancel pending bookings that are past their expiration time (runs every minute)
    @Cron(CronExpression.EVERY_MINUTE)
    async autoCancelPendingBookings() {
        this.logger.log('Checking for expired pending bookings...');
        const now = new Date();

       
    }

    // Task 2: Auto-complete confirmed bookings that are past their completion time (runs every 5 minutes)
    @Cron(CronExpression.EVERY_5_MINUTES)
    async autoCompleteConfirmedBookings() {
        const now = new Date();
        this.logger.log('Checking for completed bookings...');
       
    }

    // Task 3: Send reminders to Organizer for pending bookings to be confirmed (15 minutes before the booking)
    @Cron(CronExpression.EVERY_10_MINUTES)
    async sendBookingReminders() {
        const FifteenMinutesFromNow = new Date(Date.now() + 15 * 60000);
        // this.logger.log('Checking for upcoming bookings to send reminders...');
    }

    // Task 4: Send follow-up notifications to Staff before their scheduled bookings (15 minutes before the booking)
    @Cron(CronExpression.EVERY_10_MINUTES)
    async sendStaffFollowUps() {
        const FifteenMinutesFromNow = new Date(Date.now() + 15 * 60000);
        // this.logger.log('Checking for upcoming staff bookings to send follow-ups...');
    }

    // Task 5: 
}