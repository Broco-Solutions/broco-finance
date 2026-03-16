ALTER TABLE "projects"
ADD COLUMN IF NOT EXISTS "monthly_fee_end_date" DATE;

CREATE INDEX IF NOT EXISTS "projects_monthly_fee_end_date_idx"
ON "projects"("monthly_fee_end_date");
