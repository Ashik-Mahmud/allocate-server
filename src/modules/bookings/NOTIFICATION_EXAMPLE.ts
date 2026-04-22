/**
 * PRACTICAL EXAMPLE: How to Use NotificationManager in Bookings Module
 *
 * This file shows real-world patterns for sending notifications
 * Copy and adapt these patterns to your own services
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { NotificationManager } from 'src/modules/inbox/service/notification-manager.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class BookingServiceWithNotifications {
  constructor(
    private prisma: PrismaService,
    private notificationManager: NotificationManager,
  ) {}

  /**
   * Example 1: Send notification when booking is created
   */
  async createBooking(data: {
    userId: string;
    resourceId: string;
    orgId: string;
    startTime: Date;
    endTime: Date;
  }) {
    // Create the booking
    const booking = await this.prisma.bookings.create({
      data: {
        user_id: data.userId,
        resource_id: data.resourceId,
        org_id: data.orgId,
        start_time: data.startTime,
        end_time: data.endTime,
        status: 'PENDING',
      },
      include: {
        user: true,
        organization: true,
        resource: true,
      },
    });

    // Send notification to the user
    await this.notificationManager.send({
      userId: booking.user_id,
      orgId: booking.org_id,
      userEmail: booking.user.email,
      userName: booking.user.name,
      type: 'BOOKING_CONFIRMED' as NotificationType,
      title: 'Booking Created',
      message: `Your booking for ${booking.resource.name} is pending review`,
      referenceId: booking.id,
      emailSubject: 'New Booking Created',
      emailTemplate: this.buildBookingEmailTemplate(booking),
    });

    return booking;
  }

  /**
   * Example 2: Send notification to admin when new booking arrives
   */
  async notifyAdminOfNewBooking(bookingId: string, orgId: string) {
    const booking = await this.prisma.bookings.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        resource: true,
      },
    });

    if (!booking) return;

    // Find all admins in the organization
    const admins = await this.prisma.user.findMany({
      where: {
        org_id: orgId,
        role: 'ORG_ADMIN',
      },
    });

    // Send notification to each admin
    const notifications = admins.map((admin) => ({
      userId: admin.id,
      orgId,
      userEmail: admin.email,
      userName: admin.name,
      type: 'BOOKING_PENDING_APPROVAL' as NotificationType,
      title: 'New Booking Request',
      message: `${booking.user.name} has created a booking for ${booking.resource.name}`,
      referenceId: bookingId,
      emailSubject: 'New Booking Request to Review',
    }));

    await this.notificationManager.sendBatch(notifications);
  }

  /**
   * Example 3: Send notification when booking is approved
   */
  async approveBooking(bookingId: string) {
    const booking = await this.prisma.bookings.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
      include: {
        user: true,
        resource: true,
      },
    });

    // Notify the user
    await this.notificationManager.send({
      userId: booking.user_id,
      orgId: booking.org_id,
      userEmail: booking.user.email,
      userName: booking.user.name,
      type: 'BOOKING_APPROVED' as NotificationType,
      title: 'Booking Approved',
      message: `Your booking for ${booking.resource.name} has been approved`,
      referenceId: bookingId,
      emailSubject: 'Your Booking is Approved ✓',
      emailTemplate: `
        <h2>Hello ${booking.user.name},</h2>
        <p>Your booking request has been approved!</p>
        <div style="background: #f0f0f0; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50;">
          <p><strong>Booking Details:</strong></p>
          <ul>
            <li><strong>Resource:</strong> ${booking.resource.name}</li>
            <li><strong>Start:</strong> ${booking.start_time.toLocaleString()}</li>
            <li><strong>End:</strong> ${booking.end_time.toLocaleString()}</li>
          </ul>
        </div>
        <p>Thank you for booking with us!</p>
      `,
    });

    return booking;
  }

  /**
   * Example 4: Send notification when booking is cancelled
   */
  async cancelBooking(bookingId: string, reason?: string) {
    const booking = await this.prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancellation_reason: reason,
      },
      include: {
        user: true,
        resource: true,
      },
    });

    // Notify the user
    await this.notificationManager.send({
      userId: booking.user_id,
      orgId: booking.org_id,
      userEmail: booking.user.email,
      userName: booking.user.name,
      type: 'BOOKING_CANCELLED' as NotificationType,
      title: 'Booking Cancelled',
      message: `Your booking for ${booking.resource.name} has been cancelled`,
      referenceId: bookingId,
      metadata: { cancellationReason: reason },
      emailSubject: 'Booking Cancelled',
      emailTemplate: `
        <h2>Booking Cancelled</h2>
        <p>Your booking has been cancelled.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      `,
    });

    return booking;
  }

  /**
   * Example 5: Send reminder notification before booking
   */
  async sendBookingReminders() {
    // Find bookings that are 24 hours away
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcomingBookings = await this.prisma.bookings.findMany({
      where: {
        status: 'CONFIRMED',
        start_time: {
          gte: new Date(tomorrow.setHours(0, 0, 0, 0)),
          lte: new Date(tomorrow.setHours(23, 59, 59, 999)),
        },
      },
      include: {
        user: true,
        resource: true,
      },
    });

    // Send reminders for each booking
    for (const booking of upcomingBookings) {
      await this.notificationManager.send({
        userId: booking.user_id,
        orgId: booking.org_id,
        userEmail: booking.user.email,
        userName: booking.user.name,
        type: 'BOOKING_REMINDER' as NotificationType,
        title: 'Booking Reminder',
        message: `Your booking for ${booking.resource.name} is tomorrow at ${booking.start_time.toLocaleTimeString()}`,
        referenceId: booking.id,
        emailSubject: '⏰ Reminder: Your Booking is Tomorrow',
      });
    }

    console.log(`Sent ${upcomingBookings.length} booking reminders`);
  }

  /**
   * Example 6: Batch notification for announcement
   */
  async sendAnnouncementToOrganization(
    orgId: string,
    title: string,
    message: string,
  ) {
    // Get all active users in the organization
    const users = await this.prisma.user.findMany({
      where: {
        org_id: orgId,
        deletedAt: null,
      },
    });

    // Create notifications for all users
    const notifications = users.map((user) => ({
      userId: user.id,
      orgId,
      userEmail: user.email,
      userName: user.name,
      type: 'ANNOUNCEMENT' as NotificationType,
      title,
      message,
      emailSubject: `📢 ${title}`,
      emailTemplate: `
        <h2>${title}</h2>
        <p>${message}</p>
      `,
    }));

    // Send all notifications
    const results = await this.notificationManager.sendBatch(notifications);

    // Log results
    const successCount = results.filter((r) => r.email.sent).length;
    console.log(`Announcement sent to ${successCount}/${users.length} users`);

    return results;
  }

  /**
   * Helper: Build booking email template
   */
  private buildBookingEmailTemplate(booking: any): string {
    const formatDate = (date: Date) => new Date(date).toLocaleString();

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Booking Confirmation</h2>
        <p>Hello ${booking.user.name},</p>
        <p>Your booking has been created successfully!</p>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Booking Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #666; width: 150px;">Resource:</td>
              <td style="padding: 10px; color: #333;">${booking.resource.name}</td>
            </tr>
            <tr style="background: #f0f0f0;">
              <td style="padding: 10px; font-weight: bold; color: #666;">Booking ID:</td>
              <td style="padding: 10px; color: #333;">${booking.id}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #666;">Start Time:</td>
              <td style="padding: 10px; color: #333;">${formatDate(booking.start_time)}</td>
            </tr>
            <tr style="background: #f0f0f0;">
              <td style="padding: 10px; font-weight: bold; color: #666;">End Time:</td>
              <td style="padding: 10px; color: #333;">${formatDate(booking.end_time)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #666;">Total Cost:</td>
              <td style="padding: 10px; color: #333; font-size: 18px; color: #2196F3;">$${booking.total_cost || 0}</td>
            </tr>
          </table>
        </div>

        <p style="color: #666; font-size: 14px;">
          Your booking is currently <strong style="color: #FF9800;">pending approval</strong>. 
          You will receive an email confirmation once it's approved.
        </p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
          <p>If you have any questions, please contact support.</p>
          <p>© ${new Date().getFullYear()} Allocate. All rights reserved.</p>
        </div>
      </div>
    `;
  }
}

/**
 * USAGE IN BOOKING CONTROLLER:
 *
 * @Post('create')
 * async createBooking(
 *   @Body() createBookingDto: CreateBookingDto,
 *   @CurrentUser() user: UserPayload,
 * ) {
 *   const booking = await this.bookingService.createBooking({
 *     userId: user.id,
 *     resourceId: createBookingDto.resourceId,
 *     orgId: user.org_id,
 *     startTime: createBookingDto.startTime,
 *     endTime: createBookingDto.endTime,
 *   });
 *
 *   // Notify admin of new booking
 *   await this.bookingService.notifyAdminOfNewBooking(booking.id, user.org_id);
 *
 *   return ResponseUtil.success(booking);
 * }
 *
 * @Post(':id/approve')
 * @Authorize('ORG_ADMIN')
 * async approveBooking(@Param('id') bookingId: string) {
 *   const booking = await this.bookingService.approveBooking(bookingId);
 *   return ResponseUtil.success(booking);
 * }
 *
 * @Post(':id/cancel')
 * async cancelBooking(
 *   @Param('id') bookingId: string,
 *   @Body() { reason }: CancelBookingDto,
 * ) {
 *   const booking = await this.bookingService.cancelBooking(bookingId, reason);
 *   return ResponseUtil.success(booking);
 * }
 */
