#!/usr/bin/env node
/**
 * Refreshes public/data/*.json from the ak-roster repository.
 *
 *   npm run update-data
 *
 * The game-data JSON is committed to ak-roster, regenerated there from
 * Kengxxiao/ArknightsGameData and ArknightsAssets/ArknightsGamedata.
 * We only need the four files this app consumes.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILES = ["operators.json", "items.json", "skins.json", "factions.json"];
const REPO = "https://github.com/neeia/ak-roster.git";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public", "data");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "zoot-data-"));

try {
  console.log("Cloning ak-roster (shallow)…");
  execFileSync("git", ["clone", "--depth", "1", "--filter=blob:none", REPO, temp], {
    stdio: "inherit",
  });

  fs.mkdirSync(target, { recursive: true });
  for (const file of FILES) {
    const source = path.join(temp, "src", "data", file);
    if (!fs.existsSync(source)) {
      console.warn(`skip ${file} (not found upstream)`);
      continue;
    }
    fs.copyFileSync(source, path.join(target, file));
    const size = (fs.statSync(source).size / 1024).toFixed(0);
    console.log(`updated ${file} (${size} kB)`);
  }
  console.log("\nDone. Restart the dev server to pick up the new data.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
