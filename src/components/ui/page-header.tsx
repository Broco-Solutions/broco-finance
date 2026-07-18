import { Badge } from "@/components/ui/badge";

export function PageHeader({
  actions,
  eyebrow,
  meta,
  title,
}: {
  actions?: React.ReactNode;
  eyebrow: string;
  meta?: React.ReactNode;
  title: string;
  description: string;
}) {
  const label = title.trim() || eyebrow.trim();

  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="truncate font-display text-[1.45rem] tracking-[-0.02em] text-ink md:text-[1.65rem]">{label}</h1>
        {meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? <div className="w-full md:w-auto md:min-w-[18rem]">{actions}</div> : null}
    </header>
  );
}
