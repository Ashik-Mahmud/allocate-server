-- AlterTable
ALTER TABLE "resources_rules" ADD COLUMN     "availableDays" JSONB DEFAULT '[]',
ADD COLUMN     "closing_hours" INTEGER DEFAULT 18,
ADD COLUMN     "is_weekend_allowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opening_hours" INTEGER DEFAULT 9,
ADD COLUMN     "slot_duration_min" INTEGER NOT NULL DEFAULT 30,
ALTER COLUMN "max_booking_hours" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "min_lead_time" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "buffer_time" SET DATA TYPE DOUBLE PRECISION;
