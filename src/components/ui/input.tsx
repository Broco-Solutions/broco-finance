import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const BLOCKED_NUMBER_KEYS = new Set(["e", "E", "+", "-"]);

export function Input({
  autoComplete = "off",
  className,
  inputMode,
  onChange,
  onKeyDown,
  onPaste,
  step,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const isNumeric = type === "number";

  return (
    <input
      autoComplete={autoComplete}
      className={cn(
        "h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/15",
        className,
      )}
      inputMode={inputMode ?? (isNumeric ? "decimal" : undefined)}
      onChange={(event) => {
        if (isNumeric && event.currentTarget.value.includes(",")) {
          event.currentTarget.value = event.currentTarget.value.replaceAll(",", ".");
        }
        onChange?.(event);
      }}
      onKeyDown={(event) => {
        if (isNumeric && BLOCKED_NUMBER_KEYS.has(event.key)) {
          event.preventDefault();
        }
        onKeyDown?.(event);
      }}
      onPaste={(event) => {
        if (isNumeric) {
          const rawValue = event.clipboardData.getData("text").trim();
          const pastedValue = rawValue.replaceAll(",", ".");
          if (!/^\d*\.?\d*$/.test(pastedValue)) {
            event.preventDefault();
          } else if (pastedValue !== rawValue) {
            event.preventDefault();
            const input = event.currentTarget;
            const selectionStart = input.selectionStart ?? input.value.length;
            const selectionEnd = input.selectionEnd ?? input.value.length;
            input.value = `${input.value.slice(0, selectionStart)}${pastedValue}${input.value.slice(selectionEnd)}`;
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
        onPaste?.(event);
      }}
      step={isNumeric ? step ?? "0.01" : step}
      type={type}
      {...props}
    />
  );
}
