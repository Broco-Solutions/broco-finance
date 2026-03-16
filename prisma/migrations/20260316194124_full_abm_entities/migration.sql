/*
  Warnings:

  - The values [active,finished,cancelled] on the enum `ProjectStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProjectStatus_new" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."projects" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "projects"
ALTER COLUMN "status" TYPE "ProjectStatus_new"
USING (
  CASE "status"::text
    WHEN 'active' THEN 'ACTIVE'
    WHEN 'finished' THEN 'COMPLETED'
    WHEN 'cancelled' THEN 'CANCELLED'
    ELSE "status"::text
  END
)::"ProjectStatus_new";
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "public"."ProjectStatus_old";
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_name" TEXT,
ADD COLUMN     "contact_phone" TEXT;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
