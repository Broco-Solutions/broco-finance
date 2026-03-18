import { Prisma, ProjectStatus, type PrismaClient } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import type { KanbanBoardColumn, KanbanBoardPayload, KanbanColumnRecord, KanbanProjectCard } from "@/lib/types";
import { demoProjects } from "@/server/demo-data";
import { AppError, logServerError } from "@/server/errors";
import { hasDatabaseConfig, prisma } from "@/server/prisma";
import { syncProjectMaintenanceSchedule } from "@/server/services/finance";

type DbClient = PrismaClient | Prisma.TransactionClient;

const kanbanTransactionOptions = {
  maxWait: 10_000,
  timeout: 15_000,
} as const;

const kanbanColumnDefaults = [
  { name: "Prospeccion / Contactos", color: "#7C3AED", isInitial: true },
  { name: "Presupuesto enviado / Esperando respuesta", color: "#2563EB", isInitial: false },
  { name: "Aprobado / Pendiente de inicio", color: "#0891B2", isInitial: false },
  { name: "En curso", color: "#059669", isInitial: false },
  { name: "Bloqueado / En espera", color: "#F97316", isInitial: false },
  { name: "En revision / Cierre", color: "#EAB308", isInitial: false },
  { name: "Completado", color: "#16A34A", isInitial: false },
  { name: "Recurrente mensual", color: "#14B8A6", isInitial: false },
  { name: "No aprobado / Sin respuesta", color: "#DC2626", isInitial: false },
  { name: "Finalizado", color: "#475569", isInitial: false },
] as const;

const kanbanColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido.");

const kanbanColumnInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio."),
  color: kanbanColorSchema.nullable().optional(),
  isActive: z.boolean(),
  isInitial: z.boolean(),
});

const kanbanBoardActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_column"),
    name: z.string().trim().min(2, "El nombre es obligatorio."),
    color: kanbanColorSchema.nullable().optional(),
    isActive: z.boolean().optional(),
    isInitial: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("update_column"),
    columnId: z.string().uuid("Columna inválida."),
  }).merge(kanbanColumnInputSchema),
  z.object({
    action: z.literal("delete_column"),
    columnId: z.string().uuid("Columna inválida."),
    targetColumnId: z.string().uuid("Columna destino inválida.").nullable().optional(),
  }),
  z.object({
    action: z.literal("reorder_board"),
    orderedColumnIds: z.array(z.string().uuid("Columna inválida.")).min(1),
    columns: z.array(
      z.object({
        columnId: z.string().uuid("Columna inválida."),
        projectIds: z.array(z.string().uuid("Proyecto inválido.")),
      }),
    ),
  }),
]);

type KanbanBoardAction = z.infer<typeof kanbanBoardActionSchema>;

type ProjectForKanban = {
  id: string;
  name: string;
  clientId: string;
  status: ProjectStatus;
  devBudgetUsd: Prisma.Decimal | number | null;
  monthlyFeeUsd: Prisma.Decimal | number | null;
  client: {
    name: string;
  };
};

type PlacementRecord = {
  projectId: string;
  kanbanColumnId: string;
  position: number;
};

function requireDatabase() {
  if (!hasDatabaseConfig()) {
    throw new AppError("Configurá DATABASE_URL para habilitar cambios persistentes.", 503);
  }
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeColumnName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resolveProjectStatusForColumn(column: { name: string; isInitial: boolean }) {
  if (column.isInitial) {
    return ProjectStatus.ACTIVE;
  }

  const normalizedName = normalizeColumnName(column.name);

  if (
    normalizedName.includes("no aprobado")
    || normalizedName.includes("sin respuesta")
    || normalizedName.includes("cancel")
    || normalizedName.includes("rechaz")
  ) {
    return ProjectStatus.CANCELLED;
  }

  if (
    normalizedName === "completado"
    || normalizedName === "finalizado"
    || normalizedName.includes("terminado")
    || normalizedName.includes("entregado")
    || normalizedName.includes("cerrado")
  ) {
    return ProjectStatus.COMPLETED;
  }

  return ProjectStatus.ACTIVE;
}

function resolveDisplayColumnIdForProject({
  initialColumnId,
  activeColumnIds,
  placementColumnId,
}: {
  initialColumnId: string;
  activeColumnIds: Set<string>;
  placementColumnId: string | null | undefined;
}) {
  if (placementColumnId && activeColumnIds.has(placementColumnId)) {
    return placementColumnId;
  }

  return initialColumnId;
}

function mapColumnRecord(column: {
  id: string;
  name: string;
  color: string | null;
  position: number;
  isActive: boolean;
  isInitial: boolean;
}, assignmentCount: number): KanbanColumnRecord {
  return {
    id: column.id,
    name: column.name,
    color: column.color,
    position: column.position,
    isActive: column.isActive,
    isInitial: column.isInitial,
    assignmentCount,
  };
}

function compareCards(left: KanbanProjectCard, right: KanbanProjectCard) {
  if (left.hasExplicitPlacement !== right.hasExplicitPlacement) {
    return Number(right.hasExplicitPlacement) - Number(left.hasExplicitPlacement);
  }

  if (left.displayPosition !== right.displayPosition) {
    return left.displayPosition - right.displayPosition;
  }

  return left.projectName.localeCompare(right.projectName);
}

function mapDemoKanbanBoard(): KanbanBoardPayload {
  const columns: KanbanBoardColumn[] = kanbanColumnDefaults.map((column, index) => ({
    id: `kanban-column-${index + 1}`,
    name: column.name,
    color: column.color,
    position: index,
    isActive: true,
    isInitial: column.isInitial,
    assignmentCount: 0,
    cards: [],
  }));

  const initialColumn = columns.find((column) => column.isInitial) ?? columns[0];
  const cards = demoProjects
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map<KanbanProjectCard>((project, index) => ({
      projectId: project.id,
      projectName: project.name,
      clientId: project.clientId,
      clientName: project.clientName,
      projectStatus: project.status,
      monthlyFeeUsd: project.monthlyFeeUsd,
      devBudgetUsd: project.devBudgetUsd,
      placementColumnId: null,
      displayColumnId: initialColumn.id,
      displayPosition: index,
      hasExplicitPlacement: false,
    }));

  initialColumn.cards = cards;

  const clients = Array.from(
    demoProjects.reduce((acc, project) => {
      acc.set(project.clientId, { id: project.clientId, name: project.clientName });
      return acc;
    }, new Map<string, { id: string; name: string }>()),
  )
    .map(([, client]) => client)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    columns,
    clients,
    demoMode: true,
    persistenceAvailable: false,
    notice: null,
  };
}

function mapReadonlyKanbanBoard(projects: ProjectForKanban[], notice: string): KanbanBoardPayload {
  const columns: KanbanBoardColumn[] = kanbanColumnDefaults.map((column, index) => ({
    id: `readonly-kanban-column-${index + 1}`,
    name: column.name,
    color: column.color,
    position: index,
    isActive: true,
    isInitial: column.isInitial,
    assignmentCount: 0,
    cards: [],
  }));

  const initialColumn = columns.find((column) => column.isInitial) ?? columns[0];
  initialColumn.cards = projects
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((project, index) => ({
      projectId: project.id,
      projectName: project.name,
      clientId: project.clientId,
      clientName: project.client.name,
      projectStatus: project.status,
      monthlyFeeUsd: toNumber(project.monthlyFeeUsd),
      devBudgetUsd: toNumber(project.devBudgetUsd),
      placementColumnId: null,
      displayColumnId: initialColumn.id,
      displayPosition: index,
      hasExplicitPlacement: false,
    }));

  const clients = Array.from(
    projects.reduce((acc, project) => {
      acc.set(project.clientId, { id: project.clientId, name: project.client.name });
      return acc;
    }, new Map<string, { id: string; name: string }>()),
  )
    .map(([, client]) => client)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    columns,
    clients,
    demoMode: false,
    persistenceAvailable: false,
    notice,
  };
}

function isMissingKanbanTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

async function fetchProjectsForReadonlyBoard() {
  return prisma.project.findMany({
    select: {
      id: true,
      name: true,
      clientId: true,
      status: true,
      devBudgetUsd: true,
      monthlyFeeUsd: true,
      client: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

async function ensureKanbanColumns(db: DbClient) {
  const count = await db.kanbanColumn.count();
  if (count > 0) {
    return;
  }

  await db.kanbanColumn.createMany({
    data: kanbanColumnDefaults.map((column, index) => ({
      name: column.name,
      color: column.color,
      position: index,
      isActive: true,
      isInitial: column.isInitial,
    })),
  });
}

async function repairKanbanColumns(db: DbClient) {
  const columns = await db.kanbanColumn.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  if (columns.length === 0) {
    return;
  }

  const activeColumns = columns.filter((column) => column.isActive);
  if (activeColumns.length === 0) {
    throw new AppError("El tablero necesita al menos una columna activa.", 409);
  }

  const nextInitial = activeColumns.find((column) => column.isInitial) ?? activeColumns[0];

  await Promise.all(
    columns.map((column, index) =>
      db.kanbanColumn.update({
        where: { id: column.id },
        data: {
          position: index,
          isInitial: column.id === nextInitial.id,
        },
      }),
    ),
  );
}

function buildCards({
  columns,
  placements,
  projects,
}: {
  columns: Array<{ id: string; name: string; color: string | null; position: number; isActive: boolean; isInitial: boolean }>;
  placements: PlacementRecord[];
  projects: ProjectForKanban[];
}) {
  const assignmentCountByColumn = placements.reduce((acc, placement) => {
    acc.set(placement.kanbanColumnId, (acc.get(placement.kanbanColumnId) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());
  const activeColumns = columns.filter((column) => column.isActive).sort((left, right) => left.position - right.position);
  const initialColumn = activeColumns.find((column) => column.isInitial) ?? activeColumns[0] ?? null;
  const columnIds = new Set(columns.map((column) => column.id));
  const activeColumnIds = new Set(activeColumns.map((column) => column.id));
  const placementByProject = new Map(placements.map((placement) => [placement.projectId, placement]));
  const cardsByColumn = new Map<string, KanbanProjectCard[]>(
    activeColumns.map((column) => [column.id, []]),
  );

  for (const project of projects) {
    if (!initialColumn) {
      continue;
    }

    const placement = placementByProject.get(project.id) ?? null;
    const canUseExplicitPlacement =
      Boolean(placement) &&
      columnIds.has(placement!.kanbanColumnId) &&
      activeColumnIds.has(placement!.kanbanColumnId);
    const displayColumnId = canUseExplicitPlacement ? placement!.kanbanColumnId : initialColumn.id;

    const card: KanbanProjectCard = {
      projectId: project.id,
      projectName: project.name,
      clientId: project.clientId,
      clientName: project.client.name,
      projectStatus: project.status,
      monthlyFeeUsd: toNumber(project.monthlyFeeUsd),
      devBudgetUsd: toNumber(project.devBudgetUsd),
      placementColumnId: placement?.kanbanColumnId ?? null,
      displayColumnId,
      displayPosition: canUseExplicitPlacement ? placement!.position : 100000,
      hasExplicitPlacement: canUseExplicitPlacement,
    };

    const bucket = cardsByColumn.get(displayColumnId) ?? [];
    bucket.push(card);
    cardsByColumn.set(displayColumnId, bucket);
  }

  const boardColumns: KanbanBoardColumn[] = columns
    .sort((left, right) => left.position - right.position)
    .map((column) => ({
      ...mapColumnRecord(column, assignmentCountByColumn.get(column.id) ?? 0),
      cards: column.isActive ? (cardsByColumn.get(column.id) ?? []).sort(compareCards) : [],
    }));

  return boardColumns;
}

async function fetchKanbanBoardFromDatabase(): Promise<KanbanBoardPayload> {
  await ensureKanbanColumns(prisma);
  await repairKanbanColumns(prisma);

  const [columns, placements, projects] = await Promise.all([
    prisma.kanbanColumn.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.kanbanProjectPlacement.findMany({
      select: {
        projectId: true,
        kanbanColumnId: true,
        position: true,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        devBudgetUsd: true,
        monthlyFeeUsd: true,
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
  ]);

  const boardColumns = buildCards({ columns, placements, projects });
  const clients = Array.from(
    projects.reduce((acc, project) => {
      acc.set(project.clientId, { id: project.clientId, name: project.client.name });
      return acc;
    }, new Map<string, { id: string; name: string }>()),
  )
    .map(([, client]) => client)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    columns: boardColumns,
    clients,
    demoMode: false,
    persistenceAvailable: true,
    notice: null,
  };
}

async function reorderBoardInDatabase(input: Extract<KanbanBoardAction, { action: "reorder_board" }>) {
  const activeColumns = await prisma.kanbanColumn.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const inactiveColumns = await prisma.kanbanColumn.findMany({
    where: { isActive: false },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const activeIds = activeColumns.map((column) => column.id);
  const activeColumnById = new Map(activeColumns.map((column) => [column.id, column]));
  const activeColumnIds = new Set(activeIds);
  const initialColumn = activeColumns.find((column) => column.isInitial) ?? activeColumns[0] ?? null;
  if (activeIds.length !== input.orderedColumnIds.length || activeIds.some((id) => !input.orderedColumnIds.includes(id))) {
    throw new AppError("El tablero cambió mientras estabas reordenando. Recargá la vista y volvé a intentar.", 409);
  }

  if (!initialColumn) {
    throw new AppError("El tablero necesita al menos una columna activa.", 409);
  }

  const payloadColumnIds = input.columns.map((column) => column.columnId);
  if (payloadColumnIds.length !== input.orderedColumnIds.length || payloadColumnIds.some((id) => !input.orderedColumnIds.includes(id))) {
    throw new AppError("La estructura del tablero es inválida.", 422);
  }

  const uniqueProjectIds = new Set<string>();
  for (const column of input.columns) {
    for (const projectId of column.projectIds) {
      if (uniqueProjectIds.has(projectId)) {
        throw new AppError("Hay tarjetas repetidas en el reordenamiento.", 422);
      }

      uniqueProjectIds.add(projectId);
    }
  }

  const projectIds = Array.from(uniqueProjectIds);

  await prisma.$transaction(
    async (tx) => {
      const nextOrder = [...input.orderedColumnIds, ...inactiveColumns.map((column) => column.id)];
      await Promise.all(
        nextOrder.map((columnId, index) =>
          tx.kanbanColumn.update({
            where: { id: columnId },
            data: { position: index },
          }),
        ),
      );

      const knownProjects = await tx.project.findMany({
        where: {
          id: {
            in: projectIds,
          },
        },
        select: {
          id: true,
          status: true,
          monthlyFeeUsd: true,
          monthlyFeeEndDate: true,
        },
      });
      const knownProjectIds = new Set(knownProjects.map((project) => project.id));

      if (knownProjectIds.size !== projectIds.length) {
        throw new AppError("Hay proyectos inválidos en el reordenamiento.", 422);
      }

      const projectsById = new Map(knownProjects.map((project) => [project.id, project]));

      const placementsByProjectId = new Map(
        (
          await tx.kanbanProjectPlacement.findMany({
            where: {
              projectId: {
                in: projectIds,
              },
            },
            select: {
              projectId: true,
              kanbanColumnId: true,
            },
          })
        ).map((placement) => [placement.projectId, placement.kanbanColumnId]),
      );

      await Promise.all(
        input.columns.flatMap((column) =>
          column.projectIds.map((projectId, index) =>
            tx.kanbanProjectPlacement.upsert({
              where: { projectId },
              update: {
                kanbanColumnId: column.columnId,
                position: index,
              },
              create: {
                projectId,
                kanbanColumnId: column.columnId,
                position: index,
              },
            }),
          ),
        ),
      );

      const movedProjects = input.columns.flatMap((column) => {
        const targetColumn = activeColumnById.get(column.columnId);
        if (!targetColumn) {
          throw new AppError("La columna destino no existe o dejó de estar activa.", 409);
        }

        return column.projectIds
          .filter((projectId) => {
            const currentDisplayColumnId = resolveDisplayColumnIdForProject({
              initialColumnId: initialColumn.id,
              activeColumnIds,
              placementColumnId: placementsByProjectId.get(projectId),
            });

            return currentDisplayColumnId !== column.columnId;
          })
          .map((projectId) => ({
            projectId,
            nextStatus: resolveProjectStatusForColumn(targetColumn),
          }));
      });

      for (const item of movedProjects) {
        const project = projectsById.get(item.projectId);
        if (!project || project.status === item.nextStatus) {
          continue;
        }

        const updatedProject = await tx.project.update({
          where: { id: item.projectId },
          data: { status: item.nextStatus },
          select: {
            id: true,
            status: true,
            monthlyFeeUsd: true,
            monthlyFeeEndDate: true,
          },
        });

        await syncProjectMaintenanceSchedule(tx, updatedProject, true);
      }
    },
    kanbanTransactionOptions,
  );
}

async function createKanbanColumn(input: Extract<KanbanBoardAction, { action: "create_column" }>) {
  await prisma.$transaction(async (tx) => {
    await ensureKanbanColumns(tx);
    const columns = await tx.kanbanColumn.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const activeColumns = columns.filter((column) => column.isActive);
    const nextIsActive = input.isActive ?? true;
    if (!nextIsActive && activeColumns.length === 0) {
      throw new AppError("El tablero necesita al menos una columna activa.", 409);
    }

    const shouldBecomeInitial = input.isInitial || (nextIsActive && !activeColumns.some((column) => column.isInitial));
    if (shouldBecomeInitial) {
      await tx.kanbanColumn.updateMany({
        where: { isInitial: true },
        data: { isInitial: false },
      });
    }

    await tx.kanbanColumn.create({
      data: {
        name: input.name.trim(),
        color: normalizeOptionalText(input.color),
        position: columns.length,
        isActive: nextIsActive,
        isInitial: Boolean(shouldBecomeInitial),
      },
    });

    await repairKanbanColumns(tx);
  }, kanbanTransactionOptions);
}

async function updateKanbanColumn(input: Extract<KanbanBoardAction, { action: "update_column" }>) {
  await prisma.$transaction(async (tx) => {
    const column = await tx.kanbanColumn.findUnique({
      where: { id: input.columnId },
    });

    if (!column) {
      throw new AppError("Columna no encontrada.", 404);
    }

    const columns = await tx.kanbanColumn.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const activeColumns = columns.filter((item) => item.isActive && item.id !== column.id);
    const nextIsActive = input.isInitial ? true : input.isActive;

    if (!nextIsActive && activeColumns.length === 0) {
      throw new AppError("El tablero necesita al menos una columna activa.", 409);
    }

    if (input.isInitial) {
      await tx.kanbanColumn.updateMany({
        where: { id: { not: column.id } },
        data: { isInitial: false },
      });
    }

    await tx.kanbanColumn.update({
      where: { id: column.id },
      data: {
        name: input.name.trim(),
        color: normalizeOptionalText(input.color),
        isActive: nextIsActive,
        isInitial: input.isInitial,
      },
    });

    await repairKanbanColumns(tx);
  }, kanbanTransactionOptions);
}

async function deleteKanbanColumn(input: Extract<KanbanBoardAction, { action: "delete_column" }>) {
  await prisma.$transaction(async (tx) => {
    const column = await tx.kanbanColumn.findUnique({
      where: { id: input.columnId },
      include: {
        _count: {
          select: {
            placements: true,
          },
        },
      },
    });

    if (!column) {
      throw new AppError("Columna no encontrada.", 404);
    }

    const otherActiveColumns = await tx.kanbanColumn.findMany({
      where: {
        id: { not: column.id },
        isActive: true,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    if (column.isActive && otherActiveColumns.length === 0) {
      throw new AppError("No podés eliminar la última columna activa del tablero.", 409);
    }

    if (column._count.placements > 0) {
      if (!input.targetColumnId || input.targetColumnId === column.id) {
        throw new AppError("Elegí una columna destino para reasignar las tarjetas.", 422);
      }

      const targetColumn = await tx.kanbanColumn.findUnique({
        where: { id: input.targetColumnId },
      });

      if (!targetColumn || !targetColumn.isActive) {
        throw new AppError("La columna destino debe existir y estar activa.", 422);
      }

      const targetCount = await tx.kanbanProjectPlacement.count({
        where: { kanbanColumnId: targetColumn.id },
      });
      const sourcePlacements = await tx.kanbanProjectPlacement.findMany({
        where: { kanbanColumnId: column.id },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      });

      await Promise.all(
        sourcePlacements.map((placement, index) =>
          tx.kanbanProjectPlacement.update({
            where: { id: placement.id },
            data: {
              kanbanColumnId: targetColumn.id,
              position: targetCount + index,
            },
          }),
        ),
      );

      const nextStatus = resolveProjectStatusForColumn(targetColumn);
      const sourceProjects = await tx.project.findMany({
        where: {
          id: {
            in: sourcePlacements.map((placement) => placement.projectId),
          },
        },
        select: {
          id: true,
          status: true,
          monthlyFeeUsd: true,
          monthlyFeeEndDate: true,
        },
      });

      for (const project of sourceProjects) {

        if (project.status === nextStatus) {
          continue;
        }

        const updatedProject = await tx.project.update({
          where: { id: project.id },
          data: { status: nextStatus },
          select: {
            id: true,
            status: true,
            monthlyFeeUsd: true,
            monthlyFeeEndDate: true,
          },
        });

        await syncProjectMaintenanceSchedule(tx, updatedProject, true);
      }
    }

    await tx.kanbanColumn.delete({
      where: { id: column.id },
    });

    await repairKanbanColumns(tx);
  }, kanbanTransactionOptions);
}

export async function getKanbanBoard(): Promise<KanbanBoardPayload> {
  if (!hasDatabaseConfig()) {
    return mapDemoKanbanBoard();
  }

  try {
    return await fetchKanbanBoardFromDatabase();
  } catch (error) {
    if (!isMissingKanbanTableError(error)) {
      throw error;
    }

    const projects = await fetchProjectsForReadonlyBoard();
    return mapReadonlyKanbanBoard(
      projects,
      "Kanban quedó en modo lectura porque la migración nueva todavía no está aplicada en esta base.",
    );
  }
}

export { kanbanBoardActionSchema };

export async function mutateKanbanBoard(input: KanbanBoardAction): Promise<KanbanBoardPayload> {
  requireDatabase();

  try {
    switch (input.action) {
      case "create_column":
        await createKanbanColumn(input);
        break;
      case "update_column":
        await updateKanbanColumn(input);
        break;
      case "delete_column":
        await deleteKanbanColumn(input);
        break;
      case "reorder_board":
        await reorderBoardInDatabase(input);
        break;
      default:
        throw new AppError("Acción de Kanban inválida.", 422);
    }
  } catch (error) {
    logServerError("kanban.mutate", error, {
      action: input.action,
      orderedColumnIds: input.action === "reorder_board" ? input.orderedColumnIds : undefined,
      columns:
        input.action === "reorder_board"
          ? input.columns.map((column) => ({
              columnId: column.columnId,
              projectCount: column.projectIds.length,
              projectIds: column.projectIds,
            }))
          : undefined,
      columnId: "columnId" in input ? input.columnId : undefined,
      targetColumnId: "targetColumnId" in input ? input.targetColumnId : undefined,
      name: "name" in input ? input.name : undefined,
    });

    if (isMissingKanbanTableError(error)) {
      throw new AppError("Aplicá la migración de Kanban antes de persistir cambios.", 503);
    }

    throw error;
  }

  revalidateTag("dashboard");
  return fetchKanbanBoardFromDatabase();
}
