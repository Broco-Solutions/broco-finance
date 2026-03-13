import { Card } from "@/components/ui/card";
import { cn, formatUsd, toCurrencyNumber } from "@/lib/utils";

const toneStyles = {
  neutral: {
    card: "border-white/10 bg-gradient-to-br from-ink via-slate-950 to-cobalt text-white",
    title: "text-white/72",
    value: "text-white",
    detail: "text-white/82",
    badge: "border border-white/14 bg-white/10 text-white/90",
  },
  success: {
    card: "border-emerald-950/50 bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-700 text-white",
    title: "text-emerald-50/78",
    value: "text-white",
    detail: "text-emerald-50/90",
    badge: "border border-white/12 bg-white/10 text-white",
  },
  danger: {
    card: "border-rose-950/50 bg-gradient-to-br from-rose-950 via-rose-900 to-orange-700 text-white",
    title: "text-rose-50/82",
    value: "text-white",
    detail: "text-rose-50/92",
    badge: "border border-white/12 bg-white/10 text-white",
  },
  warning: {
    card: "border-amber-950/40 bg-gradient-to-br from-amber-950 via-amber-900 to-coral text-white",
    title: "text-amber-50/80",
    value: "text-white",
    detail: "text-amber-50/90",
    badge: "border border-white/12 bg-white/10 text-white",
  },
} as const;

export function StatCard({
  title,
  value,
  detail,
  tone = "neutral",
}: {
  title: string;
  value: number | string | null | undefined;
  detail: string;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const styles = toneStyles[tone];
  const numericValue = toCurrencyNumber(value);

  return (
    <Card className={cn("relative min-h-[170px] overflow-hidden", styles.card)}>
      <div className="flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className={cn("text-xs font-semibold uppercase tracking-[0.18em]", styles.title)}>{title}</div>
          <div
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
              styles.badge,
            )}
          >
            {detail}
          </div>
        </div>
        <div>
          <div className={cn("font-display text-4xl leading-tight", styles.value)}>{formatUsd(numericValue)}</div>
          <p className={cn("mt-2 text-sm", styles.detail)}>{detail}</p>
        </div>
      </div>
    </Card>
  );
}
