"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ModalPortal } from "@/components/ui/modal-portal";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { parsePastedTasks } from "@/lib/task-paste-parser";
import { applyProjectTaskChangesAction } from "@/app/projects/planning-actions";

type Status = "TODO" | "IN_PROGRESS" | "TO_REVIEW" | "BLOCKED" | "DONE";
type TaskType = "TASK" | "MILESTONE";

type PhaseDTO = { id: string; name: string; position: number };
type TaskDTO = {
  id: string;
  phaseId: string | null;
  name: string;
  description: string | null;
  type: TaskType;
  startDate: string;
  endDate: string;
  status: Status;
  position: number;
  clientVisible: boolean;
};

type Row = {
  id: string;
  isNew: boolean;
  original?: TaskDTO;
  name: string;
  description: string | null;
  phaseId: string | null;
  type: TaskType;
  startDate: string;
  endDate: string;
  status: Status;
  clientVisible: boolean;
  error?: string | null;
  expanded?: boolean;
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "TODO", label: "Por hacer" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "TO_REVIEW", label: "A revisar" },
  { value: "BLOCKED", label: "Bloqueado" },
  { value: "DONE", label: "Hecho" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isRowChanged(row: Row): boolean {
  if (row.isNew) return true;
  const o = row.original!;
  return (
    row.name !== o.name ||
    (row.description ?? "") !== (o.description ?? "") ||
    (row.phaseId ?? "") !== (o.phaseId ?? "") ||
    row.type !== o.type ||
    row.startDate.slice(0, 10) !== o.startDate.slice(0, 10) ||
    row.endDate.slice(0, 10) !== o.endDate.slice(0, 10) ||
    row.status !== o.status ||
    row.clientVisible !== o.clientVisible
  );
}

export function TaskManagerModal({
  open,
  onClose,
  projectId,
  phases,
  tasks,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  phases: PhaseDTO[];
  tasks: TaskDTO[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaults, setDefaults] = useState<{
    phaseId: string | null;
    status: Status;
    type: TaskType;
    startDate: string;
    endDate: string;
    clientVisible: boolean;
  }>(() => ({
    phaseId: null,
    status: "TODO",
    type: "TASK",
    startDate: todayISO(),
    endDate: todayISO(),
    clientVisible: true,
  }));
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    if (!open) return;
    const mapped: Row[] = tasks.map((t) => ({
      id: t.id,
      isNew: false,
      original: t,
      name: t.name,
      description: t.description,
      phaseId: t.phaseId,
      type: t.type,
      startDate: t.startDate.slice(0, 10),
      endDate: t.endDate.slice(0, 10),
      status: t.status,
      clientVisible: t.clientVisible,
      expanded: false,
    }));
    setRows(mapped);
    setDeletedIds([]);
    setSelected(new Set());
    setSearch("");
    setPhaseFilter("all");
    setStatusFilter("all");
    setPasteText("");
    setPasteError(null);
    setSaveError(null);
    // defaults keep phase/status but reset dates to today
    setDefaults((d) => ({ ...d, startDate: todayISO(), endDate: todayISO() }));
  }, [open, tasks]);

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (phaseFilter !== "all") {
        const want = phaseFilter === "none" ? null : phaseFilter;
        if ((r.phaseId ?? null) !== want) return false;
      }
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, phaseFilter, statusFilter]);

  const hasChanges = useMemo(() => {
    if (deletedIds.length > 0) return true;
    return rows.some((r) => isRowChanged(r));
  }, [rows, deletedIds]);

  const changesCount = useMemo(() => {
    let c = deletedIds.length;
    for (const r of rows) if (isRowChanged(r)) c++;
    return c;
  }, [rows, deletedIds]);

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of visibleRows) next.delete(r.id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of visibleRows) next.add(r.id);
        return next;
      });
    }
  };

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, error: null } : r)));
  };

  const addRow = () => {
    const tempId = `new-${Date.now()}-${counter}`;
    setCounter((c) => c + 1);
    const row: Row = {
      id: tempId,
      isNew: true,
      name: "",
      description: null,
      phaseId: defaults.phaseId,
      type: defaults.type,
      startDate: defaults.startDate,
      endDate: defaults.type === "MILESTONE" ? defaults.startDate : defaults.endDate,
      status: defaults.status,
      clientVisible: defaults.clientVisible,
      expanded: false,
    };
    setRows((prev) => [...prev, row]);
  };

  const handlePaste = () => {
    setPasteError(null);
    const result = parsePastedTasks(pasteText, phases, {
      phaseId: defaults.phaseId,
      status: defaults.status,
      type: defaults.type,
      startDate: defaults.startDate,
      endDate: defaults.endDate,
      clientVisible: defaults.clientVisible,
    });
    if (result.errors.length > 0) {
      setPasteError(result.errors.map((e) => `Línea ${e.line}: ${e.message}`).join(" | "));
      return;
    }
    if (result.rows.length === 0) {
      setPasteError("No se detectaron tareas.");
      return;
    }
    const newRows: Row[] = result.rows.map((pr, idx) => ({
      id: `new-${Date.now()}-${counter + idx}`,
      isNew: true,
      name: pr.name,
      description: null,
      phaseId: pr.phaseId,
      type: (pr.type as TaskType) ?? defaults.type,
      startDate: pr.startDate ?? defaults.startDate,
      endDate: pr.type === "MILESTONE" ? pr.startDate ?? defaults.startDate : pr.endDate ?? defaults.endDate,
      status: (pr.status as Status) ?? defaults.status,
      clientVisible: defaults.clientVisible,
      expanded: false,
    }));
    setCounter((c) => c + result.rows.length);
    setRows((prev) => [...prev, ...newRows]);
    setPasteText("");
    setShowPaste(false);
  };

  const handleDelete = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (row.isNew) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      setDeletedIds((prev) => [...prev, id]);
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleUndoDelete = (id: string, original: TaskDTO) => {
    setDeletedIds((prev) => prev.filter((x) => x !== id));
    setRows((prev) => [
      ...prev,
      {
        id,
        isNew: false,
        original,
        name: original.name,
        description: original.description,
        phaseId: original.phaseId,
        type: original.type,
        startDate: original.startDate.slice(0, 10),
        endDate: original.endDate.slice(0, 10),
        status: original.status,
        clientVisible: original.clientVisible,
        expanded: false,
      },
    ]);
  };

  const applyBulk = (field: "status" | "phaseId" | "clientVisible", value: any) => {
    if (selected.size === 0) return;
    setRows((prev) =>
      prev.map((r) => {
        if (!selected.has(r.id)) return r;
        if (field === "status") return { ...r, status: value as Status, error: null };
        if (field === "phaseId") return { ...r, phaseId: value as string | null, error: null };
        if (field === "clientVisible") return { ...r, clientVisible: value as boolean, error: null };
        return r;
      }),
    );
  };

  const handleSave = async () => {
    setSaveError(null);
    // client validation
    const rowErrors = new Map<string, string>();
    for (const r of rows) {
      if (!r.name.trim()) rowErrors.set(r.id, "Nombre requerido.");
      else if (!r.startDate) rowErrors.set(r.id, "Fecha inicio requerida.");
      else if (!r.endDate) rowErrors.set(r.id, "Fecha fin requerida.");
      else if (r.type === "TASK" && r.startDate > r.endDate) rowErrors.set(r.id, "Fin anterior a inicio.");
    }
    if (rowErrors.size > 0) {
      setRows((prev) => prev.map((r) => ({ ...r, error: rowErrors.get(r.id) ?? null })));
      setSaveError("Revisá las filas con error.");
      return;
    }

    const creates = rows
      .filter((r) => r.isNew)
      .map((r) => ({
        name: r.name.trim(),
        description: r.description?.trim() || null,
        phaseId: r.phaseId,
        type: r.type,
        startDate: r.startDate,
        endDate: r.type === "MILESTONE" ? r.startDate : r.endDate,
        status: r.status,
        clientVisible: r.clientVisible,
      }));

    const updates = rows
      .filter((r) => !r.isNew && isRowChanged(r))
      .map((r) => ({
        id: r.id,
        name: r.name.trim(),
        description: r.description?.trim() || null,
        phaseId: r.phaseId,
        type: r.type,
        startDate: r.startDate,
        endDate: r.type === "MILESTONE" ? r.startDate : r.endDate,
        status: r.status,
        clientVisible: r.clientVisible,
      }));

    const payload = {
      projectId,
      creates,
      updates,
      deletes: deletedIds,
    };

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("payload", JSON.stringify(payload));
      const res = await applyProjectTaskChangesAction(null, fd);
      if (!res.success) {
        setSaveError(res.message);
        return;
      }
      router.refresh();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      setShowConfirmClose(true);
      return;
    }
    onClose();
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[90] overflow-y-auto px-2 py-4 sm:px-4">
        <button aria-label="Cerrar" className="fixed inset-0 bg-ink/45 backdrop-blur-sm" onClick={handleClose} type="button" />
        <div className="relative mx-auto flex min-h-full w-full max-w-6xl items-start justify-center">
          <div className="relative w-full rounded-2xl bg-white shadow-[0_24px_80px_rgba(16,21,34,0.18)]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="font-display text-xl text-ink">Gestionar tareas</h2>
                <p className="text-xs text-ink/50">{rows.length} tareas {changesCount > 0 && `· ${changesCount} sin guardar`}</p>
              </div>
              <button onClick={handleClose} className="rounded-lg p-2 text-ink/60 hover:bg-gray-100" aria-label="Cerrar">
                ✕
              </button>
            </div>

            {/* Filters + defaults */}
            <div className="space-y-3 border-b border-gray-100 bg-gray-50/50 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-40 text-sm" />
                <Select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className="h-8 w-auto text-xs">
                  <option value="all">Fase: Todas</option>
                  <option value="none">Sin fase</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 w-auto text-xs">
                  <option value="all">Estado: Todos</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <div className="ml-auto flex gap-2">
                  <Button variant="secondary" className="h-8 text-xs" onClick={addRow}>
                    + Agregar tarea
                  </Button>
                  <Button variant="secondary" className="h-8 text-xs" onClick={() => setShowPaste((v) => !v)}>
                    Pegar varias
                  </Button>
                </div>
              </div>

              {showPaste && (
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-ink/60">Pega una tarea por línea o copia filas desde Excel/Sheets.</p>
                  <p className="mt-1 text-xs text-ink/40">Columnas compatibles: Tarea, Fase, Estado, Inicio y Fin.</p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={"Crear API clientes\nDiseñar dashboard\nIntegrar WhatsApp"}
                    className="mt-2 min-h-[96px] w-full rounded-lg border border-gray-200 p-2 text-sm outline-none focus:border-brand"
                  />
                  {pasteError && <p className="mt-1 text-xs text-brick">{pasteError}</p>}
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" className="h-7 text-xs" onClick={() => setShowPaste(false)}>
                      Cancelar
                    </Button>
                    <Button className="h-7 text-xs" onClick={handlePaste}>
                      Agregar {pasteText.split(/\r?\n/).filter((l) => l.trim()).length} tareas
                    </Button>
                  </div>
                </div>
              )}

              <details className="rounded-lg border border-gray-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink/70">Valores para nuevas tareas</summary>
                <div className="grid gap-2 border-t border-gray-100 p-3 sm:grid-cols-6">
                  <Select value={defaults.phaseId ?? ""} onChange={(e) => setDefaults((d) => ({ ...d, phaseId: e.target.value || null }))} className="h-8 text-xs">
                    <option value="">Sin fase</option>
                    {phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Select value={defaults.status} onChange={(e) => setDefaults((d) => ({ ...d, status: e.target.value as Status }))} className="h-8 text-xs">
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  <Select value={defaults.type} onChange={(e) => setDefaults((d) => ({ ...d, type: e.target.value as TaskType }))} className="h-8 text-xs">
                    <option value="TASK">Tarea</option>
                    <option value="MILESTONE">Hito</option>
                  </Select>
                  <Input type="date" value={defaults.startDate} onChange={(e) => setDefaults((d) => ({ ...d, startDate: e.target.value, endDate: d.type === "MILESTONE" ? e.target.value : d.endDate }))} className="h-8 text-xs" />
                  <Input type="date" value={defaults.endDate} onChange={(e) => setDefaults((d) => ({ ...d, endDate: e.target.value }))} className="h-8 text-xs" disabled={defaults.type === "MILESTONE"} />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={defaults.clientVisible} onChange={(e) => setDefaults((d) => ({ ...d, clientVisible: e.target.checked }))} /> Cliente
                  </label>
                </div>
              </details>

              {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2">
                  <span className="text-xs font-medium text-ink">{selected.size} seleccionadas</span>
                  <Select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) applyBulk("status", e.target.value);
                      e.target.value = "";
                    }}
                    className="h-7 w-auto text-xs"
                  >
                    <option value="">Estado…</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value=""
                    onChange={(e) => {
                      if (e.target.value !== "") applyBulk("phaseId", e.target.value || null);
                      e.target.value = "";
                    }}
                    className="h-7 w-auto text-xs"
                  >
                    <option value="">Fase…</option>
                    <option value="">Sin fase</option>
                    {phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) applyBulk("clientVisible", e.target.value === "true");
                      e.target.value = "";
                    }}
                    className="h-7 w-auto text-xs"
                  >
                    <option value="">Cliente…</option>
                    <option value="true">Visible</option>
                    <option value="false">Oculta</option>
                  </Select>
                  <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-ink/60 hover:text-ink">
                    Deseleccionar
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-gray-200 text-xs text-ink/50">
                    <th className="w-8 px-2 py-2">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                    </th>
                    <th className="px-2 py-2 text-left font-medium">Tarea</th>
                    <th className="hidden px-2 py-2 text-left font-medium sm:table-cell">Fase</th>
                    <th className="hidden px-2 py-2 text-left font-medium sm:table-cell">Estado</th>
                    <th className="hidden px-2 py-2 text-left font-medium md:table-cell">Inicio</th>
                    <th className="hidden px-2 py-2 text-left font-medium md:table-cell">Fin</th>
                    <th className="px-2 py-2 text-center font-medium">Cliente</th>
                    <th className="w-8 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-ink/40">
                        Sin tareas para este filtro.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => (
                      <React.Fragment key={row.id}>
                        <tr className={`border-b border-gray-100 ${row.error ? "bg-brick/5" : ""} ${isRowChanged(row) ? "bg-amber-50/50" : ""}`}>
                          <td className="px-2 py-1">
                            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={row.name} onChange={(e) => updateRow(row.id, { name: e.target.value })} placeholder="Nombre" className="h-7 text-sm" />
                            {row.error && <p className="mt-1 text-xs text-brick">{row.error}</p>}
                            <div className="mt-1 flex gap-1 sm:hidden">
                              <Select value={row.phaseId ?? ""} onChange={(e) => updateRow(row.id, { phaseId: e.target.value || null })} className="h-6 flex-1 text-xs">
                                <option value="">Sin fase</option>
                                {phases.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </Select>
                              <Select value={row.status} onChange={(e) => updateRow(row.id, { status: e.target.value as Status })} className="h-6 flex-1 text-xs">
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          </td>
                          <td className="hidden px-2 py-1 sm:table-cell">
                            <Select value={row.phaseId ?? ""} onChange={(e) => updateRow(row.id, { phaseId: e.target.value || null })} className="h-7 text-xs">
                              <option value="">Sin fase</option>
                              {phases.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="hidden px-2 py-1 sm:table-cell">
                            <Select value={row.status} onChange={(e) => updateRow(row.id, { status: e.target.value as Status })} className="h-7 text-xs">
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="hidden px-2 py-1 md:table-cell">
                            <Input type="date" value={row.startDate} onChange={(e) => updateRow(row.id, { startDate: e.target.value, endDate: row.type === "MILESTONE" ? e.target.value : row.endDate })} className="h-7 text-xs" />
                          </td>
                          <td className="hidden px-2 py-1 md:table-cell">
                            <Input type="date" value={row.endDate} onChange={(e) => updateRow(row.id, { endDate: e.target.value })} className="h-7 text-xs" disabled={row.type === "MILESTONE"} />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <input type="checkbox" checked={row.clientVisible} onChange={(e) => updateRow(row.id, { clientVisible: e.target.checked })} />
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateRow(row.id, { expanded: !row.expanded })}
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-ink/50 hover:bg-gray-100 hover:text-ink"
                                title="Ver detalles"
                                aria-label="Ver detalles de la tarea"
                              >
                                <ChevronDown className={`h-4 w-4 transition-transform ${row.expanded ? "rotate-180" : ""}`} />
                              </button>
                              <button
                                onClick={() => handleDelete(row.id)}
                                className="rounded p-1 text-brick/60 hover:bg-brick/10"
                                title="Eliminar tarea"
                                aria-label="Eliminar tarea"
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                        {row.expanded && (
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <td colSpan={8} className="px-4 py-3">
                              <div className="grid gap-2 sm:grid-cols-3">
                                <Select value={row.type} onChange={(e) => updateRow(row.id, { type: e.target.value as TaskType, endDate: e.target.value === "MILESTONE" ? row.startDate : row.endDate })} className="h-7 text-xs">
                                  <option value="TASK">Tarea</option>
                                  <option value="MILESTONE">Hito</option>
                                </Select>
                                <div className="sm:col-span-2 flex gap-2 md:hidden">
                                  <Input type="date" value={row.startDate} onChange={(e) => updateRow(row.id, { startDate: e.target.value, endDate: row.type === "MILESTONE" ? e.target.value : row.endDate })} className="h-7 flex-1 text-xs" />
                                  <Input type="date" value={row.endDate} onChange={(e) => updateRow(row.id, { endDate: e.target.value })} className="h-7 flex-1 text-xs" disabled={row.type === "MILESTONE"} />
                                </div>
                                <textarea
                                  placeholder="Descripción (opcional)"
                                  value={row.description ?? ""}
                                  onChange={(e) => updateRow(row.id, { description: e.target.value })}
                                  className="min-h-[56px] rounded-lg border border-gray-200 p-2 text-sm outline-none focus:border-brand sm:col-span-3"
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {deletedIds.length > 0 && (
              <div className="border-t border-amber-200 bg-amber-50 px-5 py-2 text-xs text-ink/70">
                {deletedIds.length} tarea(s) marcada(s) para eliminar. Se eliminarán al guardar.{" "}
                {deletedIds.map((id) => {
                  const orig = tasks.find((t) => t.id === id);
                  if (!orig) return null;
                  return (
                    <button key={id} onClick={() => handleUndoDelete(id, orig)} className="ml-2 underline">
                      Deshacer {orig.name.slice(0, 12)}
                    </button>
                  );
                })}
              </div>
            )}

            {saveError && <p className="border-t border-brick/20 bg-brick/5 px-5 py-2 text-sm text-brick">{saveError}</p>}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
              <Button variant="ghost" onClick={handleClose} disabled={saving}>
                Cancelar
              </Button>
              <div className="flex items-center gap-3">
                {hasChanges && <span className="text-xs text-ink/50">{changesCount} sin guardar</span>}
                <Button onClick={handleSave} disabled={!hasChanges || saving}>
                  {saving ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmActionModal
        open={showConfirmClose}
        title="Descartar cambios"
        description="Hay cambios sin guardar. ¿Descartar?"
        confirmLabel="Descartar"
        isPending={false}
        error={null}
        onClose={() => setShowConfirmClose(false)}
        onConfirm={() => {
          setShowConfirmClose(false);
          onClose();
        }}
      />
    </ModalPortal>
  );
}
