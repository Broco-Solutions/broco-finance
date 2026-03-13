-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'finished', 'cancelled');

-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('advance', 'final_payment', 'recurring');

-- CreateEnum
CREATE TYPE "ContractFrequency" AS ENUM ('monthly', 'quarterly', 'biannual', 'annual');

-- CreateEnum
CREATE TYPE "ScheduledPaymentStatus" AS ENUM ('pending', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('fixed', 'variable');

-- CreateEnum
CREATE TYPE "DistributionLayer" AS ENUM ('emergency', 'growth');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
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
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "total_budget_usd" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incomes" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount_ars" DECIMAL(14,2),
    "amount_usd" DECIMAL(12,2) NOT NULL,
    "exchange_rate" DECIMAL(12,4),
    "type" "IncomeType" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_contracts" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount_usd" DECIMAL(12,2) NOT NULL,
    "amount_ars" DECIMAL(14,2),
    "frequency" "ContractFrequency" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_payments" (
    "id" UUID NOT NULL,
    "recurring_contract_id" UUID,
    "project_id" UUID NOT NULL,
    "expected_date" DATE NOT NULL,
    "expected_amount_usd" DECIMAL(12,2) NOT NULL,
    "status" "ScheduledPaymentStatus" NOT NULL DEFAULT 'pending',
    "actual_income_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "category_id" UUID NOT NULL,
    "expense_type" "ExpenseType" NOT NULL,
    "project_id" UUID,
    "amount_ars" DECIMAL(14,2),
    "amount_usd" DECIMAL(12,2) NOT NULL,
    "exchange_rate" DECIMAL(12,4),
    "description" TEXT NOT NULL,
    "salary_withdrawal_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution_config" (
    "id" UUID NOT NULL,
    "layer" "DistributionLayer" NOT NULL,
    "current_amount_usd" DECIMAL(12,2) NOT NULL,
    "storage_location" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distribution_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_withdrawals" (
    "id" UUID NOT NULL,
    "person_name" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount_usd" DECIMAL(12,2) NOT NULL,
    "amount_ars" DECIMAL(14,2),
    "exchange_rate" DECIMAL(12,4),
    "date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- CreateIndex
CREATE INDEX "projects_client_id_status_idx" ON "projects"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_client_id_name_key" ON "projects"("client_id", "name");

-- CreateIndex
CREATE INDEX "incomes_project_id_date_idx" ON "incomes"("project_id", "date");

-- CreateIndex
CREATE INDEX "incomes_type_date_idx" ON "incomes"("type", "date");

-- CreateIndex
CREATE INDEX "recurring_contracts_project_id_is_active_idx" ON "recurring_contracts"("project_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_payments_actual_income_id_key" ON "scheduled_payments"("actual_income_id");

-- CreateIndex
CREATE INDEX "scheduled_payments_project_id_expected_date_idx" ON "scheduled_payments"("project_id", "expected_date");

-- CreateIndex
CREATE INDEX "scheduled_payments_status_expected_date_idx" ON "scheduled_payments"("status", "expected_date");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_salary_withdrawal_id_key" ON "expenses"("salary_withdrawal_id");

-- CreateIndex
CREATE INDEX "expenses_category_id_date_idx" ON "expenses"("category_id", "date");

-- CreateIndex
CREATE INDEX "expenses_project_id_date_idx" ON "expenses"("project_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "distribution_config_layer_key" ON "distribution_config"("layer");

-- CreateIndex
CREATE INDEX "salary_withdrawals_person_name_month_idx" ON "salary_withdrawals"("person_name", "month");

-- CreateIndex
CREATE INDEX "salary_withdrawals_month_idx" ON "salary_withdrawals"("month");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_contracts" ADD CONSTRAINT "recurring_contracts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_recurring_contract_id_fkey" FOREIGN KEY ("recurring_contract_id") REFERENCES "recurring_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_actual_income_id_fkey" FOREIGN KEY ("actual_income_id") REFERENCES "incomes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_salary_withdrawal_id_fkey" FOREIGN KEY ("salary_withdrawal_id") REFERENCES "salary_withdrawals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
