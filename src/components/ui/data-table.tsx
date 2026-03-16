import { Children } from "react";
import { cn } from "@/lib/utils";

export function DataTable({
  headers,
  children,
  className,
  footer,
  scrollAfter = 10,
  maxHeightClassName = "max-h-[34rem]",
}: {
  headers: string[];
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  scrollAfter?: number;
  maxHeightClassName?: string;
}) {
  const rowCount = Children.toArray(children).length;
  const shouldScroll = rowCount > scrollAfter;

  return (
    <div className={cn("overflow-hidden rounded-[1.35rem] border border-black/10", className)}>
      <div className={cn("overflow-x-auto overscroll-x-contain", shouldScroll && `overflow-y-auto ${maxHeightClassName}`)}>
        <table className="min-w-max w-full divide-y divide-black/10 text-left text-sm">
          <thead className="bg-ink text-paper">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className={cn(
                    "px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em]",
                    shouldScroll && "sticky top-0 z-20 bg-ink shadow-[0_1px_0_rgba(255,255,255,0.05)]",
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 bg-white/90">{children}</tbody>
          {footer ? <tfoot className="border-t border-black/10 bg-stone-50/95">{footer}</tfoot> : null}
        </table>
      </div>
    </div>
  );
}
