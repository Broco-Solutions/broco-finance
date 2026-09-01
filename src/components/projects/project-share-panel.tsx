"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateShareLinkAction, revokeShareLinkAction } from "@/app/projects/planning-actions";

type ShareStatus = "active" | "revoked" | null;

export function ProjectSharePanel({
  projectId,
  initialStatus,
}: {
  projectId: string;
  initialStatus: ShareStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ShareStatus>(initialStatus);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = token ? `${window.location.origin}/p/${token}` : "";

  const generate = async () => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    const r = await generateShareLinkAction(null, fd);
    setBusy(false);
    if (!r.success) {
      setError(r.message);
      return;
    }
    setToken(r.token);
    setStatus("active");
    setCopied(false);
    router.refresh();
  };

  const revoke = async () => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    const r = await revokeShareLinkAction(null, fd);
    setBusy(false);
    if (!r.success) {
      setError(r.message);
      return;
    }
    setToken(null);
    setStatus("revoked");
    router.refresh();
  };

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-brick">{error}</p>}

      {token && (
        <div className="rounded-lg border border-cobalt/20 bg-cobalt/5 p-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Enlace del cliente</p>
          <code className="block break-all rounded bg-white px-2 py-1.5 text-xs text-ink">{shareUrl}</code>
          <p className="text-xs text-amber-700">
            Este enlace reemplaza al anterior. Compártelo solo con quien deba ver el seguimiento.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" onClick={copy}>{copied ? "¡Copiado!" : "Copiar enlace"}</Button>
            <Button variant="ghost" onClick={generate} disabled={busy}>Regenerar enlace</Button>
            <Button variant="ghost" className="text-brick" onClick={revoke} disabled={busy}>Desactivar enlace</Button>
          </div>
        </div>
      )}

      {!token && status === "active" && (
        <div className="space-y-2">
          <p className="text-sm text-ink/60">El proyecto tiene un enlace activo.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={generate} disabled={busy}>Regenerar enlace</Button>
            <Button variant="ghost" className="text-brick" onClick={revoke} disabled={busy}>Desactivar enlace</Button>
          </div>
        </div>
      )}

      {!token && status === "revoked" && (
        <div className="space-y-2">
          <p className="text-sm text-ink/60">El enlace anterior fue desactivado.</p>
          <Button onClick={generate} disabled={busy}>Generar / Reactivar enlace</Button>
        </div>
      )}

      {!token && status === null && (
        <Button onClick={generate} disabled={busy}>Compartir con cliente</Button>
      )}
    </div>
  );
}
