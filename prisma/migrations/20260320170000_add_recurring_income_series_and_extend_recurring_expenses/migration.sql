DO $$
BEGIN
  ALTER TYPE "ScheduledExpenseStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "recurring_incomes" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "amount_usd" DECIMAL(12,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_incomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recurring_incomes_project_id_key" ON "recurring_incomes"("project_id");
CREATE INDEX IF NOT EXISTS "recurring_incomes_is_active_start_date_idx" ON "recurring_incomes"("is_active", "start_date");
CREATE INDEX IF NOT EXISTS "recurring_incomes_is_active_end_date_idx" ON "recurring_incomes"("is_active", "end_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recurring_incomes_project_id_fkey'
  ) THEN
    ALTER TABLE "recurring_incomes"
    ADD CONSTRAINT "recurring_incomes_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "scheduled_payments"
ADD COLUMN IF NOT EXISTS "recurring_income_id" UUID;

CREATE INDEX IF NOT EXISTS "scheduled_payments_recurring_income_id_expected_date_idx"
ON "scheduled_payments"("recurring_income_id", "expected_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scheduled_payments_recurring_income_id_fkey'
  ) THEN
    ALTER TABLE "scheduled_payments"
    ADD CONSTRAINT "scheduled_payments_recurring_income_id_fkey"
    FOREIGN KEY ("recurring_income_id") REFERENCES "recurring_incomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "recurring_expenses"
ADD COLUMN IF NOT EXISTS "project_id" UUID,
ADD COLUMN IF NOT EXISTS "end_date" DATE,
ADD COLUMN IF NOT EXISTS "expense_type" "ExpenseType" NOT NULL DEFAULT 'fixed';

CREATE INDEX IF NOT EXISTS "recurring_expenses_project_id_is_active_idx" ON "recurring_expenses"("project_id", "is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recurring_expenses_project_id_fkey'
  ) THEN
    ALTER TABLE "recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
