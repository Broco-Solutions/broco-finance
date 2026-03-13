/*
  Warnings:

  - You are about to drop the column `type` on the `incomes` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "IncomeStatus" AS ENUM ('PAID', 'PENDING');

-- DropIndex
DROP INDEX "incomes_type_date_idx";

-- AlterTable
ALTER TABLE "incomes" DROP COLUMN "type",
ADD COLUMN     "status" "IncomeStatus" NOT NULL DEFAULT 'PAID';

-- DropEnum
DROP TYPE "IncomeType";

-- CreateIndex
CREATE INDEX "incomes_status_date_idx" ON "incomes"("status", "date");
