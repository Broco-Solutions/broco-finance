import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed bg-white/50">
      <div className="space-y-2 text-sm text-ink/60">
        <h3 className="font-semibold uppercase tracking-[0.16em] text-ink">{title}</h3>
        <p>{description}</p>
      </div>
    </Card>
  );
}
