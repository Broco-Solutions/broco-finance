-- Adjust monetary consistency constraints to use a sub-micro-unit tolerance.
-- PostgreSQL NUMERIC arithmetic may produce values that differ from Prisma.Decimal
-- at the 6th decimal place. A tolerance of 0.000001 (one micro-unit) accommodates
-- this while rejecting genuine inconsistencies.
-- The canonical formula remains: amountUsd = round(amountArs / exchangeRate, 6)
-- when computed with the same arithmetic implementation.

-- Income
ALTER TABLE "incomes" DROP CONSTRAINT IF EXISTS "chk_income_monetary_consistency";
ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_monetary_consistency"
  CHECK (
    "amount_ars" IS NULL
    OR "exchange_rate" IS NULL
    OR ABS(("amount_ars" / "exchange_rate") - "amount_usd") < 0.00001
  );

-- Expense
ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "chk_expense_monetary_consistency";
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_monetary_consistency"
  CHECK (
    "amount_ars" IS NULL
    OR "exchange_rate" IS NULL
    OR ABS(("amount_ars" / "exchange_rate") - "amount_usd") < 0.00001
  );

-- Project one-time
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "chk_project_one_time_ars_consistency";
ALTER TABLE "projects" ADD CONSTRAINT "chk_project_one_time_ars_consistency"
  CHECK (
    "one_time_currency" IS NULL
    OR "one_time_currency" != 'ARS'
    OR "one_time_exchange_rate" IS NULL
    OR ABS(("one_time_original_amount" / "one_time_exchange_rate") - "one_time_amount_usd") < 0.00001
  );

-- Project monthly
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "chk_project_monthly_ars_consistency";
ALTER TABLE "projects" ADD CONSTRAINT "chk_project_monthly_ars_consistency"
  CHECK (
    "monthly_recurring_currency" IS NULL
    OR "monthly_recurring_currency" != 'ARS'
    OR "monthly_recurring_exchange_rate" IS NULL
    OR ABS(("monthly_recurring_original_amount" / "monthly_recurring_exchange_rate") - "monthly_recurring_amount_usd") < 0.00001
  );
