#!/usr/bin/env node
/**
 * Local production server: serves dist/ and mounts the import API on the same origin.
 * Binds to 127.0.0.1 by default so the account endpoints are never exposed to the LAN.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleImportApi } from "./api.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, "..", "dist");
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("No build found in dist/. Run `npm run build` first.");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  if (await handleImportApi(req, res)) return;

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? HOST}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  if (pathname === "/") pathname = "/index.html";

  let filePath = path.join(DIST, pathname);
  if (!filePath.startsWith(DIST + path.sep) && filePath !== DIST) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (path.extname(pathname)) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    filePath = path.join(DIST, "index.html");
  }

  const extension = path.extname(filePath).toLowerCase();
  const isHashedAsset = /-[A-Za-z0-9_]{8,}\.(js|css)$/.test(filePath);
  res.setHeader("Content-Type", MIME[extension] ?? "application/octet-stream");
  res.setHeader(
    "Cache-Control",
    extension === ".html" ? "no-store" : isHashedAsset ? "public, max-age=31536000, immutable" : "public, max-age=3600",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");

  fs.createReadStream(filePath)
    .on("error", () => {
      res.statusCode = 500;
      res.end("Failed to read file");
    })
    .pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`ZOOT running at http://${HOST}:${PORT}`);
  console.log("Import API mounted at /api/import (local requests only).");
  console.log("Press Ctrl+C to stop.");
});
