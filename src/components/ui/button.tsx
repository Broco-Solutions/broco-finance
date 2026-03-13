import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-ink text-paper hover:bg-cobalt",
        variant === "secondary" && "border border-black/10 bg-white text-ink hover:bg-black/5",
        variant === "ghost" && "text-ink/70 hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
