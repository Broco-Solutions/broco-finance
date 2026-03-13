import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  demoMode,
}: {
  eyebrow: string;
  title: string;
  description: string;
  demoMode?: boolean;
}) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="chip">{eyebrow}</span>
        {demoMode ? <Badge tone="warning">Demo Mode</Badge> : null}
      </div>
      <div className="max-w-3xl space-y-2">
        <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">{title}</h1>
        <p className="text-sm leading-7 text-ink/65 md:text-base">{description}</p>
      </div>
    </header>
  );
}
