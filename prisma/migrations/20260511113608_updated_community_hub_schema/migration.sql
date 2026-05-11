-- AlterEnum
ALTER TYPE "CommunityHubPostType" ADD VALUE 'SYSTEM_QUERY';

-- AlterTable
ALTER TABLE "community_hub" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibility" JSONB DEFAULT '{"showToStaff": true, "showToOrgAdmin": true, "showToAdmin": true}';
