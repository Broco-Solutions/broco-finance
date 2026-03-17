"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { FormEvent, useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClientRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { DataTable } from "@/components/ui/data-table";
import { EditEntityModal } from "@/components/ui/edit-entity-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";

type ClientFormState = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

const emptyForm: ClientFormState = {
  name: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
};

function actionButtonClass(tone: "neutral" | "danger" = "neutral") {
  return tone === "danger"
    ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-brick/15 bg-brick/5 text-brick transition hover:bg-brick/10"
    : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:bg-black/5";
}

function toPayload(form: ClientFormState) {
  return {
    name: form.name,
    contactName: form.contactName || null,
    contactEmail: form.contactEmail || null,
    contactPhone: form.contactPhone || null,
    notes: form.notes || null,
  };
}

function getContactLine(client: ClientRecord) {
  return [client.contactName, client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
}

export function ClientsScreen({
  clients,
  demoMode,
}: {
  clients: ClientRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [editForm, setEditForm] = useState<ClientFormState>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      clients.filter((client) => {
        const haystack = [
          client.name,
          client.contactName,
          client.contactEmail,
          client.contactPhone,
          client.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(deferredQuery.toLowerCase());
      }),
    [clients, deferredQuery],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch("/api/clients", {
          method: "POST",
          body: JSON.stringify(toPayload(form)),
        });
        setForm(emptyForm);
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo crear el cliente.");
      }
    });
  };

  const openEditModal = (client: ClientRecord) => {
    setEditingClient(client);
    setEditForm({
      name: client.name,
      contactName: client.contactName ?? "",
      contactEmail: client.contactEmail ?? "",
      contactPhone: client.contactPhone ?? "",
      notes: client.notes ?? "",
    });
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingClient(null);
    setEditForm(emptyForm);
    setEditError(null);
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingClient) {
      return;
    }

    startTransition(async () => {
      try {
        setEditError(null);
        await apiFetch(`/api/clients/${editingClient.id}`, {
          method: "PUT",
          body: JSON.stringify(toPayload(editForm)),
        });
        closeEditModal();
        router.refresh();
      } catch (submitError) {
        setEditError(submitError instanceof Error ? submitError.message : "No se pudo actualizar el cliente.");
      }
    });
  };

  const openDeleteModal = (client: ClientRecord) => {
    setDeletingClient(client);
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    setDeletingClient(null);
    setDeleteError(null);
  };

  const handleDelete = () => {
    if (!deletingClient) {
      return;
    }

    startTransition(async () => {
      try {
        setDeleteError(null);
        await apiFetch(`/api/clients/${deletingClient.id}`, {
          method: "DELETE",
        });
        closeDeleteModal();
        router.refresh();
      } catch (submitError) {
        setDeleteError(submitError instanceof Error ? submitError.message : "No se pudo eliminar el cliente.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clientes"
        title="Clientes"
        description=""
        demoMode={demoMode}
      />

      <div className="space-y-6">
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <h2 className="font-display text-2xl text-ink">Nuevo cliente</h2>
              <p className="mt-1 text-sm text-ink/55">Incluí datos de contacto desde el alta para no dejar la relación comercial incompleta.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Nombre comercial</label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Contacto</label>
                <Input value={form.contactName} onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Teléfono</label>
                <Input type="tel" value={form.contactPhone} onChange={(event) => setForm((prev) => ({ ...prev, contactPhone: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Email</label>
              <Input type="email" value={form.contactEmail} onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Notas</label>
              <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </div>
            {error ? <p className="text-sm text-brick">{error}</p> : null}
            <Button type="submit" disabled={isPending || demoMode || !form.name.trim()}>
              {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Crear cliente"}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-ink">Base de clientes</h2>
              <p className="mt-1 text-sm text-ink/55">Las acciones viven en la tabla para editar o intentar eliminar sin salir de la vista principal.</p>
            </div>
            <div className="w-full max-w-sm">
              <Input placeholder="Buscar cliente o contacto…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="Sin clientes" description="Cuando cargues clientes, vas a ver su facturación, deuda pendiente y proyectos asociados." />
          ) : (
            <DataTable headers={["Cliente", "Acordado", "Por cobrar", "Proyectos", "Acciones"]}>
              {filtered.map((client) => {
                const contactLine = getContactLine(client);

                return (
                  <tr key={client.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{client.name}</div>
                      <div className="mt-1 text-xs text-ink/55">{contactLine || "Sin datos de contacto"}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/40">{client.notes ?? "Sin notas"}</div>
                    </td>
                    <td className="px-4 py-3">{formatUsd(client.totalInvoicedUsd)}</td>
                    <td className="px-4 py-3">{formatUsd(client.totalReceivableUsd)}</td>
                    <td className="px-4 py-3">{client.activeProjects}/{client.totalProjects}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          aria-label={`Editar ${client.name}`}
                          className={actionButtonClass()}
                          onClick={() => openEditModal(client)}
                          title="Editar cliente"
                          type="button"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`Eliminar ${client.name}`}
                          className={actionButtonClass("danger")}
                          onClick={() => openDeleteModal(client)}
                          title="Eliminar cliente"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Link className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold text-cobalt transition hover:bg-cobalt/8" href={`/clients/${client.id}`}>
                          Abrir
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>
      </div>

      <EditEntityModal
        open={Boolean(editingClient)}
        title="Editar cliente"
        description="Actualizá el nombre comercial, la persona de contacto y los canales de comunicación sin salir del listado."
        submitLabel="Guardar cliente"
        isPending={isPending}
        disabled={demoMode}
        error={editError}
        onClose={closeEditModal}
        onSubmit={handleEditSubmit}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Nombre comercial</label>
            <Input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Contacto</label>
              <Input value={editForm.contactName} onChange={(event) => setEditForm((prev) => ({ ...prev, contactName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Teléfono</label>
              <Input type="tel" value={editForm.contactPhone} onChange={(event) => setEditForm((prev) => ({ ...prev, contactPhone: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Email</label>
            <Input type="email" value={editForm.contactEmail} onChange={(event) => setEditForm((prev) => ({ ...prev, contactEmail: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Notas</label>
            <Textarea value={editForm.notes} onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </div>
          {demoMode ? <p className="text-sm text-ink/55">La edición persistente requiere `DATABASE_URL`.</p> : null}
        </div>
      </EditEntityModal>

      <ConfirmActionModal
        open={Boolean(deletingClient)}
        title="Eliminar cliente"
        description="Esta acción intenta borrar el cliente de forma permanente. Si todavía tiene proyectos asociados, el sistema va a bloquear la operación."
        confirmLabel="Eliminar cliente"
        isPending={isPending}
        disabled={demoMode || Boolean(deletingClient && deletingClient.totalProjects > 0)}
        error={deleteError}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
      >
        {deletingClient ? (
          <div className="space-y-2 text-sm text-ink/70">
            <p>
              Vas a eliminar <span className="font-semibold text-ink">{deletingClient.name}</span>.
            </p>
            <p>
              Proyectos asociados: <span className="font-semibold text-ink">{deletingClient.totalProjects}</span>.
            </p>
            {deletingClient.activeProjects > 0 ? (
              <p className="text-brick">
                Tiene proyectos activos. Primero necesitás completarlos o cancelarlos.
              </p>
            ) : deletingClient.totalProjects > 0 ? (
              <p className="text-brick">
                Todavía tiene proyectos históricos asociados. Eliminá esos proyectos antes de borrar el cliente.
              </p>
            ) : (
              <p className="text-ink/65">No hay relaciones activas detectadas, así que la baja debería completarse sin bloqueo.</p>
            )}
            {demoMode ? <p>La eliminación persistente requiere `DATABASE_URL`.</p> : null}
          </div>
        ) : null}
      </ConfirmActionModal>
    </div>
  );
}
