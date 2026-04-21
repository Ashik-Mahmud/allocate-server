-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'CREDIT_REVOKED';
ALTER TYPE "NotificationType" ADD VALUE 'LOW_CREDIT_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_JOINED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_EXPIRING';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'MAINTENANCE_NOTICE';
