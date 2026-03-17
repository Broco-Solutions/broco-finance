CREATE TABLE "kanban_columns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanban_columns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kanban_project_placements" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "kanban_column_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanban_project_placements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kanban_project_placements_project_id_key" ON "kanban_project_placements"("project_id");
CREATE INDEX "kanban_columns_position_idx" ON "kanban_columns"("position");
CREATE INDEX "kanban_columns_is_active_position_idx" ON "kanban_columns"("is_active", "position");
CREATE INDEX "kanban_project_placements_kanban_column_id_position_idx" ON "kanban_project_placements"("kanban_column_id", "position");

ALTER TABLE "kanban_project_placements"
ADD CONSTRAINT "kanban_project_placements_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kanban_project_placements"
ADD CONSTRAINT "kanban_project_placements_kanban_column_id_fkey"
FOREIGN KEY ("kanban_column_id") REFERENCES "kanban_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
