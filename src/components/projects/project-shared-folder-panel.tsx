"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import {
  saveSharedFolderAction,
  removeSharedFolderAction,
} from "@/app/projects/planning-actions";
import { SHARED_FOLDER_LABEL_DEFAULT } from "@/lib/shared-folder-url";

type SharedFolder = { url: string; label: string | null } | null;

export function ProjectSharedFolderPanel({
  projectId,
  initialFolder,
}: {
  projectId: string;
  initialFolder: SharedFolder;
}) {
  const router = useRouter();
  const [folder, setFolder] = useState<SharedFolder>(initialFolder);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => setFolder(initialFolder), [initialFolder]);

  const startEdit = () => {
    setUrl(folder?.url ?? "");
    setLabel(folder?.label ?? "");
    setError(null);
    setSuccess(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("url", url);
    if (label.trim()) fd.set("label", label);
    const result = await saveSharedFolderAction(null, fd);
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setFolder({
      url: url.trim(),
      label: label.trim() || SHARED_FOLDER_LABEL_DEFAULT,
    });
    setEditing(false);
    setSuccess("Carpeta compartida guardada.");
    router.refresh();
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    const result = await removeSharedFolderAction(null, fd);
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setShowRemoveConfirm(false);
    setFolder(null);
    setSuccess("Enlace de carpeta quitado.");
    router.refresh();
  };

  return (
    <div className="mt-5 border-t border-gray-100 pt-4">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-ink/50" strokeWidth={1.8} />
        <h3 className="text-sm font-semibold text-ink">Carpeta compartida</h3>
      </div>
      <p className="mt-1 text-xs text-ink/50">
        Acceso directo a una carpeta o recurso externo que el cliente verá en su portal.
      </p>

      <div className="mt-3 space-y-3">
        {error && <p className="text-sm text-brick">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}

        {!folder || editing ? (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink">Enlace de la carpeta compartida</label>
              <Input
                type="url"
                placeholder="https://drive.google.com/drive/folders/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink">Texto visible para el cliente</label>
              <Input
                placeholder={SHARED_FOLDER_LABEL_DEFAULT}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={120}
              />
              <p className="text-xs text-ink/40">
                Si queda vacío se usará &quot;{SHARED_FOLDER_LABEL_DEFAULT}&quot;.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Guardando..." : "Guardar"}
              </Button>
              {folder && (
                <Button type="button" variant="ghost" onClick={cancelEdit} disabled={busy}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink">
              {folder?.label || SHARED_FOLDER_LABEL_DEFAULT}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={folder?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-cobalt underline-offset-2 hover:underline"
              >
                Abrir <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
              </a>
              <Button variant="secondary" onClick={startEdit} disabled={busy}>
                Editar
              </Button>
              <Button
                variant="ghost"
                className="text-brick"
                onClick={() => setShowRemoveConfirm(true)}
                disabled={busy}
              >
                Quitar
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmActionModal
        open={showRemoveConfirm}
        title="Quitar carpeta compartida"
        description="El cliente dejará de ver este acceso en su portal. Podrás volver a configurarlo más tarde."
        confirmLabel="Quitar"
        isPending={busy}
        error={null}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemove}
      />
    </div>
  );
}
