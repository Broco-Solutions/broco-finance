"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectFormModal } from "@/app/projects/project-form-modal";
import { saveProject } from "@/app/projects/actions";

type Project = {
  id: string;
  name: string;
  isActive: boolean;
  startDate: string | Date | null;
  endDate: string | Date | null;
  _count: { incomes: number; expenses: number };
};

type ClientOption = { id: string; name: string };

export function ClientProjectsSection({
  clientId,
  clientName,
  projects: initialProjects,
  clients,
}: {
  clientId: string;
  clientName: string;
  projects: Project[];
  clients: ClientOption[];
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [showForm, setShowForm] = useState(false);

  const handleSave = async (data: Record<string, unknown>) => {
    const fd = new FormData();
    fd.set("clientId", data.clientId as string);
    fd.set("name", data.name as string);
    fd.set("isActive", data.isActive ? "true" : "false");
    if (data.startDate) fd.set("startDate", data.startDate as string);
    if (data.endDate) fd.set("endDate", data.endDate as string);
    if (data.notes) fd.set("notes", data.notes as string);
    if (data.oneTimeOriginalAmount != null) {
      fd.set("oneTimeOriginalAmount", String(data.oneTimeOriginalAmount));
      fd.set("oneTimeCurrency", (data.oneTimeCurrency as string) || "USD");
      if (data.oneTimeExchangeRate != null) fd.set("oneTimeExchangeRate", String(data.oneTimeExchangeRate));
    }
    if (data.monthlyRecurringOriginalAmount != null) {
      fd.set("monthlyRecurringOriginalAmount", String(data.monthlyRecurringOriginalAmount));
      fd.set("monthlyRecurringCurrency", (data.monthlyRecurringCurrency as string) || "USD");
      if (data.monthlyRecurringExchangeRate != null) fd.set("monthlyRecurringExchangeRate", String(data.monthlyRecurringExchangeRate));
    }
    await saveProject(null, fd);
    setShowForm(false);
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ink">
          Proyectos ({projects.length})
        </h2>
        <Button type="button" onClick={() => setShowForm(true)}>Nuevo proyecto</Button>
      </div>
      {projects.length === 0 ? (
        <p className="mt-4 text-ink/50">Sin proyectos.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-black/10 p-3"
            >
              <div>
                <Link
                  href={`/projects/${p.id}`}
                  className="font-medium text-cobalt underline"
                >
                  {p.name}
                </Link>
                <div className="text-xs text-ink/50">
                  {p.isActive ? "Activo" : "Inactivo"}
                  {p.startDate && ` · Inicio: ${new Date(p.startDate).toLocaleDateString("es-AR")}`}
                  {p.endDate && ` · Fin: ${new Date(p.endDate).toLocaleDateString("es-AR")}`}
                </div>
              </div>
              <Badge tone={p.isActive ? "success" : "neutral"}>
                {p.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <ProjectFormModal
        open={showForm}
        title="Nuevo proyecto"
        initial={{ clientId }}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        clients={clients}
      />
    </>
  );
}
