"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ProjectFormModal } from "../project-form-modal";
import { saveProject } from "../actions";

type ClientOption = { id: string; name: string };

function toISODate(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d.slice(0, 10);
}

export function ProjectDetailEdit({
  project,
  clients,
}: {
  project: {
    id: string;
    name: string;
    clientId: string;
    isActive: boolean;
    startDate: string | Date | null;
    endDate: string | Date | null;
    goLiveDate: string | Date | null;
    notes: string | null;
    oneTimeOriginalAmount: unknown;
    oneTimeCurrency: string | null;
    oneTimeExchangeRate: unknown;
    oneTimeAmountUsd: unknown;
    monthlyRecurringOriginalAmount: unknown;
    monthlyRecurringCurrency: string | null;
    monthlyRecurringExchangeRate: unknown;
    monthlyRecurringAmountUsd: unknown;
    client: { id: string };
    _count: { incomes: number; expenses: number };
  };
  clients: ClientOption[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSave = async (data: Record<string, unknown>) => {
    const fd = new FormData();
    fd.set("id", project.id);
    fd.set("clientId", data.clientId as string);
    fd.set("name", data.name as string);
    fd.set("isActive", data.isActive ? "true" : "false");
    if (data.startDate) fd.set("startDate", data.startDate as string);
    if (data.endDate) fd.set("endDate", data.endDate as string);
    if (data.goLiveDate) fd.set("goLiveDate", data.goLiveDate as string);
    if (data.notes) fd.set("notes", data.notes as string);
    if (data.oneTimeOriginalAmount != null) {
      fd.set("oneTimeOriginalAmount", String(data.oneTimeOriginalAmount));
      fd.set("oneTimeCurrency", (data.oneTimeCurrency as string) || "USD");
      if (data.oneTimeExchangeRate != null)
        fd.set("oneTimeExchangeRate", String(data.oneTimeExchangeRate));
    }
    if (data.monthlyRecurringOriginalAmount != null) {
      fd.set("monthlyRecurringOriginalAmount", String(data.monthlyRecurringOriginalAmount));
      fd.set("monthlyRecurringCurrency", (data.monthlyRecurringCurrency as string) || "USD");
      if (data.monthlyRecurringExchangeRate != null)
        fd.set("monthlyRecurringExchangeRate", String(data.monthlyRecurringExchangeRate));
    }
    const result = await saveProject(null, fd);
    if (!result.success) throw new Error(result.message);
    router.refresh();
  };

  const initial = {
    id: project.id,
    name: project.name,
    clientId: project.clientId,
    isActive: project.isActive,
    startDate: toISODate(project.startDate),
    endDate: toISODate(project.endDate),
    goLiveDate: toISODate(project.goLiveDate),
    notes: project.notes,
    oneTimeOriginalAmount: project.oneTimeOriginalAmount as string | number | null,
    oneTimeCurrency: project.oneTimeCurrency,
    oneTimeExchangeRate: project.oneTimeExchangeRate as string | number | null,
    oneTimeAmountUsd: project.oneTimeAmountUsd as string | number | null,
    monthlyRecurringOriginalAmount:
      project.monthlyRecurringOriginalAmount as string | number | null,
    monthlyRecurringCurrency: project.monthlyRecurringCurrency,
    monthlyRecurringExchangeRate:
      project.monthlyRecurringExchangeRate as string | number | null,
    monthlyRecurringAmountUsd:
      project.monthlyRecurringAmountUsd as string | number | null,
    client: project.client,
    _count: project._count,
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Editar proyecto
      </Button>
      <ProjectFormModal
        open={open}
        title="Editar proyecto"
        initial={initial}
        clients={clients}
        onClose={() => setOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
