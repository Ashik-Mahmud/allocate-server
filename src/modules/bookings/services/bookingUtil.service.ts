import { Injectable } from "@nestjs/common";
import { Bookings, BookingStatus, NotificationType, Prisma, TransactionType, User } from "@prisma/client";
import { NotificationManager } from "src/modules/inbox/service/notification-manager.service";
import { getBookingMessage } from "../constant/BookingMessages";
import { SharedService } from "src/shared/services/shared.service";
import { formatInTimezone, resolveUserTimezone } from "src/shared/utils/timezone.util";

type BookingUtilServiceOthersOptions = {
    cancelReason?: string;
    ipAddress?: string;
    userAgent?: string;
    queries?: {
        queryOne?: string;
        queryTwo?: string;
    };
    notifications?: {
        staff?: {
            type?: NotificationType;
            title?: string;
            message?: string;
            emailSubject?: string;
        };
        orgAdmin?: {
            enabled?: boolean;
            type?: NotificationType;
            title?: string;
            message?: string;
            emailSubject?: string;
        };
    };
    creditTransaction?: {
        enabled?: boolean;
        type?: TransactionType;
        description?: string;
        amount?: number;
        previousBalance?: number;
        currentBalance?: number;
    };
    activityLog?: {
        action?: string;
        details?: string;
        metadata?: Record<string, unknown>;
    };
};

@Injectable()
export class BookingUtilService {
    constructor(
        private notificationManager: NotificationManager,
        private sharedService: SharedService,
    ) { }

    async handlePostBookingActions(
        booking: Bookings | any,
        tx: Prisma.TransactionClient,
        currentUser: User,
        options?: BookingUtilServiceOthersOptions,
    ) {
        const timezone = resolveUserTimezone(currentUser as any);

        // Find Organization Admin
        const orgAdmin = await tx.user.findFirst({
            where: { org_id: booking.org_id, role: 'ORG_ADMIN', deletedAt: null },
            select: { id: true, email: true, name: true },
        });

        const resourceName = booking?.resource?.name || 'resource';
        const requesterName = booking?.user?.name || 'Staff';
        const notificationType = this.getNotificationTypeBookingStatus(booking.status as BookingStatus);
        const defaultStaffMessage = getBookingMessage(notificationType, 'STAFF', {
            resourceName,
            requesterName,
            actorName: currentUser.name,
            startTime: booking?.start_time ? formatInTimezone(booking.start_time, timezone, { dateStyle: 'medium', timeStyle: 'short' }) : undefined,
            endTime: booking?.end_time ? formatInTimezone(booking.end_time, timezone, { dateStyle: 'medium', timeStyle: 'short' }) : undefined,
            cancelReason: options?.cancelReason,
        });
        const defaultAdminMessage = getBookingMessage(notificationType, 'ORG_ADMIN', {
            resourceName,
            requesterName,
            actorName: currentUser.name,
            startTime: booking?.start_time ? formatInTimezone(booking.start_time, timezone, { dateStyle: 'medium', timeStyle: 'short' }) : undefined,
            endTime: booking?.end_time ? formatInTimezone(booking.end_time, timezone, { dateStyle: 'medium', timeStyle: 'short' }) : undefined,
            cancelReason: options?.cancelReason,
        });

        const tasks: Promise<any>[] = [];

        // Staff Notification
        tasks.push(
            this.notificationManager.send({
                userId: booking.user_id,
                orgId: booking.org_id,
                userEmail: booking.user.email,
                userName: booking.user.name,
                type: options?.notifications?.staff?.type || notificationType,
                title: this.resolveTemplate(
                    options?.notifications?.staff?.title || defaultStaffMessage.title,
                    booking,
                    currentUser,
                    options,
                ),
                message: this.resolveTemplate(
                    options?.notifications?.staff?.message || defaultStaffMessage.message,
                    booking,
                    currentUser,
                    options,
                ),
                emailSubject: this.resolveTemplate(
                    options?.notifications?.staff?.emailSubject || defaultStaffMessage.title,
                    booking,
                    currentUser,
                    options,
                ),
                referenceId: booking.id,
            }),
        );

        // Organization Admin Notification (if exists)
        if (orgAdmin && options?.notifications?.orgAdmin?.enabled !== false) {
            tasks.push(
                this.notificationManager.send({
                    userId: orgAdmin.id,
                    orgId: booking.org_id,
                    userEmail: orgAdmin.email,
                    userName: orgAdmin.name,
                    type: options?.notifications?.orgAdmin?.type || notificationType,
                    title: this.resolveTemplate(
                        options?.notifications?.orgAdmin?.title || defaultAdminMessage.title,
                        booking,
                        currentUser,
                        options,
                    ),
                    message: this.resolveTemplate(
                        options?.notifications?.orgAdmin?.message || defaultAdminMessage.message,
                        booking,
                        currentUser,
                        options,
                    ),
                    emailSubject: this.resolveTemplate(
                        options?.notifications?.orgAdmin?.emailSubject || defaultAdminMessage.title,
                        booking,
                        currentUser,
                        options,
                    ),
                    referenceId: booking.id,
                }),
            );
        }

        // Credits Transaction (if applicable)
        const shouldCreateCreditTransaction =
            options?.creditTransaction?.enabled ?? Number(booking.total_cost || 0) > 0;

        if (shouldCreateCreditTransaction) {
            // here is catch if type is refund then amount should be positive and if type is spend then amount should be negative

            const amount = Number(options?.creditTransaction?.amount ?? booking.total_cost ?? 0);
            const previousBalance = Number(
                options?.creditTransaction?.previousBalance ?? booking.user?.personal_credits ?? 0,
            );
            const currentBalance =
                options?.creditTransaction?.currentBalance ??
                (options?.creditTransaction?.type === TransactionType.REFUND
                    ? previousBalance + amount
                    : previousBalance - amount);


            const creditDescription = this.resolveTemplate(
                options?.creditTransaction?.description ||
                `Credits deducted for booking #{{bookingId}} for {{resourceName}}`,
                booking,
                currentUser,
                options,
            );

            tasks.push(
                this.sharedService.createCreditTransaction(
                    tx,
                    {
                        amount,
                        prevBalance: previousBalance,
                        currBalance: currentBalance,
                        performedBy: currentUser.id,
                        type: options?.creditTransaction?.type || TransactionType.SPEND,
                        userId: booking.user_id,
                        orgId: booking.org_id,
                        refId: booking?.id,
                        description: creditDescription,
                    }
                )
            );
        }

        // Activity Log
        const activityAction =
            options?.activityLog?.action || this.getActivityActionByStatus(booking.status as BookingStatus);
        const activityDetails = this.resolveTemplate(
            options?.activityLog?.details ||
            `Booking action {{status}} for {{resourceName}} by {{actorName}}`,
            booking,
            currentUser,
            options,
        );

        tasks.push(
            this.sharedService.logActivity(tx, {
                action: activityAction,
                userId: currentUser.id,
                orgId: currentUser?.org_id || booking.org_id,
                details: activityDetails,
                metadata: {
                    booking_id: booking.id,
                    resource_id: booking.resource_id,
                    status: booking.status,
                    queryOne: options?.queries?.queryOne,
                    queryTwo: options?.queries?.queryTwo,
                    ...(options?.activityLog?.metadata || {}),
                },
                ipAddress: options?.ipAddress || '',
                userAgent: options?.userAgent || '',

            }),
        );


        await Promise.all(tasks);
    }


    getNotificationTypeBookingStatus(status: BookingStatus): NotificationType {
        switch (status) {
            case BookingStatus.PENDING:
                return NotificationType.BOOKING_REQUESTED;
            case BookingStatus.CONFIRMED:
                return NotificationType.BOOKING_CONFIRMED;
            case BookingStatus.REJECTED:
                return NotificationType.BOOKING_REJECTED;
            case BookingStatus.CANCELLED:
                return NotificationType.BOOKING_CANCELLED;
            default:
                return NotificationType.BOOKING_REQUESTED;
        }
    }

    private getActivityActionByStatus(status: BookingStatus): string {
        switch (status) {
            case BookingStatus.PENDING:
                return 'BOOKING_REQUESTED';
            case BookingStatus.CONFIRMED:
                return 'BOOKING_CONFIRMED';
            case BookingStatus.REJECTED:
                return 'BOOKING_REJECTED';
            case BookingStatus.CANCELLED:
                return 'BOOKING_CANCELLED';
            case BookingStatus.COMPLETED:
                return 'BOOKING_COMPLETED';
            default:
                return 'BOOKING_UPDATED';
        }
    }

    private resolveTemplate(
        template: string,
        booking: Bookings | any,
        currentUser: User,
        options?: BookingUtilServiceOthersOptions,
    ): string {
        const values: Record<string, string> = {
            bookingId: booking?.id || '',
            resourceName: booking?.resource?.name || 'resource',
            requesterName: booking?.user?.name || 'Staff',
            actorName: currentUser?.name || 'System',
            status: String(booking?.status || ''),
            queryOne: options?.queries?.queryOne || '',
            queryTwo: options?.queries?.queryTwo || '',
            cancelReason: options?.cancelReason || '',
        };

        return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => values[key] || '');
    }
}