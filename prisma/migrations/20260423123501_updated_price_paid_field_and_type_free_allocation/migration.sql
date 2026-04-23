-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'FREE_ALLOCATION';

-- AlterTable
ALTER TABLE "credit_transactions" ADD COLUMN     "price_paid" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "system_settings" ALTER COLUMN "id" SET DEFAULT 'default';
