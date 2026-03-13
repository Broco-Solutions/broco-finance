-- CreateEnum
CREATE TYPE "ScheduledExpenseStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "amount_usd" DECIMAL(12,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "frequency" "ContractFrequency" NOT NULL DEFAULT 'monthly',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_expenses" (
    "id" UUID NOT NULL,
    "recurring_expense_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "amount_usd" DECIMAL(12,2) NOT NULL,
    "status" "ScheduledExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "actual_expense_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_expenses_category_id_is_active_idx" ON "recurring_expenses"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "recurring_expenses_is_active_start_date_idx" ON "recurring_expenses"("is_active", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_expenses_actual_expense_id_key" ON "scheduled_expenses"("actual_expense_id");

-- CreateIndex
CREATE INDEX "scheduled_expenses_due_date_status_idx" ON "scheduled_expenses"("due_date", "status");

-- CreateIndex
CREATE INDEX "scheduled_expenses_recurring_expense_id_due_date_idx" ON "scheduled_expenses"("recurring_expense_id", "due_date");

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_expenses" ADD CONSTRAINT "scheduled_expenses_recurring_expense_id_fkey" FOREIGN KEY ("recurring_expense_id") REFERENCES "recurring_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_expenses" ADD CONSTRAINT "scheduled_expenses_actual_expense_id_fkey" FOREIGN KEY ("actual_expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
