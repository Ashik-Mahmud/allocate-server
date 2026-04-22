-- DropIndex
DROP INDEX "notifications_user_id_org_id_idx";

-- CreateIndex
CREATE INDEX "notifications_user_id_org_id_is_read_idx" ON "notifications"("user_id", "org_id", "is_read");
