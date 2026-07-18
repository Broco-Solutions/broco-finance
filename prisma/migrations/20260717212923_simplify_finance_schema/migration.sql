-- ============================================================
-- DROP OLD SCHEMA
-- ============================================================

DROP TABLE IF EXISTS "kanban_project_placements" CASCADE;
DROP TABLE IF EXISTS "kanban_columns" CASCADE;
DROP TABLE IF EXISTS "scheduled_expenses" CASCADE;
DROP TABLE IF EXISTS "scheduled_payments" CASCADE;
DROP TABLE IF EXISTS "recurring_expenses" CASCADE;
DROP TABLE IF EXISTS "recurring_incomes" CASCADE;
DROP TABLE IF EXISTS "salary_withdrawals" CASCADE;
DROP TABLE IF EXISTS "distribution_config" CASCADE;
DROP TABLE IF EXISTS "expenses" CASCADE;
DROP TABLE IF EXISTS "incomes" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;
DROP TABLE IF EXISTS "expense_categories" CASCADE;
DROP TABLE IF EXISTS "clients" CASCADE;

DROP TYPE IF EXISTS "ProjectStatus" CASCADE;
DROP TYPE IF EXISTS "ContractFrequency" CASCADE;
DROP TYPE IF EXISTS "ScheduledPaymentStatus" CASCADE;
DROP TYPE IF EXISTS "DistributionLayer" CASCADE;
DROP TYPE IF EXISTS "ScheduledExpenseStatus" CASCADE;
DROP TYPE IF EXISTS "IncomeStatus" CASCADE;
DROP TYPE IF EXISTS "ExpenseStatus" CASCADE;
DROP TYPE IF EXISTS "IncomeType" CASCADE;
DROP TYPE IF EXISTS "ExpenseType" CASCADE;

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'ARS');

-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('DEVELOPMENT', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "FinancialStatus" AS ENUM ('PAID', 'PENDING');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" DATE,
    "end_date" DATE,
    "notes" TEXT,
    "one_time_original_amount" DECIMAL(18,6),
    "one_time_currency" "Currency",
    "one_time_exchange_rate" DECIMAL(18,6),
    "one_time_amount_usd" DECIMAL(18,6),
    "monthly_recurring_original_amount" DECIMAL(18,6),
    "monthly_recurring_currency" "Currency",
    "monthly_recurring_exchange_rate" DECIMAL(18,6),
    "monthly_recurring_amount_usd" DECIMAL(18,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incomes" (
    "id" UUID NOT NULL,
    "client_id" UUID,
    "project_id" UUID,
    "income_type" "IncomeType" NOT NULL,
    "concept" TEXT NOT NULL,
    "notes" TEXT,
    "status" "FinancialStatus" NOT NULL DEFAULT 'PAID',
    "amount_usd" DECIMAL(18,6) NOT NULL,
    "amount_ars" DECIMAL(18,2),
    "exchange_rate" DECIMAL(18,6),
    "due_date" DATE,
    "effective_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "expense_category_id" UUID NOT NULL,
    "project_id" UUID,
    "expense_type" "ExpenseType" NOT NULL,
    "concept" TEXT NOT NULL,
    "notes" TEXT,
    "status" "FinancialStatus" NOT NULL DEFAULT 'PAID',
    "amount_usd" DECIMAL(18,6) NOT NULL,
    "amount_ars" DECIMAL(18,2),
    "exchange_rate" DECIMAL(18,6),
    "due_date" DATE,
    "effective_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");

-- CreateIndex
CREATE INDEX "projects_is_active_idx" ON "projects"("is_active");

-- CreateIndex
CREATE INDEX "projects_client_id_is_active_idx" ON "projects"("client_id", "is_active");

-- CreateIndex
CREATE INDEX "incomes_client_id_idx" ON "incomes"("client_id");

-- CreateIndex
CREATE INDEX "incomes_project_id_idx" ON "incomes"("project_id");

-- CreateIndex
CREATE INDEX "incomes_income_type_idx" ON "incomes"("income_type");

-- CreateIndex
CREATE INDEX "incomes_status_due_date_idx" ON "incomes"("status", "due_date");

-- CreateIndex
CREATE INDEX "incomes_status_effective_date_idx" ON "incomes"("status", "effective_date");

-- CreateIndex
CREATE INDEX "expenses_expense_category_id_idx" ON "expenses"("expense_category_id");

-- CreateIndex
CREATE INDEX "expenses_project_id_idx" ON "expenses"("project_id");

-- CreateIndex
CREATE INDEX "expenses_expense_type_idx" ON "expenses"("expense_type");

-- CreateIndex
CREATE INDEX "expenses_status_due_date_idx" ON "expenses"("status", "due_date");

-- CreateIndex
CREATE INDEX "expenses_status_effective_date_idx" ON "expenses"("status", "effective_date");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expense_category_id_fkey" FOREIGN KEY ("expense_category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================

-- Client: name not empty
ALTER TABLE "clients" ADD CONSTRAINT "chk_client_name_not_empty"
  CHECK (btrim("name") <> '');

-- Project: name not empty
ALTER TABLE "projects" ADD CONSTRAINT "chk_project_name_not_empty"
  CHECK (btrim("name") <> '');

-- Project: one-time amount consistency (all null or fully coherent)
ALTER TABLE "projects" ADD CONSTRAINT "chk_project_one_time_amount_consistency"
  CHECK (
    "one_time_original_amount" IS NULL
    OR (
      "one_time_currency" IS NOT NULL
      AND "one_time_amount_usd" IS NOT NULL
      AND "one_time_original_amount" > 0
      AND (
        ("one_time_currency" = 'USD' AND "one_time_exchange_rate" IS NULL
         AND "one_time_amount_usd" = "one_time_original_amount")
        OR
        ("one_time_currency" = 'ARS' AND "one_time_exchange_rate" IS NOT NULL
         AND "one_time_exchange_rate" > 0)
      )
    )
  );

-- Project: one-time amount arithmetic consistency for ARS
ALTER TABLE "projects" ADD CONSTRAINT "chk_project_one_time_ars_consistency"
  CHECK (
    "one_time_currency" IS NULL
    OR "one_time_currency" != 'ARS'
    OR "one_time_exchange_rate" IS NULL
    OR round(("one_time_original_amount" / "one_time_exchange_rate")::numeric, 6) = "one_time_amount_usd"
  );

-- Project: monthly recurring amount arithmetic consistency for ARS
ALTER TABLE "projects" ADD CONSTRAINT "chk_project_monthly_ars_consistency"
  CHECK (
    "monthly_recurring_currency" IS NULL
    OR "monthly_recurring_currency" != 'ARS'
    OR "monthly_recurring_exchange_rate" IS NULL
    OR round(("monthly_recurring_original_amount" / "monthly_recurring_exchange_rate")::numeric, 6) = "monthly_recurring_amount_usd"
  );
-- Project: monthly recurring amount consistency (all null or fully coherent)
ALTER TABLE "projects" ADD CONSTRAINT "chk_project_monthly_amount_consistency"
  CHECK (
    "monthly_recurring_original_amount" IS NULL
    OR (
      "monthly_recurring_currency" IS NOT NULL
      AND "monthly_recurring_amount_usd" IS NOT NULL
      AND "monthly_recurring_original_amount" > 0
      AND (
        ("monthly_recurring_currency" = 'USD' AND "monthly_recurring_exchange_rate" IS NULL
         AND "monthly_recurring_amount_usd" = "monthly_recurring_original_amount")
        OR
        ("monthly_recurring_currency" = 'ARS' AND "monthly_recurring_exchange_rate" IS NOT NULL
         AND "monthly_recurring_exchange_rate" > 0)
      )
    )
  );

-- Income: concept not empty
ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_concept_not_empty"
  CHECK (btrim("concept") <> '');

-- Income: amount_usd > 0
ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_amount_usd_positive"
  CHECK ("amount_usd" > 0);

-- Income: amount_ars positive when present
ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_amount_ars_positive"
  CHECK ("amount_ars" IS NULL OR "amount_ars" > 0);

-- Income: exchange_rate positive when present
ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_exchange_rate_positive"
  CHECK ("exchange_rate" IS NULL OR "exchange_rate" > 0);

-- Income: ARS and exchange_rate appear together
ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_ars_fx_together"
  CHECK (
    ("amount_ars" IS NULL AND "exchange_rate" IS NULL)
    OR ("amount_ars" IS NOT NULL AND "exchange_rate" IS NOT NULL)
  );

-- Income: PENDING requires due_date and no effective_date
ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_pending_requires_due_date"
  CHECK ("status" != 'PENDING' OR "due_date" IS NOT NULL);

ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_pending_no_effective_date"
  CHECK ("status" != 'PENDING' OR "effective_date" IS NULL);

-- Income: PAID requires effective_date
ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_paid_requires_effective_date"
  CHECK ("status" != 'PAID' OR "effective_date" IS NOT NULL);

-- Income: monetary arithmetic consistency (amountUsd = round(amountArs / exchangeRate, 6))
ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_monetary_consistency"
  CHECK (
    "amount_ars" IS NULL
    OR "exchange_rate" IS NULL
    OR round(("amount_ars" / "exchange_rate")::numeric, 6) = "amount_usd"
  );

-- Income: DEVELOPMENT and MAINTENANCE require project
ALTER TABLE "incomes" ADD CONSTRAINT "chk_income_dev_maint_requires_project"
  CHECK ("income_type" NOT IN ('DEVELOPMENT', 'MAINTENANCE') OR "project_id" IS NOT NULL);

-- ExpenseCategory: name not empty
ALTER TABLE "expense_categories" ADD CONSTRAINT "chk_expense_category_name_not_empty"
  CHECK (btrim("name") <> '');

-- Expense: concept not empty
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_concept_not_empty"
  CHECK (btrim("concept") <> '');

-- Expense: amount_usd > 0
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_amount_usd_positive"
  CHECK ("amount_usd" > 0);

-- Expense: amount_ars positive when present
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_amount_ars_positive"
  CHECK ("amount_ars" IS NULL OR "amount_ars" > 0);

-- Expense: exchange_rate positive when present
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_exchange_rate_positive"
  CHECK ("exchange_rate" IS NULL OR "exchange_rate" > 0);

-- Expense: ARS and exchange_rate appear together
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_ars_fx_together"
  CHECK (
    ("amount_ars" IS NULL AND "exchange_rate" IS NULL)
    OR ("amount_ars" IS NOT NULL AND "exchange_rate" IS NOT NULL)
  );

-- Expense: PENDING requires due_date and no effective_date
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_pending_requires_due_date"
  CHECK ("status" != 'PENDING' OR "due_date" IS NOT NULL);

ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_pending_no_effective_date"
  CHECK ("status" != 'PENDING' OR "effective_date" IS NULL);

-- Expense: PAID requires effective_date
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_paid_requires_effective_date"
  CHECK ("status" != 'PAID' OR "effective_date" IS NOT NULL);

-- Expense: monetary arithmetic consistency (amountUsd = round(amountArs / exchangeRate, 6))
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_monetary_consistency"
  CHECK (
    "amount_ars" IS NULL
    OR "exchange_rate" IS NULL
    OR round(("amount_ars" / "exchange_rate")::numeric, 6) = "amount_usd"
  );

-- ============================================================
-- CASE-INSENSITIVE UNIQUE INDEXES
-- ============================================================

CREATE UNIQUE INDEX "clients_name_unique_ci"
  ON "clients" (lower(btrim("name")));

CREATE UNIQUE INDEX "expense_categories_name_unique_ci"
  ON "expense_categories" (lower(btrim("name")));

CREATE UNIQUE INDEX "projects_client_id_name_unique_ci"
  ON "projects" ("client_id", lower(btrim("name")));
