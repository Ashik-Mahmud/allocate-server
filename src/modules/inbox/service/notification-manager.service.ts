import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { EmailService } from './email.service';
import {
    NotificationDispatcher,
    NotificationPayload,
    NotificationDispatchResult,
} from 'src/utils/notification-dispatcher';
import { Prisma } from '@prisma/client';

/**
 * Notification Manager Service
 *
 * High-level service for sending notifications through all channels
 * Handles fetching organization preferences and dispatching to appropriate channels
 *
 * Usage in other modules:
 * await this.notificationManager.send({
 *   userId: user.id,
 *   orgId: org.id,
 *   userEmail: user.email,
 *   userName: user.name,
 *   type: 'BOOKING_CONFIRMED',
 *   title: 'Booking Confirmed',
 *   message: 'Your booking has been confirmed',
 *   emailSubject: 'Your Booking is Confirmed'
 * });
 */
@Injectable()
export class NotificationManager {
    constructor(
        private prisma: PrismaService,
        private emailService: EmailService,
    ) { }

    /**
     * Main method to send notifications through all configured channels
     * Automatically fetches organization preferences and routes accordingly
     */
    async send(payload: NotificationPayload): Promise<NotificationDispatchResult> {
        try {
            // Fetch organization settings
            const org = await this.prisma.organizations.findUnique({
                where: { id: payload.orgId },
                select: { settings: true },
            });

            if (!org) {
                return this.errorResult('Organization not found');
            }

            // Parse notification preferences
            const preferences = NotificationDispatcher.parsePreferences(org.settings);

            // Prepare services for dispatcher
            const services = {
                inboxService: this,
                emailService: this.emailService,
                smsService: null, // Add when SMS service is ready
                pushService: null, // Add when push service is ready
            };

            // Dispatch to all enabled channels
            const result = await NotificationDispatcher.dispatch(
                payload,
                preferences,
                services,
            );

            return result;
        } catch (error) {
            console.error('Error in notification manager:', error);
            return this.errorResult((error as Error).message);
        }
    }

    /**
     * Send notification to multiple users
     */
    async sendBatch(
        payloads: NotificationPayload[],
    ): Promise<NotificationDispatchResult[]> {
        const results = await Promise.all(payloads.map((p) => this.send(p)));
        return results;
    }

    /**
     * Create in-app notification (used internally by dispatcher)
     */
    async createNotification(data: {
        userId: string;
        orgId: string;
        type: any;
        title: string;
        message: string;
        refId?: string;
        metadata?: any;
    }) {
        const notification = await this.prisma.notification.create({
            data: {
                user_id: data.userId,
                org_id: data.orgId,
                type: data.type,
                title: data.title,
                message: data.message,
                reference_id: data.refId,
                metadata: data.metadata,
            },
        });

        // TODO: Integrate with Socket.io or Firebase for real-time delivery
        // this.socketService.sendToUser(data.userId, notification);

        return notification;
    }

    /**
     * Get inbox messages for a user
     */
    async getInboxMessages(userId: string, query: { page?: number; limit?: number; is_read?: string; search?: string }) {
        const { page = 1, limit = 10, is_read, search } = query;
        const skip = Number((page - 1) * limit);
        const take = Number(limit);

        const whereClause: Prisma.NotificationWhereInput = { user_id: userId };

        if (is_read !== undefined) {
            whereClause.is_read = is_read === 'true';
        }

        if (search) {
            whereClause.OR = [
                { title: { contains: search , mode: 'insensitive' } },
                { message: { contains: search , mode: 'insensitive' } },
            ];
        }

        const [messages, total, unreadCount] = await this.prisma.$transaction([
            this.prisma.notification.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip: skip,
                take: take,
            }),
            this.prisma.notification.count({ where: whereClause }),
            this.prisma.notification.count({ where: { user_id: userId, is_read: false } }), // For unread count
        ]);


        return {
            items: messages,
            total,
            page: page,
            limit: limit,
            totalPages: Math.ceil(total / limit),
            metadata:{
                unreadCount
            }
        };
    }

    /**
     * Mark notification as read
     */
    async markAsRead(userId: string, notificationId: string) {
        return await this.prisma.notification.update({
            where: { id: notificationId, user_id: userId },
            data: { is_read: true },
        });
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string) {
        return await this.prisma.notification.updateMany({
            where: { user_id: userId, is_read: false },
            data: { is_read: true },
        });
    }

    /**
     * Delete notification
     */
    async deleteNotification(userId: string, notificationId: string) {
        return await this.prisma.notification.delete({
            where: { id: notificationId, user_id: userId },
        });
    }

    /**
     * Get unread count for a user
     */
    async getUnreadCount(userId: string) {
        return await this.prisma.notification.count({
            where: { user_id: userId, is_read: false },
        });
    }

    /**
     * Delete all notifications for a user
     */
    async deleteAllNotifications(userId: string) {
        return await this.prisma.notification.deleteMany({
            where: { user_id: userId },
        });
    }

    /**
     * Helper to generate error result
     */
    private errorResult(message: string): NotificationDispatchResult {
        return {
            inApp: { sent: false, error: message },
            email: { sent: false, error: message },
            sms: { sent: false, error: message },
            push: { sent: false, error: message },
        };
    }
}
