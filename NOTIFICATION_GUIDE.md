# Notification Management Guide

## Overview

The notification system provides a centralized way to send notifications through multiple channels (email, in-app, SMS, push) based on organization preferences.

**Key Features:**
- ✅ Single place to manage all notification channels
- ✅ Respects organization notification preferences
- ✅ Automatic routing to enabled channels
- ✅ Email templates support
- ✅ Easy integration with existing modules
- ✅ Future-proof for SMS and push notifications

---

## Organization Settings

Notifications are configured in the `organizations.settings` JSON field:

```json
{
  "notificationPreference": {
    "email": true,
    "inApp": true,
    "sms": false,
    "push": false
  }
}
```

**Supported Channels:**
- `email` - Email notifications (default: true)
- `inApp` - In-app inbox notifications (default: true)
- `sms` - SMS messages (default: false, future)
- `push` - Push notifications (default: false, future)

---

## Usage

### 1. Import NotificationManager in Your Module

First, make sure your module imports `InboxModule`:

```typescript
// booking.module.ts
import { Module } from '@nestjs/common';
import { InboxModule } from 'src/modules/inbox/inbox.module';

@Module({
  imports: [InboxModule],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
```

### 2. Inject and Use in Your Service

```typescript
// booking.service.ts
import { Injectable } from '@nestjs/common';
import { NotificationManager } from 'src/modules/inbox/service/notification-manager.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private notificationManager: NotificationManager,
  ) {}

  async createBooking(data: CreateBookingDto, user: UserPayload) {
    // Create booking logic...
    const booking = await this.prisma.bookings.create({
      data: {
        user_id: data.userId,
        org_id: user.org_id,
        resource_id: data.resourceId,
        start_time: new Date(data.startTime),
        end_time: new Date(data.endTime),
      },
      include: {
        user: true,
        organization: true,
      },
    });

    // Send notification (simple way)
    await this.notificationManager.send({
      userId: booking.user_id,
      orgId: booking.org_id,
      userEmail: booking.user.email,
      userName: booking.user.name,
      type: 'BOOKING_CONFIRMED' as NotificationType,
      title: 'Booking Confirmed',
      message: `Your booking for ${booking.resource_id} is confirmed`,
      referenceId: booking.id,
      emailSubject: 'Your Booking is Confirmed',
    });

    return booking;
  }
}
```

### 3. Send with Custom Email Template

```typescript
await this.notificationManager.send({
  userId: user.id,
  orgId: org.id,
  userEmail: user.email,
  userName: user.name,
  type: 'BOOKING_CONFIRMED',
  title: 'Booking Confirmed',
  message: 'Your booking has been confirmed',
  referenceId: booking.id,
  emailSubject: 'Your Booking is Confirmed',
  emailTemplate: `
    <h2>Hello ${user.name},</h2>
    <p>Your booking has been confirmed!</p>
    <p><strong>Booking Details:</strong></p>
    <ul>
      <li>Resource: ${booking.resource_id}</li>
      <li>Start: ${booking.start_time}</li>
      <li>End: ${booking.end_time}</li>
      <li>Total Cost: $${booking.total_cost}</li>
    </ul>
  `,
});
```

### 4. Send to Multiple Users

```typescript
const users = await this.prisma.user.findMany({
  where: { org_id: orgId },
});

const notifications = users.map((user) => ({
  userId: user.id,
  orgId: orgId,
  userEmail: user.email,
  userName: user.name,
  type: 'ANNOUNCEMENT' as NotificationType,
  title: 'System Announcement',
  message: 'System maintenance scheduled for tonight',
  emailSubject: 'System Announcement',
}));

const results = await this.notificationManager.sendBatch(notifications);
console.log('Batch results:', results);
```

---

## API Reference

### NotificationManager.send()

Sends notification through all enabled channels.

**Parameters:**
```typescript
interface NotificationPayload {
  userId: string;                    // Required: Target user ID
  orgId: string;                     // Required: Organization ID
  userEmail: string;                 // Required: User email
  userName: string;                  // Required: User name
  type: NotificationType;            // Required: Notification type (enum)
  title: string;                     // Required: Notification title
  message: string;                   // Required: Notification message
  referenceId?: string;              // Optional: Link to booking/transaction ID
  metadata?: Record<string, any>;    // Optional: Additional data
  emailSubject?: string;             // Optional: Email subject (defaults to title)
  emailTemplate?: string;            // Optional: HTML email template
  smsContent?: string;               // Optional: SMS text content
  pushTitle?: string;                // Optional: Push notification title
  pushBody?: string;                 // Optional: Push notification body
}
```

**Returns:**
```typescript
interface NotificationDispatchResult {
  inApp: { sent: boolean; id?: string; error?: string };
  email: { sent: boolean; id?: string; error?: string };
  sms: { sent: boolean; id?: string; error?: string };
  push: { sent: boolean; id?: string; error?: string };
}
```

**Example:**
```typescript
const result = await this.notificationManager.send({
  userId: 'user-123',
  orgId: 'org-456',
  userEmail: 'john@example.com',
  userName: 'John Doe',
  type: 'BOOKING_CONFIRMED',
  title: 'Booking Confirmed',
  message: 'Your booking is confirmed',
});

console.log(result);
// Output:
// {
//   inApp: { sent: true, id: 'notif-id' },
//   email: { sent: true, id: 'email_1234567890' },
//   sms: { sent: false, error: 'SMS service not yet implemented' },
//   push: { sent: false, error: 'Push service not yet implemented' }
// }
```

### NotificationManager.sendBatch()

Sends multiple notifications efficiently.

### NotificationManager.getInboxMessages()

Get all notifications for a user.

```typescript
const messages = await this.notificationManager.getInboxMessages(userId);
```

### NotificationManager.markAsRead()

Mark a notification as read.

```typescript
await this.notificationManager.markAsRead(notificationId);
```

### NotificationManager.markAllAsRead()

Mark all notifications as read for a user.

```typescript
await this.notificationManager.markAllAsRead(userId);
```

### NotificationManager.getUnreadCount()

Get unread notification count.

```typescript
const count = await this.notificationManager.getUnreadCount(userId);
```

### NotificationManager.deleteNotification()

Delete a notification.

```typescript
await this.notificationManager.deleteNotification(notificationId);
```

---

## Organization Preference Examples

### Example 1: Email Only

```json
{
  "notificationPreference": {
    "email": true,
    "inApp": false,
    "sms": false,
    "push": false
  }
}
```

When calling `send()`, only email will be sent. In-app, SMS, and push will be skipped.

### Example 2: All Channels Enabled

```json
{
  "notificationPreference": {
    "email": true,
    "inApp": true,
    "sms": true,
    "push": true
  }
}
```

All channels will attempt to send (SMS and push pending implementation).

### Example 3: In-App Only

```json
{
  "notificationPreference": {
    "email": false,
    "inApp": true,
    "sms": false,
    "push": false
  }
}
```

Only in-app notifications will be created.

---

## Adding New Channels (Future)

When you're ready to add SMS or push notifications:

### 1. Create the Service

```typescript
// inbox/service/sms.service.ts
@Injectable()
export class SMSService {
  async sendSMS(phoneNumber: string, message: string) {
    // Implement SMS sending logic (e.g., Twilio)
  }
}
```

### 2. Update NotificationDispatcher

```typescript
// utils/notification-dispatcher.ts
private static async sendSMS(
  payload: NotificationPayload,
  smsService: any,
) {
  try {
    if (!smsService) {
      return { sent: false, error: 'SMS service not configured' };
    }

    const result = await smsService.sendSMS(
      payload.phoneNumber,
      payload.smsContent || payload.message,
    );

    return { sent: result.success, id: result.messageId };
  } catch (error: any) {
    return { sent: false, error: error.message };
  }
}
```

### 3. Update NotificationManager

```typescript
// inbox/service/notification-manager.service.ts
constructor(
  private prisma: PrismaService,
  private emailService: EmailService,
  private smsService: SMSService, // Add this
) {}

const services = {
  inboxService: this,
  emailService: this.emailService,
  smsService: this.smsService, // Add this
  pushService: null,
};
```

### 4. Update InboxModule

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [InboxController],
  providers: [InboxService, EmailService, SMSService, NotificationManager],
  exports: [EmailService, SMSService, NotificationManager],
})
export class InboxModule {}
```

---

## NotificationTypes

The `NotificationType` enum should be updated in your Prisma schema as needed:

```prisma
enum NotificationType {
  BOOKING_CONFIRMED
  BOOKING_CANCELLED
  PAYMENT_RECEIVED
  PAYMENT_FAILED
  STAFF_INVITED
  PROFILE_UPDATED
  ANNOUNCEMENT
  REMINDER
  ALERT
  // Add more as needed...
}
```

---

## Testing

### Using Curl

```bash
# Login first
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get your notifications
curl -X GET http://localhost:3000/api/v1/inbox \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### In Service Tests

```typescript
describe('NotificationManager', () => {
  it('should send notification through all enabled channels', async () => {
    const result = await notificationManager.send({
      userId: 'test-user',
      orgId: 'test-org',
      userEmail: 'test@example.com',
      userName: 'Test User',
      type: 'BOOKING_CONFIRMED',
      title: 'Booking Confirmed',
      message: 'Test message',
    });

    expect(result.inApp.sent).toBe(true);
    expect(result.email.sent).toBe(true);
  });

  it('should respect organization preferences', async () => {
    // Mock org with email disabled
    const result = await notificationManager.send({...});

    expect(result.email.sent).toBe(false);
  });
});
```

---

## Common Patterns

### Pattern 1: Send on Resource Creation

```typescript
async createResource(createResourceDto: CreateResourceDto) {
  const resource = await this.prisma.resources.create({
    data: createResourceDto,
    include: { organization: true },
  });

  // Notify all admins
  const admins = await this.prisma.user.findMany({
    where: { org_id: resource.org_id, role: 'ORG_ADMIN' },
  });

  for (const admin of admins) {
    await this.notificationManager.send({
      userId: admin.id,
      orgId: resource.org_id,
      userEmail: admin.email,
      userName: admin.name,
      type: 'RESOURCE_CREATED',
      title: 'New Resource Created',
      message: `Resource "${resource.name}" has been added`,
      referenceId: resource.id,
    });
  }

  return resource;
}
```

### Pattern 2: Send on Status Change

```typescript
async updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
) {
  const booking = await this.prisma.bookings.update({
    where: { id: bookingId },
    data: { status },
    include: { user: true, organization: true },
  });

  const statusMessages = {
    CONFIRMED: 'Your booking has been confirmed',
    CANCELLED: 'Your booking has been cancelled',
    COMPLETED: 'Your booking is complete',
  };

  await this.notificationManager.send({
    userId: booking.user_id,
    orgId: booking.org_id,
    userEmail: booking.user.email,
    userName: booking.user.name,
    type: 'BOOKING_STATUS_CHANGED',
    title: `Booking ${status}`,
    message: statusMessages[status],
    referenceId: booking.id,
  });

  return booking;
}
```

---

## Troubleshooting

### Email not sending?

1. Check organization settings: `notificationPreference.email === true`
2. Verify email service is configured correctly
3. Check email templates exist
4. Review error logs in dispatch result

### Notifications not appearing?

1. Verify `inApp` preference is enabled
2. Check database connection
3. Ensure notification is being persisted to database
4. Check user ID is correct

### Performance issues with batch sends?

Use `sendBatch()` for multiple users:

```typescript
// Bad: Multiple sequential calls
for (const user of users) {
  await notificationManager.send({...});
}

// Good: Batch send
await notificationManager.sendBatch(users.map(user => ({...})));
```

---

## Summary

The notification system centralizes all notification logic in one place:

- **NotificationDispatcher** - Handles routing logic
- **NotificationManager** - High-level API for other modules
- **Organization Settings** - Controls which channels are enabled
- **Extensible** - Easy to add SMS, push, or other channels later

Just inject `NotificationManager` in any service and call `send()` with your notification data. The system handles everything else!
