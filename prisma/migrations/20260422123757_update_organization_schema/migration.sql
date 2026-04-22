/*
  Warnings:

  - You are about to alter the column `amount` on the `credit_transactions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `previousBalance` on the `credit_transactions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `currentBalance` on the `credit_transactions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "credit_transactions" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "previousBalance" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "currentBalance" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "isVerified" BOOLEAN DEFAULT false,
ADD COLUMN     "settings" JSONB;
