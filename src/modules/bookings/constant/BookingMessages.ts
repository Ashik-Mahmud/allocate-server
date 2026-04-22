import { NotificationType } from '@prisma/client';

export type BookingMessageAudience = 'STAFF' | 'ORG_ADMIN';

export type BookingMessageContext = {
    resourceName: string;
    requesterName?: string;
    actorName?: string;
    startTime?: string;
    endTime?: string;
    cancelReason?: string;
};

type BookingMessageFactory = (context: BookingMessageContext) => {
    title: string;
    message: string;
};

type BookingMessageAudienceMap = Partial<
    Record<BookingMessageAudience, BookingMessageFactory>
>;

const BookingMessages: Partial<Record<NotificationType, BookingMessageAudienceMap>> = {
    BOOKING_CONFIRMED: {
        STAFF: ({ resourceName }) => ({
            title: 'Booking Confirmed',
            message: `Your booking for ${resourceName} has been confirmed.`,
        }),
        ORG_ADMIN: ({ requesterName, resourceName }) => ({
            title: 'Booking Confirmed',
            message: `${requesterName || 'A staff member'} booking for ${resourceName} was confirmed.`,
        }),
    },
    BOOKING_REQUESTED: {
        STAFF: ({ resourceName }) => ({
            title: 'Booking Requested',
            message: `Your booking request for ${resourceName} has been received and is pending confirmation by your organization admin.`,
        }),
        ORG_ADMIN: ({ requesterName, resourceName }) => ({
            title: 'New Booking Action Required',
            message: `${requesterName || 'A staff member'} has requested a booking for ${resourceName}.`,
        }),
    },
    BOOKING_REJECTED: {
        STAFF: ({ resourceName, cancelReason }) => ({
            title: 'Booking Rejected',
            message: `Your booking request for ${resourceName} has been rejected.${cancelReason ? ` Reason: ${cancelReason}` : ''}`,
        }),
        ORG_ADMIN: ({ requesterName, resourceName, cancelReason }) => ({
            title: 'Booking Rejected',
            message: `Booking request by ${requesterName || 'a staff member'} for ${resourceName} was rejected.${cancelReason ? ` Reason: ${cancelReason}` : ''}`,
        }),
    },
    BOOKING_REMINDER: {
        STAFF: ({ resourceName, startTime }) => ({
            title: 'Booking Reminder',
            message: `Your booking for ${resourceName} is scheduled to start at ${startTime || 'the selected time'}.`,
        }),
    },
    BOOKING_CANCELLED: {
        STAFF: ({ resourceName, cancelReason }) => ({
            title: 'Booking Cancelled',
            message: `Your booking for ${resourceName} has been cancelled.${cancelReason ? ` Reason: ${cancelReason}` : ''}`,
        }),
        ORG_ADMIN: ({ requesterName, resourceName, cancelReason }) => ({
            title: 'Booking Cancelled',
            message: `Booking for ${resourceName} by ${requesterName || 'a staff member'} has been cancelled.${cancelReason ? ` Reason: ${cancelReason}` : ''}`,
        }),
    },
};

export const getBookingMessage = (
    type: NotificationType,
    audience: BookingMessageAudience,
    context: BookingMessageContext,
): { title: string; message: string } => {
    const messageFactory = BookingMessages[type]?.[audience] || BookingMessages[type]?.STAFF;

    if (messageFactory) {
        return messageFactory(context);
    }

    return {
        title: 'Booking Update',
        message: `Booking update for ${context.resourceName}.`,
    };
};