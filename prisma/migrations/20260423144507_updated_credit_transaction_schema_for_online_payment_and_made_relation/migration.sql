-- AlterTable
ALTER TABLE "credit_transactions" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "payment_gateway" TEXT,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "transaction_id" TEXT;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
