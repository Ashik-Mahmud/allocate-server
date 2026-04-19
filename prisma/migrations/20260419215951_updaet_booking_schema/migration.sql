/*
  Warnings:

  - You are about to alter the column `total_cost` on the `bookings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.

*/
-- DropIndex
DROP INDEX "bookings_user_id_resource_id_org_id_idx";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "total_cost" DROP NOT NULL,
ALTER COLUMN "total_cost" SET DEFAULT 0,
ALTER COLUMN "total_cost" SET DATA TYPE INTEGER;

-- CreateIndex
CREATE INDEX "bookings_user_id_resource_id_org_id_status_idx" ON "bookings"("user_id", "resource_id", "org_id", "status");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
