/*
  Warnings:

  - The values [CLIENT] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('STAFF', 'ADMIN', 'ORG_ADMIN');
ALTER TABLE "public"."invitations" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "invitations" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'ORG_ADMIN';
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'ORG_ADMIN';
COMMIT;

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'ORG_ADMIN';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'ORG_ADMIN';
