/*
  Warnings:

  - A unique constraint covering the columns `[currentBookingId]` on the table `resources` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_CHECKED_IN';

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "currentBookingId" TEXT,
ADD COLUMN     "is_occupied" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "resources_currentBookingId_key" ON "resources"("currentBookingId");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_currentBookingId_fkey" FOREIGN KEY ("currentBookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
