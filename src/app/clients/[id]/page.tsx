import { PageHeader } from "@/components/ui/page-header";

export default function ClientDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Cliente" title="Detalle de cliente" description="" meta={null} />
      <div className="rounded-[1.5rem] border border-black/10 bg-white/65 p-10 text-center">
        <p className="text-ink/60">
          Este modulo esta siendo adaptado al nuevo modelo financiero.
        </p>
        <p className="mt-2 text-sm text-ink/40">
          Sera reconstruido en la fase correspondiente del plan de simplificacion.
        </p>
      </div>
    </div>
  );
}
