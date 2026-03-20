CREATE TYPE "ExpenseStatus" AS ENUM ('PAID', 'PENDING');

ALTER TABLE "expenses"
ADD COLUMN "due_date" DATE,
ADD COLUMN "status" "ExpenseStatus" NOT NULL DEFAULT 'PAID';

CREATE INDEX "expenses_status_due_date_idx" ON "expenses"("status", "due_date");
