-- CreateEnum
CREATE TYPE "SaleInquiryStatus" AS ENUM ('PENDING', 'CONTACTED', 'CLOSED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'SSLCOMMERZ');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONTACT_SALES';

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "last_transaction_id" TEXT,
ADD COLUMN     "provider" "PaymentProvider";

-- CreateTable
CREATE TABLE "sales_inquiries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "name" TEXT NOT NULL,
    "business_email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "team_size" INTEGER,
    "country" TEXT,
    "status" "SaleInquiryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_inquiries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sales_inquiries" ADD CONSTRAINT "sales_inquiries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
