"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [search, setSearch] = useState("");

  const filtered = clients.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contactName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.contactEmail ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.contactPhone ?? "").toLowerCase().includes(search.toLowerCase())
  );

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
    await saveClient(null, fd);
    setShowForm(false);
    setEditing(null);
    setTimeout(() => window.location.reload(), 500);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const fd = new FormData();
    fd.set("id", deleteTarget.id);
    await removeClient(null, fd);
    setDeleteTarget(null);
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <>
      {/* Totalizador, busqueda y boton nuevo */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Total de clientes</span>
          <span className="text-lg font-bold tabular-nums text-gray-900">{filtered.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Input
            placeholder="Buscar cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => { setEditing(null); setShowForm(true); }}>Nuevo cliente</Button>
      </div>
      {/* DESKTOP TABLE */}
      <div className="hidden md:block">
      <DataTable tableClassName="table-fixed" headers={["Nombre", "Contacto", "Email", "Telefono", "Proyectos", "Acciones"]}
        colGroup={<colgroup><col style={{width:"24%"}} /><col style={{width:"16%"}} /><col style={{width:"18%"}} /><col style={{width:"12%"}} /><col style={{width:"8%"}} /><col style={{width:"22%"}} /></colgroup>}
      >
        {filtered.map((c) => (
          <tr key={c.id}>
            <td className="px-4 py-2.5 align-middle">
              <div className="line-clamp-2 break-words" title={c.name}>
              <Link href={`/clients/${c.id}`} className="text-cobalt underline">
                {c.name}
              </Link>
              </div>
            </td>
            <td className="px-4 py-2.5 align-middle"><div className="line-clamp-2 break-words" title={c.contactName ?? ""}>{c.contactName ?? "—"}</div></td>
            <td className="px-4 py-2.5 text-sm break-all" title={c.contactEmail ?? ""}>{c.contactEmail ?? "—"}</td>
            <td className="px-4 py-2.5 whitespace-nowrap text-sm">{c.contactPhone ?? "—"}</td>
            <td className="px-4 py-2.5 text-center text-sm">{c._count.projects}</td>
            <td className="px-4 py-2.5 space-x-2 whitespace-nowrap">
              <Button variant="secondary" className="text-xs" onClick={() => { setEditing(c); setShowForm(true); }}>
                Editar
              </Button>
              <Button variant="secondary" className="text-xs text-brick" onClick={() => setDeleteTarget(c)}>
                Eliminar
              </Button>
            </td>
          </tr>
        ))}
      </DataTable>
      </div>

      {/* MOBILE CARDS */}
      <div className="space-y-2 md:hidden">
        {filtered.map((c) => (
          <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <Link href={`/clients/${c.id}`} className="font-medium text-sm text-cobalt underline">{c.name}</Link>
              <span className="text-xs text-gray-500">{c._count.projects} proy.</span>
            </div>
            <div className="text-xs text-gray-400 space-y-0.5">
              {c.contactName && <div>Contacto: {c.contactName}</div>}
              {c.contactEmail && <div>{c.contactEmail}</div>}
              {c.contactPhone && <div>{c.contactPhone}</div>}
            </div>
            <div className="flex gap-1 pt-1">
              <Button variant="secondary" className="text-xs flex-1" onClick={() => { setEditing(c); setShowForm(true); }}>Editar</Button>
              <Button variant="secondary" className="text-xs flex-1 text-brick" onClick={() => setDeleteTarget(c)}>Eliminar</Button>
            </div>
          </div>
        ))}
      </div>

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
        isPending={false}
        error={null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
