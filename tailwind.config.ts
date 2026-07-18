import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}", "./src/lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1d4ed8", 50: "#eff6ff", 100: "#dbeafe", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8" },
        positive: "#16a34a",
        negative: "#dc2626",
        ink: "#111827",
        paper: "#f3f4f6",
        sand: "#e5e7eb",
        cobalt: "#2563eb",
        lime: "#22c55e",
        coral: "#f97316",
        brick: "#dc2626",
        mint: "#dcfce7",
      },
      fontFamily: { sans: ["var(--font-inter)"] },
    },
  },
  plugins: [],
};

export default config;
