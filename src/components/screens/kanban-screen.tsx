"use client";

import Link from "next/link";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExternalLink,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { FormEvent, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import type {
  KanbanBoardColumn,
  KanbanBoardPayload,
  KanbanColumnRecord,
  KanbanProjectCard,
  ProjectStatus,
} from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { cn, formatProjectStatus, formatUsd } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { EditEntityModal } from "@/components/ui/edit-entity-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";

const projectStatusOptions: ProjectStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];
const colorPresets = ["#7C3AED", "#2563EB", "#059669", "#F97316", "#EAB308", "#DC2626", "#14B8A6", "#475569"];

type ColumnFormState = {
  name: string;
  color: string;
  isActive: boolean;
  isInitial: boolean;
};

type ActiveDragItem =
  | { type: "column"; columnId: string }
  | { type: "card"; cardId: string; columnId: string }
  | null;

function statusTone(status: ProjectStatus) {
  if (status === "ACTIVE") {
    return "success" as const;
  }

  if (status === "CANCELLED") {
    return "danger" as const;
  }

  return "neutral" as const;
}

function buildColumnForm(column?: KanbanColumnRecord | null): ColumnFormState {
  return {
    name: column?.name ?? "",
    color: column?.color ?? colorPresets[0],
    isActive: column?.isActive ?? true,
    isInitial: column?.isInitial ?? false,
  };
}

function normalizeBoardColumns(columns: KanbanBoardColumn[]) {
  const activeColumns = columns
    .filter((column) => column.isActive)
    .sort((left, right) => left.position - right.position)
    .map((column, index) => ({
      ...column,
      position: index,
      cards: column.cards.map((card, cardIndex) => ({
        ...card,
        placementColumnId: column.id,
        displayColumnId: column.id,
        displayPosition: cardIndex,
        hasExplicitPlacement: true,
      })),
    }));

  const inactiveColumns = columns
    .filter((column) => !column.isActive)
    .sort((left, right) => left.position - right.position)
    .map((column, index) => ({
      ...column,
      position: activeColumns.length + index,
      cards: [],
    }));

  return [...activeColumns, ...inactiveColumns];
}

function serializeBoard(columns: KanbanBoardColumn[]) {
  const activeColumns = columns
    .filter((column) => column.isActive)
    .sort((left, right) => left.position - right.position);

  return {
    action: "reorder_board" as const,
    orderedColumnIds: activeColumns.map((column) => column.id),
    columns: activeColumns.map((column) => ({
      columnId: column.id,
      projectIds: column.cards.map((card) => card.projectId),
    })),
  };
}

function moveCard(columns: KanbanBoardColumn[], cardId: string, sourceColumnId: string, targetColumnId: string, targetIndex: number) {
  const nextColumns = columns.map((column) => ({
    ...column,
    cards: column.cards.slice(),
  }));
  const sourceColumn = nextColumns.find((column) => column.id === sourceColumnId);
  const targetColumn = nextColumns.find((column) => column.id === targetColumnId);

  if (!sourceColumn || !targetColumn) {
    return columns;
  }

  const sourceIndex = sourceColumn.cards.findIndex((card) => card.projectId === cardId);
  if (sourceIndex < 0) {
    return columns;
  }

  const [card] = sourceColumn.cards.splice(sourceIndex, 1);
  if (!card) {
    return columns;
  }

  const normalizedTargetIndex = Math.max(0, Math.min(targetIndex, targetColumn.cards.length));
  targetColumn.cards.splice(normalizedTargetIndex, 0, card);

  return normalizeBoardColumns(nextColumns);
}

function findCardLocation(columns: KanbanBoardColumn[], cardId: string) {
  for (const column of columns) {
    const index = column.cards.findIndex((card) => card.projectId === cardId);
    if (index >= 0) {
      return { columnId: column.id, index };
    }
  }

  return null;
}

function boardSummary(columns: KanbanBoardColumn[]) {
  const activeColumns = columns.filter((column) => column.isActive);
  const totalCards = activeColumns.reduce((acc, column) => acc + column.cards.length, 0);
  return { activeColumns: activeColumns.length, totalCards };
}

function SortableKanbanColumn({
  column,
  disabled,
  onEdit,
}: {
  column: KanbanBoardColumn;
  disabled: boolean;
  onEdit: (column: KanbanColumnRecord) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: "column", columnId: column.id },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex h-full min-h-[34rem] w-[312px] shrink-0 flex-col rounded-[1.8rem] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,252,0.92))] shadow-[0_18px_44px_rgba(16,21,34,0.06)]",
        isDragging && "opacity-75 shadow-[0_24px_60px_rgba(16,21,34,0.16)]",
      )}
    >
      <div className="border-b border-black/6 px-5 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: column.color ?? "#94A3B8" }}
              />
              <h2 className="truncate text-sm font-semibold text-ink">{column.name}</h2>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{column.cards.length} proyectos</Badge>
              {column.isInitial ? <Badge tone="warning">Inicial</Badge> : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label={`Editar columna ${column.name}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/85 text-ink/65 transition hover:bg-black/5 hover:text-ink"
              onClick={() => onEdit(column)}
              title="Editar columna"
              type="button"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              aria-label={`Mover columna ${column.name}`}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/85 text-ink/60 transition hover:bg-black/5 hover:text-ink",
                disabled && "cursor-not-allowed opacity-50",
              )}
              title={disabled ? "Desactivado mientras haya filtros o demo mode" : "Arrastrar columna"}
              type="button"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
        <SortableContext items={column.cards.map((card) => card.projectId)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {column.cards.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-black/10 bg-white/55 px-4 py-8 text-center text-sm text-ink/48">
                Sin proyectos en esta columna.
              </div>
            ) : (
              column.cards.map((card) => <SortableProjectCard key={card.projectId} card={card} columnId={column.id} disabled={disabled} />)
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

function SortableProjectCard({
  card,
  columnId,
  disabled,
}: {
  card: KanbanProjectCard;
  columnId: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.projectId,
    data: { type: "card", columnId, cardId: card.projectId },
    disabled,
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-[1.45rem] border border-black/7 bg-white/88 p-4 shadow-[0_10px_26px_rgba(16,21,34,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(16,21,34,0.1)]",
        isDragging && "opacity-70 shadow-[0_18px_44px_rgba(16,21,34,0.14)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{card.projectName}</h3>
          <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-ink/45">{card.clientName}</p>
        </div>
        <button
          aria-label={`Mover ${card.projectName}`}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-ink/55 transition hover:bg-black/5 hover:text-ink",
            disabled && "cursor-not-allowed opacity-50",
          )}
          title={disabled ? "Desactivado mientras haya filtros o demo mode" : "Arrastrar tarjeta"}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={statusTone(card.projectStatus)}>{formatProjectStatus(card.projectStatus)}</Badge>
        {card.monthlyFeeUsd !== null ? <Badge tone="success">Fee {formatUsd(card.monthlyFeeUsd)}</Badge> : null}
        {card.devBudgetUsd !== null ? <Badge tone="neutral">Dev {formatUsd(card.devBudgetUsd)}</Badge> : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-ink/40">
          {card.monthlyFeeUsd !== null ? "Mantenimiento activo" : card.devBudgetUsd !== null ? "Presupuesto cargado" : "Sin meta financiera"}
        </div>
        <Link
          className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-cobalt transition hover:bg-cobalt/8"
          href={`/projects/${card.projectId}`}
          prefetch
        >
          Abrir
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function ColumnCard({
  column,
  onEdit,
}: {
  column: KanbanColumnRecord;
  onEdit: (column: KanbanColumnRecord) => void;
}) {
  return (
    <button
      className="flex min-w-[14rem] items-center justify-between gap-3 rounded-[1.2rem] border border-black/8 bg-white/76 px-3 py-3 text-left transition hover:bg-white"
      onClick={() => onEdit(column)}
      type="button"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: column.color ?? "#94A3B8" }}
          />
          <div className="truncate text-sm font-semibold text-ink">{column.name}</div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={column.isActive ? "success" : "neutral"}>{column.isActive ? "Activa" : "Inactiva"}</Badge>
          {column.isInitial ? <Badge tone="warning">Inicial</Badge> : null}
        </div>
      </div>
      <Pencil className="h-4 w-4 shrink-0 text-ink/45" />
    </button>
  );
}

export function KanbanScreen({
  board,
}: {
  board: KanbanBoardPayload;
}) {
  const [boardState, setBoardState] = useState(board);
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [onlyActiveProjects, setOnlyActiveProjects] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumnRecord | null>(null);
  const [columnForm, setColumnForm] = useState<ColumnFormState>(buildColumnForm());
  const [columnError, setColumnError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KanbanColumnRecord | null>(null);
  const [deleteTargetColumnId, setDeleteTargetColumnId] = useState("");
  const deferredQuery = useDeferredValue(query);
  const boardIsReadonly = boardState.demoMode || !boardState.persistenceAvailable;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  useEffect(() => {
    setBoardState(board);
  }, [board]);

  const filtersAreActive = Boolean(deferredQuery.trim() || clientFilter || statusFilter || onlyActiveProjects);
  const dragDisabled = boardIsReadonly || filtersAreActive || isPending;

  const visibleColumns = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return boardState.columns
      .filter((column) => column.isActive)
      .sort((left, right) => left.position - right.position)
      .map((column) => ({
        ...column,
        cards: column.cards.filter((card) => {
          if (normalizedQuery && !card.projectName.toLowerCase().includes(normalizedQuery)) {
            return false;
          }

          if (clientFilter && card.clientId !== clientFilter) {
            return false;
          }

          if (onlyActiveProjects && card.projectStatus !== "ACTIVE") {
            return false;
          }

          if (statusFilter && card.projectStatus !== statusFilter) {
            return false;
          }

          return true;
        }),
      }));
  }, [boardState.columns, clientFilter, deferredQuery, onlyActiveProjects, statusFilter]);

  const summary = useMemo(() => boardSummary(visibleColumns), [visibleColumns]);
  const totalSummary = useMemo(() => boardSummary(boardState.columns), [boardState.columns]);
  const configuredColumns = useMemo(
    () => boardState.columns.slice().sort((left, right) => left.position - right.position),
    [boardState.columns],
  );

  const activeDragCard = activeDragItem?.type === "card"
    ? boardState.columns.flatMap((column) => column.cards).find((card) => card.projectId === activeDragItem.cardId) ?? null
    : null;
  const activeDragColumn = activeDragItem?.type === "column"
    ? boardState.columns.find((column) => column.id === activeDragItem.columnId) ?? null
    : null;

  const availableReassignmentColumns = useMemo(
    () =>
      boardState.columns
        .filter((column) => column.isActive && column.id !== deleteTarget?.id)
        .sort((left, right) => left.position - right.position),
    [boardState.columns, deleteTarget?.id],
  );

  const persistBoard = (nextBoard: KanbanBoardPayload, previousBoard: KanbanBoardPayload) => {
    startTransition(async () => {
      try {
        setScreenError(null);
        const updatedBoard = await apiFetch<KanbanBoardPayload>("/api/kanban", {
          method: "PUT",
          body: JSON.stringify(serializeBoard(nextBoard.columns)),
        });
        setBoardState(updatedBoard);
      } catch (error) {
        setBoardState(previousBoard);
        setScreenError(error instanceof Error ? error.message : "No se pudo persistir el tablero.");
      }
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type;
    if (type === "column") {
      setActiveDragItem({ type: "column", columnId: String(event.active.id) });
      return;
    }

    if (type === "card") {
      setActiveDragItem({
        type: "card",
        cardId: String(event.active.id),
        columnId: String(event.active.data.current?.columnId),
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);

    if (dragDisabled || !event.over) {
      return;
    }

    const activeType = event.active.data.current?.type;
    const overType = event.over.data.current?.type;
    if (!activeType || !overType) {
      return;
    }

    if (activeType === "column" && overType === "column") {
      const activeColumns = boardState.columns.filter((column) => column.isActive).sort((left, right) => left.position - right.position);
      const activeIndex = activeColumns.findIndex((column) => column.id === event.active.id);
      const overIndex = activeColumns.findIndex((column) => column.id === event.over?.id);

      if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
        return;
      }

      const nextActiveColumns = arrayMove(activeColumns, activeIndex, overIndex);
      const inactiveColumns = boardState.columns.filter((column) => !column.isActive).sort((left, right) => left.position - right.position);
      const nextBoard = {
        ...boardState,
        columns: normalizeBoardColumns([...nextActiveColumns, ...inactiveColumns]),
      };

      setBoardState(nextBoard);
      persistBoard(nextBoard, boardState);
      return;
    }

    if (activeType !== "card") {
      return;
    }

    const sourceColumnId = String(event.active.data.current?.columnId ?? "");
    const sourceLocation = findCardLocation(boardState.columns, String(event.active.id));
    if (!sourceColumnId || !sourceLocation) {
      return;
    }

    const overColumnId = overType === "column"
      ? String(event.over.data.current?.columnId ?? event.over.id)
      : String(event.over.data.current?.columnId ?? "");
    if (!overColumnId) {
      return;
    }

    const overLocation = overType === "card" ? findCardLocation(boardState.columns, String(event.over.id)) : null;
    const targetIndex = overType === "card"
      ? Math.max(overLocation?.index ?? 0, 0)
      : boardState.columns.find((column) => column.id === overColumnId)?.cards.length ?? 0;

    if (sourceColumnId === overColumnId && overType === "card" && sourceLocation.index === overLocation?.index) {
      return;
    }

    const nextColumns = moveCard(boardState.columns, String(event.active.id), sourceColumnId, overColumnId, targetIndex);
    const nextBoard = {
      ...boardState,
      columns: nextColumns,
    };

    setBoardState(nextBoard);
    persistBoard(nextBoard, boardState);
  };

  const openCreateColumn = () => {
    setIsColumnModalOpen(true);
    setEditingColumn(null);
    setColumnForm(buildColumnForm());
    setColumnError(null);
  };

  const openEditColumn = (column: KanbanColumnRecord) => {
    setIsColumnModalOpen(true);
    setEditingColumn(column);
    setColumnForm(buildColumnForm(column));
    setColumnError(null);
  };

  const closeColumnModal = () => {
    setIsColumnModalOpen(false);
    setEditingColumn(null);
    setColumnForm(buildColumnForm());
    setColumnError(null);
  };

  const handleColumnSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      try {
        setColumnError(null);
        setScreenError(null);
        const nextBoard = await apiFetch<KanbanBoardPayload>("/api/kanban", {
          method: "PUT",
          body: JSON.stringify(
            editingColumn
              ? {
                  action: "update_column",
                  columnId: editingColumn.id,
                  name: columnForm.name,
                  color: columnForm.color || null,
                  isActive: columnForm.isActive,
                  isInitial: columnForm.isInitial,
                }
              : {
                  action: "create_column",
                  name: columnForm.name,
                  color: columnForm.color || null,
                  isActive: columnForm.isActive,
                  isInitial: columnForm.isInitial,
                },
          ),
        });
        setBoardState(nextBoard);
        closeColumnModal();
      } catch (error) {
        setColumnError(error instanceof Error ? error.message : "No se pudo guardar la columna.");
      }
    });
  };

  const openDeleteModal = () => {
    if (!editingColumn) {
      return;
    }

    setDeleteTarget(editingColumn);
    setDeleteTargetColumnId(
      boardState.columns
        .filter((column) => column.isActive && column.id !== editingColumn.id)
        .sort((left, right) => left.position - right.position)[0]?.id ?? "",
    );
    setColumnError(null);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteTargetColumnId("");
    setColumnError(null);
  };

  const handleDeleteColumn = () => {
    if (!deleteTarget) {
      return;
    }

    startTransition(async () => {
      try {
        setColumnError(null);
        setScreenError(null);
        const nextBoard = await apiFetch<KanbanBoardPayload>("/api/kanban", {
          method: "PUT",
          body: JSON.stringify({
            action: "delete_column",
            columnId: deleteTarget.id,
            targetColumnId: deleteTarget.assignmentCount > 0 ? deleteTargetColumnId : null,
          }),
        });
        setBoardState(nextBoard);
        closeDeleteModal();
        closeColumnModal();
      } catch (error) {
        setColumnError(error instanceof Error ? error.message : "No se pudo eliminar la columna.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Kanban"
        title="Kanban"
        description=""
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{totalSummary.activeColumns} columnas activas</Badge>
            <Badge tone="neutral">{summary.totalCards} proyectos visibles</Badge>
          </div>
        }
        actions={
          <div className="flex justify-start md:justify-end">
            <Button disabled={boardIsReadonly} onClick={openCreateColumn} type="button">
              <Plus className="mr-2 h-4 w-4" />
              Nueva columna
            </Button>
          </div>
        }
        demoMode={boardState.demoMode}
      />

      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <Input
              className="pl-11"
              placeholder="Buscar proyecto…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
            <option value="">Todos los clientes</option>
            {boardState.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos los estados</option>
            {projectStatusOptions.map((status) => (
              <option key={status} value={status}>
                {formatProjectStatus(status)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className={cn(
              "inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition",
              onlyActiveProjects
                ? "border-cobalt/20 bg-cobalt/10 text-cobalt"
                : "border-black/10 bg-white text-ink/72 hover:bg-black/5 hover:text-ink",
            )}
            onClick={() => setOnlyActiveProjects((current) => !current)}
            type="button"
          >
            {onlyActiveProjects ? "Solo proyectos activos" : "Ver todos los proyectos"}
          </button>
          <div className="text-sm text-ink/55">
            {boardState.demoMode ? "La vista opera en demo: podés explorar, pero no persistir cambios." : null}
            {!boardState.demoMode && !boardState.persistenceAvailable
              ? "El tablero quedó en modo lectura hasta aplicar la migración nueva."
              : null}
            {!boardIsReadonly && dragDisabled ? "El drag queda pausado mientras haya filtros activos." : null}
          </div>
        </div>

        {boardState.notice ? <p className="text-sm text-ink/58">{boardState.notice}</p> : null}
        {screenError ? <p className="text-sm text-brick">{screenError}</p> : null}
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/42">Tablero de proyectos</div>
            <p className="mt-1 text-sm text-ink/58">Arrastrá columnas y tarjetas para reordenar el seguimiento visual del pipeline.</p>
          </div>
          <Badge tone={dragDisabled ? "warning" : "success"}>
            {dragDisabled ? "Drag pausado" : "Drag activo"}
          </Badge>
        </div>

        {visibleColumns.length === 0 ? (
          <EmptyState
            title="Sin columnas activas"
            description="Activá al menos una columna desde la configuración del tablero para empezar a ordenar proyectos."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto px-4 pb-5 pt-4 md:px-5 md:pb-6 md:pt-5 lg:px-6">
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
                <SortableContext items={visibleColumns.map((column) => column.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex min-w-max gap-4">
                    {visibleColumns.map((column) => (
                      <SortableKanbanColumn key={column.id} column={column} disabled={dragDisabled} onEdit={openEditColumn} />
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activeDragColumn ? (
                    <div className="w-[312px] rounded-[1.8rem] border border-black/10 bg-white/95 p-5 shadow-[0_24px_60px_rgba(16,21,34,0.18)]">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: activeDragColumn.color ?? "#94A3B8" }}
                        />
                        <div className="text-sm font-semibold text-ink">{activeDragColumn.name}</div>
                      </div>
                    </div>
                  ) : null}
                  {activeDragCard ? (
                    <div className="w-[280px] rounded-[1.45rem] border border-black/10 bg-white/95 p-4 shadow-[0_24px_60px_rgba(16,21,34,0.18)]">
                      <div className="text-sm font-semibold text-ink">{activeDragCard.projectName}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">{activeDragCard.clientName}</div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </Card>
        )}
      </section>

      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/42">Estados configurados</div>
            <p className="mt-1 max-w-2xl text-sm text-ink/58">
              Editá el orden visual de las columnas, revisá cuáles están activas y ajustá los estados disponibles del tablero.
            </p>
          </div>
          <Button disabled={boardIsReadonly} onClick={openCreateColumn} type="button" variant="secondary">
            <Plus className="mr-2 h-4 w-4" />
            Agregar
          </Button>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {configuredColumns.map((column) => (
            <ColumnCard key={column.id} column={column} onEdit={openEditColumn} />
          ))}
        </div>
      </Card>

      <EditEntityModal
        open={isColumnModalOpen}
        title={editingColumn ? "Editar columna" : "Nueva columna"}
        description="Las columnas ordenan el seguimiento visual y, al mover tarjetas, tambien sincronizan el `status` operativo del proyecto."
        submitLabel={editingColumn ? "Guardar columna" : "Crear columna"}
        isPending={isPending}
        disabled={boardIsReadonly}
        error={columnError}
        onClose={closeColumnModal}
        onSubmit={handleColumnSubmit}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Nombre</label>
            <Input
              value={columnForm.name}
              onChange={(event) => setColumnForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Color</label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                aria-label="Color de la columna"
                className="h-11 w-14 rounded-2xl border border-black/10 bg-white p-1"
                type="color"
                value={columnForm.color || colorPresets[0]}
                onChange={(event) => setColumnForm((current) => ({ ...current, color: event.target.value }))}
              />
              <Input
                className="max-w-[12rem]"
                placeholder="#7C3AED"
                value={columnForm.color}
                onChange={(event) => setColumnForm((current) => ({ ...current, color: event.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((color) => (
                  <button
                    key={color}
                    aria-label={`Usar color ${color}`}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition",
                      columnForm.color === color ? "border-ink scale-110" : "border-white shadow-[0_0_0_1px_rgba(16,21,34,0.12)]",
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setColumnForm((current) => ({ ...current, color }))}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-[1.2rem] border border-black/8 bg-white/80 p-4">
              <input
                checked={columnForm.isActive}
                className="mt-0.5 h-4 w-4 rounded border-black/20 text-cobalt focus:ring-cobalt/20"
                type="checkbox"
                onChange={(event) => setColumnForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">Columna activa</span>
                <span className="mt-1 block text-sm text-ink/58">Las columnas inactivas salen del tablero pero siguen configuradas.</span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-[1.2rem] border border-black/8 bg-white/80 p-4">
              <input
                checked={columnForm.isInitial}
                className="mt-0.5 h-4 w-4 rounded border-black/20 text-cobalt focus:ring-cobalt/20"
                type="checkbox"
                onChange={(event) =>
                  setColumnForm((current) => ({
                    ...current,
                    isInitial: event.target.checked,
                    isActive: event.target.checked ? true : current.isActive,
                  }))
                }
              />
              <span>
                <span className="block text-sm font-semibold text-ink">Columna inicial</span>
                <span className="mt-1 block text-sm text-ink/58">Los proyectos sin asignación explícita caen acá por lectura.</span>
              </span>
            </label>
          </div>

          {editingColumn ? (
            <div className="flex justify-between gap-3 rounded-[1.2rem] border border-black/8 bg-black/[0.02] p-4">
              <div className="text-sm text-ink/62">
                {editingColumn.assignmentCount > 0
                  ? `Esta columna tiene ${editingColumn.assignmentCount} tarjeta(s) persistidas.`
                  : "No hay tarjetas persistidas en esta columna."}
              </div>
              <Button disabled={boardIsReadonly} onClick={openDeleteModal} type="button" variant="ghost">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </div>
          ) : null}
        </div>
      </EditEntityModal>

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Eliminar columna"
        description="Antes de borrar una columna con tarjetas persistidas, elegí a dónde moverlas para no perder trazabilidad del tablero."
        confirmLabel="Eliminar columna"
        isPending={isPending}
        disabled={boardIsReadonly || ((deleteTarget?.assignmentCount ?? 0) > 0 && !deleteTargetColumnId)}
        error={columnError}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteColumn}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <div className="text-sm text-ink/68">
              Columna: <span className="font-semibold text-ink">{deleteTarget.name}</span>.
            </div>
            {deleteTarget.assignmentCount > 0 ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Reasignar tarjetas a</label>
                <Select value={deleteTargetColumnId} onChange={(event) => setDeleteTargetColumnId(event.target.value)}>
                  <option value="">Elegí una columna destino</option>
                  {availableReassignmentColumns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="text-sm text-ink/58">No hay tarjetas persistidas en esta columna. La eliminación es directa.</p>
            )}
          </div>
        ) : null}
      </ConfirmActionModal>
    </div>
  );
}
