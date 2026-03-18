"use client";

import { FormEvent, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EditEntityModal({
  open,
  title,
  description,
  submitLabel,
  widthClassName = "max-w-xl",
  isPending,
  disabled = false,
  error,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  widthClassName?: string;
  isPending: boolean;
  disabled?: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div className={`relative w-full ${widthClassName}`}>
        <Card className="border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] p-0 shadow-[0_24px_80px_rgba(16,21,34,0.18)]">
          <form className="space-y-5 p-6" onSubmit={onSubmit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt">Edición rápida</div>
                <h3 className="mt-2 font-display text-3xl text-ink">{title}</h3>
                <p className="mt-2 max-w-lg text-sm text-ink/60">{description}</p>
              </div>
              <button
                aria-label="Cerrar modal"
                className="rounded-full border border-black/10 bg-white/90 p-2 text-ink/70 transition hover:bg-black/5 hover:text-ink"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
            {error ? <p className="text-sm text-brick">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-3 border-t border-black/8 pt-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || disabled}>
                {isPending ? "Guardando…" : submitLabel}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
