-- =====================================================================
-- Migración: Income.type (enum) -> Income.typeId (FK a income_types)
-- Ejecutar contra la DB de producción ANTES de correr `prisma db push`.
--
-- Uso: psql "$DATABASE_URL" -f scripts/migrate-income-types.sql
-- =====================================================================

BEGIN;

-- 1. Crear tabla income_types
CREATE TABLE IF NOT EXISTS "income_types" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "requires_project" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "income_types_name_key" ON "income_types"("name");

-- 2. Seed con los 3 tipos actuales (solo si la tabla estaba vacía)
INSERT INTO "income_types" (id, name, requires_project, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.req, true, NOW(), NOW()
FROM (VALUES
    ('Desarrollo', true),
    ('Mantenimiento', true),
    ('Otro', false)
) AS v(name, req)
WHERE NOT EXISTS (SELECT 1 FROM "income_types" WHERE "income_types"."name" = v.name);

-- 3. Agregar columna type_id (nullable temporalmente)
ALTER TABLE "incomes" ADD COLUMN IF NOT EXISTS "type_id" UUID;

-- 4. Mapear datos existentes
UPDATE "incomes" SET "type_id" = (SELECT id FROM "income_types" WHERE name = 'Desarrollo') WHERE "income_type" = 'DEVELOPMENT';
UPDATE "incomes" SET "type_id" = (SELECT id FROM "income_types" WHERE name = 'Mantenimiento') WHERE "income_type" = 'MAINTENANCE';
UPDATE "incomes" SET "type_id" = (SELECT id FROM "income_types" WHERE name = 'Otro') WHERE "income_type" = 'OTHER';

-- 5. Verificación: no debe haber NULLs
DO $$
DECLARE null_count INT;
BEGIN
    SELECT COUNT(*) INTO null_count FROM "incomes" WHERE "type_id" IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'Hay % ingresos sin type_id mapeado. Revisar los valores de income_type.', null_count;
    END IF;
END $$;

-- 6. NOT NULL + FK
ALTER TABLE "incomes" ALTER COLUMN "type_id" SET NOT NULL;

ALTER TABLE "incomes" DROP CONSTRAINT IF EXISTS "incomes_type_id_fkey";
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_type_id_fkey"
    FOREIGN KEY ("type_id") REFERENCES "income_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Dropear la columna vieja (el enum lo dropea prisma db push)
ALTER TABLE "incomes" DROP COLUMN IF EXISTS "income_type";

CREATE INDEX IF NOT EXISTS "incomes_type_id_idx" ON "incomes"("type_id");

COMMIT;

-- Resultado esperado: 3 tipos creados, todos los incomes mapeados.
SELECT name, requires_project, is_active FROM "income_types" ORDER BY name;
SELECT COUNT(*) AS total_incomes FROM "incomes";
