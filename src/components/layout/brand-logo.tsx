import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/Logo%20BS%20-%20Negativo.svg";

export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-white/12 bg-gradient-to-br from-slate-950 via-ink to-cobalt/90 p-4 shadow-[0_18px_40px_rgba(16,21,34,0.28)]",
        className,
      )}
    >
      <Image
        src={LOGO_SRC}
        alt="Broco Solutions"
        width={260}
        height={101}
        priority={priority}
        className="h-auto w-full"
      />
    </div>
  );
}
