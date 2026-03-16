-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('DEVELOPMENT', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "incomes"
ADD COLUMN "income_type" "IncomeType" NOT NULL DEFAULT 'DEVELOPMENT';

-- Backfill recurrent collections as maintenance income when they were generated from scheduled payments.
UPDATE "incomes" AS income
SET "income_type" = 'MAINTENANCE'
FROM "scheduled_payments" AS payment
WHERE payment."actual_income_id" = income."id"
  AND payment."recurring_contract_id" IS NOT NULL;

-- Preserve the existing development budget while renaming the column.
ALTER TABLE "projects"
RENAME COLUMN "total_budget_usd" TO "dev_budget_usd";

ALTER TABLE "projects"
ADD COLUMN "monthly_fee_usd" DECIMAL(12,2);
