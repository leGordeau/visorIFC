import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  worker: { format: "es" },
  plugins: [
    react(),
    {
      name: "ifclite-worker-extension-fix",
      enforce: "pre",
      transform(code, id) {
        if (!id.includes("@ifc-lite/geometry") || !code.includes(".worker.ts")) {
          return;
        }
        return code.replaceAll(".worker.ts", ".worker.js");
      },
    },
  ],
});
