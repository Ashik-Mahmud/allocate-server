-- AlterTable
ALTER TABLE "community_hub" ADD COLUMN     "allowComments" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "community_hub_org_id_authorId_status_postType_idx" ON "community_hub"("org_id", "authorId", "status", "postType");

-- CreateIndex
CREATE INDEX "sales_inquiries_org_id_business_email_status_idx" ON "sales_inquiries"("org_id", "business_email", "status");
