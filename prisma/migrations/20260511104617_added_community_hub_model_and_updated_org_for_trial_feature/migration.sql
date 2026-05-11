-- CreateEnum
CREATE TYPE "CommunityHubPostType" AS ENUM ('ANNOUNCEMENT', 'RESOURCE_SPOTLIGHT', 'USER_STORY', 'EVENT', 'ISSUES', 'RESOLVED', 'GENERAL_DISCUSSION', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunityHubStatus" AS ENUM ('PUBLISHED', 'DRAFT', 'ARCHIVED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTrialAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialStartAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "community_hub" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "authorId" TEXT,
    "authorName" TEXT,
    "authorRole" "Role",
    "comments" JSONB,
    "status" "CommunityHubStatus" NOT NULL DEFAULT 'DRAFT',
    "postType" "CommunityHubPostType" NOT NULL DEFAULT 'GENERAL_DISCUSSION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_hub_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "community_hub" ADD CONSTRAINT "community_hub_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
