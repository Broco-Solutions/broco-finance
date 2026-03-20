ALTER TABLE "incomes"
ADD COLUMN "due_date" DATE;

CREATE INDEX "incomes_status_due_date_idx" ON "incomes"("status", "due_date");
