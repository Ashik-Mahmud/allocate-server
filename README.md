# Allocate Backend API Documentation

Frontend integration guide for the Allocate backend (NestJS + Prisma + PostgreSQL).

## 1) Base URL And Tools

- Local base URL: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api`
- All endpoints are currently mounted without a global prefix.

## 2) Authentication

Use Bearer token for protected endpoints.

Header:

```http
Authorization: Bearer <access_token>
```

Auth tokens are issued from login/register/refresh endpoints.

## 3) Roles And Access

- `ADMIN`: Platform-level admin
- `ORG_ADMIN`: Organization admin
- `STAFF`: Staff user

Some endpoints are additionally guarded by:

- Email verification guard
- Subscription plan guard (FREE / PRO / ENTERPRISE)

## 4) Response Format

### Success

```json
{
   "success": true,
   "data": {},
   "timestamp": "2026-04-24T10:00:00.000Z"
}
```

### Paginated

```json
{
   "success": true,
   "data": [],
   "pagination": {
      "total": 120,
      "page": 1,
      "limit": 10,
      "totalPages": 12
   },
   "timestamp": "2026-04-24T10:00:00.000Z"
}
```

### Error

```json
{
   "success": false,
   "error": {
      "code": "Error",
      "message": "Something went wrong"
   },
   "timestamp": "2026-04-24T10:00:00.000Z"
}
```

## 5) Common Enums

### Role

- `ADMIN`
- `ORG_ADMIN`
- `STAFF`

### PlanType

- `FREE`
- `PRO`
- `ENTERPRISE`

### BookingStatus

- `PENDING`
- `CONFIRMED`
- `REJECTED`
- `CANCELLED`
- `COMPLETED`

### NotificationType

- `BOOKING_REQUESTED`
- `BOOKING_CONFIRMED`
- `BOOKING_REJECTED`
- `BOOKING_REMINDER`
- `BOOKING_CANCELLED`
- `CREDIT_RECEIVED`
- `CREDIT_REVOKED`
- `LOW_CREDIT_WARNING`
- `INVITATION_RECEIVED`
- `STAFF_JOINED`
- `SUBSCRIPTION_EXPIRING`
- `SUBSCRIPTION_EXPIRED`
- `SYSTEM_ALERT`
- `MAINTENANCE_NOTICE`

## 6) API Index

### Public

- `GET /`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh-token`
- `POST /auth/forgot-password`
- `GET /auth/verify?token=...`

### Authenticated

- Auth/Profile: `/auth/*`
- Organization: `/organization/*`
- Resources: `/resources/*`
- Bookings: `/bookings/*`
- Staff: `/staff/*`
- Inbox: `/inbox/*`
- Dashboard: `/dashboard/overview`
- Admin: `/admin/*`

## 7) Detailed Endpoint Documentation

## 7.1 Health

### GET /

- Access: Public
- Description: Basic health/hello endpoint.

## 7.2 Auth

### POST /auth/register

- Access: Public (rate-limited)
- Body:

```json
{
   "email": "admin@example.com",
   "password": "Aa123456",
   "name": "John Doe"
}
```

### POST /auth/login

- Access: Public (rate-limited)
- Body:

```json
{
   "email": "admin@example.com",
   "password": "Aa123456"
}
```

### POST /auth/refresh-token

- Access: Public
- Body:

```json
{
   "refreshToken": "<refresh_token>"
}
```

### POST /auth/forgot-password

- Access: Public
- Body:

```json
{
   "email": "admin@example.com"
}
```

### POST /auth/change-password

- Access: Authenticated
- Body:

```json
{
   "currentPassword": "OldPassword123",
   "newPassword": "NewPassword123"
}
```

### GET /auth/profile

- Access: Authenticated
- Description: Get current user profile.

### PATCH /auth/profile

- Access: Authenticated
- Body:

```json
{
   "name": "Updated Name",
   "photo": "https://cdn.example.com/avatar.jpg"
}
```

### POST /auth/send-verification-email

- Access: Authenticated
- Description: Sends verification email.

### GET /auth/verify

- Access: Public
- Query:
   - `token` (required)

### POST /auth/logout

- Access: Authenticated
- Description: Logout current user.

## 7.3 Organization

All organization endpoints require authentication.

### POST /organization/create

- Access: `ADMIN`
- Query:
   - `clientId` (required)
- Body:

```json
{
   "name": "Acme Workspace",
   "org_type": "Co-working",
   "tagline": "Flexible workspaces",
   "photo": "https://cdn.example.com/org.png",
   "plan_type": "FREE",
   "credit_pool": 100,
   "is_active": true
}
```

### PATCH /organization/profile/:id

- Access: `ORG_ADMIN`, `ADMIN`
- Query:
   - `clientId` (required)
- Body: same fields as create, all optional.

### GET /organization/profile/:id

- Access: `ORG_ADMIN`, `ADMIN`
- Query:
   - `clientId` (optional)

## 7.4 Resources

All resources endpoints require authentication and verified user.

### POST /resources/create

- Access: `ORG_ADMIN`
- Subscription: `FREE`, `PRO`, `ENTERPRISE`
- Body:

```json
{
   "name": "Meeting Room A",
   "type": "MEETING_ROOM",
   "hourly_rate": 25,
   "metadata": {
      "capacity": 8,
      "floor": 2
   },
   "is_available": true,
   "is_active": true,
   "is_maintenance": false
}
```

### PATCH /resources/update/:id

- Access: `ORG_ADMIN`
- Subscription: `FREE`, `PRO`, `ENTERPRISE`
- Body: same as create, all optional.

### PATCH /resources/delete/:id

- Access: `ORG_ADMIN`
- Subscription: `FREE`, `PRO`, `ENTERPRISE`

### GET /resources/list

- Access: `ORG_ADMIN`, `STAFF`
- Query:
   - `page` (default `1`)
   - `limit` (default `10`, max `100`)
   - `search`
   - `type`
   - `is_available` (`true|false`)
   - `is_active` (`true|false`)
   - `is_maintenance` (`true|false`)
   - `sortBy` (`name|hourly_rate|createdAt`)
   - `sortOrder` (`asc|desc`)

### GET /resources/:id

- Access: `ORG_ADMIN`, `STAFF`

### PATCH /resources/:id/rules

- Access: `ORG_ADMIN`
- Body:

```json
{
   "max_booking_hours": 4,
   "min_lead_time": 1,
   "buffer_time": 0.5,
   "opening_hours": 9,
   "closing_hours": 18,
   "slot_duration_min": 30,
   "is_weekend_allowed": false,
   "availableDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
}
```

## 7.5 Bookings

All bookings endpoints require authentication and verified user.

### POST /bookings/create

- Access: `STAFF`, `ORG_ADMIN`
- Body:

```json
{
   "resource_id": "resource_cuid",
   "start_time": "2026-05-01T10:00:00.000Z",
   "end_time": "2026-05-01T11:00:00.000Z",
   "notes": "Client meeting",
   "metadata": {
      "project": "alpha"
   }
}
```

### PATCH /bookings/status

- Access: `STAFF`, `ORG_ADMIN`
- Query:
   - `bookingId` (required)
   - `status` (`PENDING|CONFIRMED|REJECTED|CANCELLED|COMPLETED`)
- Body:

```json
{
   "cancellation_reason": "Optional reason when status=CANCELLED"
}
```

### GET /bookings/availability/:resourceId

- Access: `STAFF`, `ORG_ADMIN`
- Query:
   - `date` (required, format `YYYY-MM-DD`)

### GET /bookings/my-bookings

- Access: `STAFF`, `ORG_ADMIN`
- Query:
   - `status` (optional)
   - `page` (optional)
   - `limit` (optional)
   - `search` (optional)

### GET /bookings/all

- Access: `ORG_ADMIN`
- Query:
   - `status` (optional)
   - `page` (optional)
   - `limit` (optional)
   - `search` (optional)
   - `userId` (optional)
   - `resourceId` (optional)
   - `dateRange` (optional, e.g. `2026-01-01 to 2026-01-31`)

### GET /bookings/resource/:resourceId/calendar

- Access: `STAFF`, `ORG_ADMIN`
- Subscription: `PRO`, `ENTERPRISE`
- Query:
   - `month` (required, 1-12)
   - `year` (required)

### GET /bookings/stats

- Access: `ORG_ADMIN`
- Query:
   - `startDate` (optional)
   - `endDate` (optional)
   - `groupBy` (`day|week|month`, default `day`)

## 7.6 Staff

All staff endpoints require authentication, verified user, and org-admin context.

### POST /staff/create

- Access: `ORG_ADMIN`
- Body:

```json
{
   "email": "staff@example.com",
   "name": "Staff User",
   "password": "Aa123456",
   "photo": "https://cdn.example.com/staff.png"
}
```

### GET /staff/list

- Access: `ORG_ADMIN`
- Query:
   - `page`
   - `limit`
   - `search`
   - `email`
   - `org_id`

### GET /staff/:id

- Access: `ORG_ADMIN`
- Path:
   - `id`

### PATCH /staff/:id

- Access: `ORG_ADMIN`
- Path:
   - `id`
- Body:

```json
{
   "email": "staff@example.com",
   "name": "Updated Staff",
   "password": "NewStrongPass1",
   "photo": "https://cdn.example.com/new.png"
}
```

### PATCH /staff/:id/delete

- Access: `ORG_ADMIN`
- Path:
   - `id`

### POST /staff/:id/credits

- Access: `ORG_ADMIN`
- Path:
   - `id`
- Body:

```json
{
   "credits": 100
}
```

### POST /staff/credits

- Access: `ORG_ADMIN`
- Body:

```json
{
   "staffCredits": [
      {
         "staff_id": "staff_cuid_1",
         "credits": 50
      },
      {
         "staff_id": "staff_cuid_2",
         "credits": 30
      }
   ]
}
```

### POST /staff/:id/credits/revoke

- Access: `ORG_ADMIN`
- Path:
   - `id`
- Body:

```json
{
   "credits": 20
}
```

### GET /staff/credits/logs

- Access: `ORG_ADMIN`
- Subscription: `PRO`, `ENTERPRISE`
- Query:
   - `page`
   - `limit`
   - `search`

## 7.7 Inbox

All inbox endpoints require authentication.

### GET /inbox/notifications

- Query:
   - `page` (optional)
   - `limit` (optional)

### PATCH /inbox/notifications/:id/read

- Path:
   - `id`

### PATCH /inbox/notifications/read-all

- Description: Mark all notifications as read.

### DELETE /inbox/notifications/:id/delete

- Path:
   - `id`

### DELETE /inbox/notifications/clear

- Description: Delete all notifications for current user.

### GET /inbox/notifications/unread-count

- Description: Returns unread notifications count.

## 7.8 Dashboard

### GET /dashboard/overview

- Access: Authenticated
- Behavior: Returns role-specific dashboard payload for `ADMIN`, `ORG_ADMIN`, or `STAFF`.

## 7.9 Admin

All admin endpoints require `ADMIN` role.

### PATCH /admin/system-settings

- Body:

```json
{
   "maintenance_mode": false,
   "global_alert_message": {
      "title": "Maintenance",
      "message": "Scheduled maintenance tonight"
   },
   "support_email": "support@example.com",
   "features_flags": {
      "newDashboard": true
   }
}
```

### GET /admin/system-settings

- Description: Fetch system settings.

### POST /admin/announcements

- Body:

```json
{
   "title": "Important Update",
   "message": "System update completed",
   "userIds": ["optional_user_id"],
   "type": "SYSTEM_ALERT",
   "metadata": {
      "source": "admin"
   },
   "receiverType": "ALL"
}
```

### GET /admin/organizations

- Query:
   - `organizationId`
   - `name`
   - `verified`
   - `search`
   - `page`
   - `limit`

### GET /admin/organizations/:orgId

- Path:
   - `orgId`

### PATCH /admin/organizations/:orgId/verification

- Path:
   - `orgId`
- Body:

```json
{
   "verified": true
}
```

### PATCH /admin/organizations/:orgId/credits

- Path:
   - `orgId`
- Body:

```json
{
   "amount": 100,
   "price": 1000
}
```

### GET /admin/users

- Query:
   - `organizationId`
   - `name`
   - `email`
   - `role` (`STAFF|ADMIN`)
   - `search`
   - `page`
   - `limit`

### PATCH /admin/users/:userId/reset-password

- Path:
   - `userId`

### GET /admin/subscriptions/transactions

- Query:
   - `organizationId`
   - `startDate`
   - `endDate`
   - `type`
   - `page`
   - `limit`

### GET /admin/analytics/revenue

- Query:
   - `startDate` (optional)
   - `endDate` (optional)
   - `groupBy` (`day|week|month`)
   - `organizationId` (optional)
- Response includes:
   - Revenue summary
   - Free/Pro/Enterprise subscriber counts
   - Grouped revenue timeline
   - Revenue by plan

### GET /admin/users/:userId/activity-logs

- Path:
   - `userId`
- Query:
   - `startDate`
   - `endDate`
   - `page`
   - `limit`

## 8) Frontend Integration Notes

1. Always send Bearer token for non-public endpoints.
2. Use a centralized API client that unwraps `success/data/pagination/error`.
3. Reuse enum constants in frontend from this README to avoid invalid values.
4. For paginated endpoints, read `pagination.totalPages` and `pagination.total` from response.
5. Keep date values in ISO format when sending filters.

## 9) Known Contract Notes

1. Some controllers have decorator inconsistencies between path params and query extraction in implementation.
2. Frontend should follow the documented route path and query signatures above.
3. If anything differs during testing, use Swagger as runtime source of truth for that environment.

## 10) Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL
- pnpm

### Setup

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm db:seed
pnpm start:dev
```

### Useful Scripts

- `pnpm start:dev`
- `pnpm build`
- `pnpm test`
- `pnpm prisma:migrate`
- `pnpm prisma:studio`
- `pnpm db:seed`
