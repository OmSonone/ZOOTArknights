import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { importApiMiddleware } from "./server/api.mjs";

/**
 * Mounts /api/import in dev and preview so the game data import can make
 * server-side requests (the game APIs do not send CORS headers).
 */
const importApi: Plugin = {
  name: "zoot-import-api",
  configureServer(server) {
    server.middlewares.use(importApiMiddleware);
  },
  configurePreviewServer(server) {
    server.middlewares.use(importApiMiddleware);
  },
};

export default defineConfig({
  base: "/",
  plugins: [react(), importApi],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
});
