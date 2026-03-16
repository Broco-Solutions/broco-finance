ALTER TABLE "scheduled_payments"
ADD COLUMN IF NOT EXISTS "type" "IncomeType";

UPDATE "scheduled_payments"
SET "type" = CASE
  WHEN "recurring_contract_id" IS NOT NULL THEN 'MAINTENANCE'::"IncomeType"
  ELSE 'DEVELOPMENT'::"IncomeType"
END
WHERE "type" IS NULL;

ALTER TABLE "scheduled_payments"
ALTER COLUMN "type" SET DEFAULT 'MAINTENANCE'::"IncomeType";

ALTER TABLE "scheduled_payments"
ALTER COLUMN "type" SET NOT NULL;

WITH ranked_contracts AS (
  SELECT
    "project_id",
    "amount_usd",
    "notes",
    ROW_NUMBER() OVER (
      PARTITION BY "project_id"
      ORDER BY "is_active" DESC, "updated_at" DESC, "created_at" DESC
    ) AS "rank"
  FROM "recurring_contracts"
)
UPDATE "projects" AS "projects"
SET
  "monthly_fee_usd" = ranked_contracts."amount_usd",
  "notes" = COALESCE("projects"."notes", ranked_contracts."notes")
FROM ranked_contracts
WHERE ranked_contracts."rank" = 1
  AND ranked_contracts."project_id" = "projects"."id";

UPDATE "incomes" AS "incomes"
SET "project_id" = "scheduled_payments"."project_id"
FROM "scheduled_payments"
WHERE "scheduled_payments"."actual_income_id" = "incomes"."id"
  AND "incomes"."project_id" IS DISTINCT FROM "scheduled_payments"."project_id";

UPDATE "incomes" AS "incomes"
SET "income_type" = 'MAINTENANCE'::"IncomeType"
FROM "scheduled_payments"
WHERE "scheduled_payments"."actual_income_id" = "incomes"."id"
  AND "scheduled_payments"."type" = 'MAINTENANCE'::"IncomeType"
  AND "incomes"."income_type" <> 'MAINTENANCE'::"IncomeType";

DROP INDEX IF EXISTS "scheduled_payments_type_expected_date_idx";
CREATE INDEX "scheduled_payments_type_expected_date_idx"
ON "scheduled_payments"("type", "expected_date");

ALTER TABLE "scheduled_payments"
DROP CONSTRAINT IF EXISTS "scheduled_payments_recurring_contract_id_fkey";

ALTER TABLE "scheduled_payments"
DROP COLUMN IF EXISTS "recurring_contract_id";

DROP TABLE IF EXISTS "recurring_contracts";
