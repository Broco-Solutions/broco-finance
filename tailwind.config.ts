import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101522",
        paper: "#f4efe2",
        sand: "#ddd2bf",
        cobalt: "#1d4ed8",
        lime: "#bef264",
        coral: "#f97316",
        brick: "#9f3b23",
        mint: "#d4fae5",
      },
      boxShadow: {
        panel: "0 18px 60px rgba(16, 21, 34, 0.14)",
      },
      borderRadius: {
        panel: "1.5rem",
      },
      backgroundImage: {
        "ledger-grid":
          "linear-gradient(rgba(16,21,34,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16,21,34,0.08) 1px, transparent 1px)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)"],
        sans: ["var(--font-space)"],
      },
    },
  },
  plugins: [],
};

export default config;
