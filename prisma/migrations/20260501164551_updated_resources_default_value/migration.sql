-- AlterTable
ALTER TABLE "resources" ALTER COLUMN "is_available" SET DEFAULT true,
ALTER COLUMN "is_active" SET DEFAULT true,
ALTER COLUMN "is_maintenance" SET DEFAULT false;
