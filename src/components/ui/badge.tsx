import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        tone === "neutral" && "bg-black/5 text-ink/70",
        tone === "success" && "bg-mint text-ink",
        tone === "danger" && "bg-brick/10 text-brick",
        tone === "warning" && "bg-coral/10 text-brick",
      )}
    >
      {children}
    </span>
  );
}
