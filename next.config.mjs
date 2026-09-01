import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // frappe-gantt's "exports" map does not expose its CSS subpath; alias it
    // to the real file so the official stylesheet can be imported.
    config.resolve.alias = {
      ...config.resolve.alias,
      "frappe-gantt/dist/frappe-gantt.css": path.resolve(
        __dirname,
        "node_modules/frappe-gantt/dist/frappe-gantt.css",
      ),
    };
    return config;
  },
};

export default nextConfig;
