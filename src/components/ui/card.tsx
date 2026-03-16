import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={cn("panel noise overflow-hidden p-4 md:p-5 lg:p-6", className)}>{children}</section>;
}
