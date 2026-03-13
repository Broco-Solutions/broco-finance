import { cn } from "@/lib/utils";

export function DataTable({
  headers,
  children,
  className,
}: {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[1.35rem] border border-black/10", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-black/10 text-left text-sm">
          <thead className="bg-ink text-paper">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 bg-white/90">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
