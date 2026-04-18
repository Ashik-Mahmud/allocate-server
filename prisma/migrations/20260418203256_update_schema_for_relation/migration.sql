-- DropEnum
DROP TYPE "PayrollStatus";

-- CreateIndex
CREATE INDEX "organizations_name_id_idx" ON "organizations"("name", "id");

-- CreateIndex
CREATE INDEX "resources_org_id_idx" ON "resources"("org_id");

-- CreateIndex
CREATE INDEX "users_email_org_id_idx" ON "users"("email", "org_id");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
