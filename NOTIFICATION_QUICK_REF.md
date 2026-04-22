# Notification System - Quick Reference & Integration Checklist

## 🎯 Quick Reference

### Send a Notification (30 seconds)

```typescript
// Step 1: Import module in your module file
import { InboxModule } from 'src/modules/inbox/inbox.module';

@Module({
  imports: [InboxModule],
  // ...
})
export class BookingModule {}

// Step 2: Inject in your service
constructor(private notificationManager: NotificationManager) {}

// Step 3: Send
await this.notificationManager.send({
  userId: user.id,
  orgId: org.id,
  userEmail: user.email,
  userName: user.name,
  type: 'BOOKING_CONFIRMED',
  title: 'Booking Confirmed',
  message: 'Your booking is confirmed',
});
```

That's it! ✨

---

## 📋 Integration Checklist

### For Each Module That Sends Notifications

- [ ] Add `InboxModule` to imports
- [ ] Inject `NotificationManager` in service
- [ ] Call `send()` with required fields
- [ ] Add optional email template for better UX
- [ ] Test with organization email enabled/disabled

### Required Notification Payload Fields

```typescript
{
  userId: string;           // Who receives it
  orgId: string;            // Which org setting to use
  userEmail: string;        // For email channel
  userName: string;         // Personalization
  type: NotificationType;   // Enum value
  title: string;            // Notification title
  message: string;          // Main content
}
```

### Optional Fields (Recommended)

```typescript
{
  referenceId?: string;          // Link to booking/transaction/etc
  emailSubject?: string;         // Email subject line
  emailTemplate?: string;        // HTML for email
  metadata?: Record<string, any> // Additional data
}
```

---

## 🔧 Common Tasks

### Task: Add Notification to Booking Creation

```typescript
async createBooking(data: CreateBookingDto, user: UserPayload) {
  const booking = await this.prisma.bookings.create({
    data: { /* ... */ },
    include: { user: true }
  });

  // Add this
  await this.notificationManager.send({
    userId: booking.user_id,
    orgId: user.org_id,
    userEmail: booking.user.email,
    userName: booking.user.name,
    type: 'BOOKING_CREATED',
    title: 'Booking Created',
    message: `You've created a new booking`,
    referenceId: booking.id,
  });

  return booking;
}
```

### Task: Notify Multiple Users (Batch)

```typescript
// Get all admins
const admins = await this.prisma.user.findMany({
  where: { org_id: orgId, role: 'ORG_ADMIN' }
});

// Create notification for each
const notifications = admins.map(admin => ({
  userId: admin.id,
  orgId,
  userEmail: admin.email,
  userName: admin.name,
  type: 'ALERT',
  title: 'System Alert',
  message: 'Important update needed',
}));

// Send all at once
await this.notificationManager.sendBatch(notifications);
```

### Task: Add Email Template

```typescript
await this.notificationManager.send({
  userId: user.id,
  orgId: org.id,
  userEmail: user.email,
  userName: user.name,
  type: 'BOOKING_CONFIRMED',
  title: 'Booking Confirmed',
  message: 'Your booking is confirmed',
  emailSubject: 'Your Booking is Confirmed! ✓',
  emailTemplate: `
    <h2>Hello ${user.name},</h2>
    <p>Your booking has been confirmed!</p>
    <p><strong>Booking ID:</strong> ${booking.id}</p>
    <p><strong>Date:</strong> ${booking.start_time.toLocaleDateString()}</p>
  `,
});
```

### Task: Check Organization Settings

```typescript
const org = await this.prisma.organizations.findUnique({
  where: { id: orgId },
  select: { settings: true }
});

// Access preferences
const prefs = org?.settings?.notificationPreference;
console.log('Email enabled:', prefs?.email !== false);
console.log('InApp enabled:', prefs?.inApp !== false);
```

### Task: Update Organization Preferences

```typescript
await this.prisma.organizations.update({
  where: { id: orgId },
  data: {
    settings: {
      notificationPreference: {
        email: true,
        inApp: true,
        sms: false,
        push: false
      }
    }
  }
});
```

---

## 📂 File Structure

```
src/
├── utils/
│   └── notification-dispatcher.ts       ← Core routing logic
├── modules/
│   ├── inbox/
│   │   ├── service/
│   │   │   ├── inbox.service.ts
│   │   │   ├── email.service.ts
│   │   │   └── notification-manager.service.ts  ← Main API
│   │   ├── controller/
│   │   ├── templates/
│   │   ├── utils/
│   │   └── inbox.module.ts
│   ├── bookings/
│   │   └── NOTIFICATION_EXAMPLE.ts     ← Reference examples
│   └── [other modules]/
├── NOTIFICATION_GUIDE.md               ← Full documentation
└── NOTIFICATION_EXAMPLE.ts             ← Implementation examples
```

---

## 🚀 Frequently Used Methods

### Send Single Notification
```typescript
await this.notificationManager.send(payload);
// Returns: NotificationDispatchResult
```

### Send Multiple Notifications
```typescript
await this.notificationManager.sendBatch(payloads);
// Returns: NotificationDispatchResult[]
```

### Get User's Inbox
```typescript
const messages = await this.notificationManager.getInboxMessages(userId);
```

### Mark as Read
```typescript
await this.notificationManager.markAsRead(notificationId);
await this.notificationManager.markAllAsRead(userId);
```

### Get Unread Count
```typescript
const count = await this.notificationManager.getUnreadCount(userId);
```

### Delete Notification
```typescript
await this.notificationManager.deleteNotification(notificationId);
```

---

## ⚙️ Configuration

### Currently Supported Channels

| Channel | Status | Implementation |
|---------|--------|-----------------|
| In-App  | ✅ Done | Stored in DB, real-time via Socket.io |
| Email   | ✅ Done | Via EmailService (SendGrid/SMTP) |
| SMS     | ⏳ Future | Placeholder ready for Twilio/etc |
| Push    | ⏳ Future | Placeholder ready for Firebase/etc |

### Organization Settings Schema

```json
{
  "notificationPreference": {
    "email": true,      // Send via email
    "inApp": true,      // Send to inbox
    "sms": false,       // Send SMS (future)
    "push": false       // Send push (future)
  }
}
```

---

## 🧪 Testing Notification

### Via API

```bash
# 1. Create a booking (triggers notification)
curl -X POST http://localhost:3000/api/v1/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "res-123",
    "startTime": "2026-05-01T10:00:00Z",
    "endTime": "2026-05-01T11:00:00Z"
  }'

# 2. Check inbox
curl -X GET http://localhost:3000/api/v1/inbox \
  -H "Authorization: Bearer $TOKEN"

# 3. Check unread count
curl -X GET http://localhost:3000/api/v1/inbox/unread-count \
  -H "Authorization: Bearer $TOKEN"
```

### Via Service Test

```typescript
describe('NotificationManager', () => {
  it('should send notification', async () => {
    const result = await notificationManager.send({
      userId: 'user-1',
      orgId: 'org-1',
      userEmail: 'user@test.com',
      userName: 'Test User',
      type: 'BOOKING_CONFIRMED',
      title: 'Test',
      message: 'Test message',
    });

    expect(result.inApp.sent).toBe(true);
    expect(result.inApp.id).toBeDefined();
  });
});
```

---

## 🐛 Troubleshooting

### Email not sending
- Check: `notificationPreference.email === true` in org settings
- Check: Email service is configured correctly
- Check: User email is valid

### No in-app notification
- Check: `notificationPreference.inApp !== false` in org settings
- Check: User ID is correct
- Check: org ID is correct

### Dispatch result shows errors
- Check: Individual channel errors in dispatch result
- Some channels may fail while others succeed
- This is expected behavior (graceful degradation)

### Performance issues with many notifications
- Use `sendBatch()` instead of sending in a loop
- Example:
  ```typescript
  // ❌ Slow
  for (const user of users) {
    await notificationManager.send({...});
  }
  
  // ✅ Fast
  await notificationManager.sendBatch(users.map(u => ({...})));
  ```

---

## 📞 Key Takeaways

1. **One method to rule them all**: Just call `send()` with notification data
2. **Automatic routing**: System checks org preferences and routes accordingly
3. **Easy expansion**: Add SMS/push without changing existing code
4. **Type-safe**: Full TypeScript support with interfaces
5. **Error resilient**: Each channel fails independently
6. **Batch support**: Efficiently send to multiple users

---

## 🔗 Related Files

- **Main Guide**: `NOTIFICATION_GUIDE.md`
- **Examples**: `src/modules/bookings/NOTIFICATION_EXAMPLE.ts`
- **Dispatcher**: `src/utils/notification-dispatcher.ts`
- **Manager**: `src/modules/inbox/service/notification-manager.service.ts`

---

## Questions?

Refer to `NOTIFICATION_GUIDE.md` for:
- Complete API reference
- Advanced patterns
- Integration examples
- Future extensibility guide
