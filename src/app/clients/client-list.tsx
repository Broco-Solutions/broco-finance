"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { ClientFormModal } from "@/components/screens/client-form-modal";
import { saveClient, removeClient } from "./actions";

type Client = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  _count: { projects: number };
};

export function ClientList({ clients: initial }: { clients: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initial);
  const [editing, setEditing] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const [isPending, startTransition] = useTransition();

  // Refresh client list after server action completes
  const refresh = () => {
    // revalidatePath handles this, but we reload via navigation or refetch
    window.location.reload();
  };

  const handleSave = async (data: Record<string, string>) => {
    const fd = new FormData();
    if (editing) fd.set("id", editing.id);
    fd.set("name", data.name);
    fd.set("contactName", data.contactName ?? "");
    fd.set("contactEmail", data.contactEmail ?? "");
    fd.set("contactPhone", data.contactPhone ?? "");
    fd.set("notes", data.notes ?? "");
    startTransition(() => { saveClient(null, fd); });
    setShowForm(false);
    setEditing(null);
    setTimeout(() => window.location.reload(), 500);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const fd = new FormData();
    fd.set("id", deleteTarget.id);
    startTransition(() => { removeClient(null, fd); });
    setDeleteTarget(null);
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <>
      <DataTable headers={["Nombre", "Contacto", "Email", "Telefono", "Proyectos", "Acciones"]}>
        {clients.map((c) => (
          <tr key={c.id}>
            <td className="px-4 py-3">
              <Link href={`/clients/${c.id}`} className="text-cobalt underline">
                {c.name}
              </Link>
            </td>
            <td className="px-4 py-3">{c.contactName ?? "—"}</td>
            <td className="px-4 py-3">{c.contactEmail ?? "—"}</td>
            <td className="px-4 py-3">{c.contactPhone ?? "—"}</td>
            <td className="px-4 py-3">{c._count.projects}</td>
            <td className="px-4 py-3 space-x-2">
              <Button variant="secondary" onClick={() => { setEditing(c); setShowForm(true); }}>
                Editar
              </Button>
              <Button variant="secondary" className="text-brick" onClick={() => setDeleteTarget(c)}>
                Eliminar
              </Button>
            </td>
          </tr>
        ))}
      </DataTable>

      <ClientFormModal
        open={showForm}
        title={editing ? "Editar cliente" : "Nuevo cliente"}
        initial={editing ? {
          name: editing.name,
          contactName: editing.contactName ?? "",
          contactEmail: editing.contactEmail ?? "",
          contactPhone: editing.contactPhone ?? "",
        } : undefined}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave}
      />

      <ConfirmActionModal
        open={!!deleteTarget}
        title="Eliminar cliente"
        description={`¿Eliminar "${deleteTarget?.name}"? Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        isPending={isPending}
        error={null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
