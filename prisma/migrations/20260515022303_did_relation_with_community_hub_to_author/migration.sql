-- AddForeignKey
ALTER TABLE "community_hub" ADD CONSTRAINT "community_hub_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
