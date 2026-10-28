/**
 * Depot screenshot recognition.
 *
 * Runs the @arkntools/depot-recognition model on the local server so the
 * browser bundle stays small. The material image pack (~a few MB) is fetched
 * once from data-cf.arkntools.app and cached under server/.cache.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(HERE, ".cache", "depot");
const RESOURCE_BASE = "https://data-cf.arkntools.app";

let cached = null; // { key, recognizer }
let loading = null;

async function fetchJson(url, timeout = 30_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`Could not download OCR data (HTTP ${response.status}).`);
  return response.json();
}

async function fetchToFile(url, destination, timeout = 120_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`Could not download OCR data (HTTP ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, buffer);
  return buffer;
}

async function loadResources() {
  if (loading) return loading;

  loading = (async () => {
    const { mapMd5 } = await fetchJson(`${RESOURCE_BASE}/check.json`);
    if (!mapMd5) throw new Error("The OCR manifest is missing a version hash.");

    const manifest = await fetchJson(`${RESOURCE_BASE}/map.${mapMd5}.json`);
    const itemHash = manifest["data/item.json"];
    const pkgHash = manifest["pkg/item.zip"];
    if (!itemHash || !pkgHash) throw new Error("The OCR manifest is missing item data.");

    const dir = path.join(CACHE_DIR, mapMd5);
    const itemPath = path.join(dir, "item.json");
    const pkgPath = path.join(dir, "item.zip");

    let itemData;
    if (fs.existsSync(itemPath)) {
      itemData = JSON.parse(fs.readFileSync(itemPath, "utf8"));
    } else {
      itemData = await fetchJson(`${RESOURCE_BASE}/data/item.${itemHash}.json`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(itemPath, JSON.stringify(itemData));
    }

    const pkg = fs.existsSync(pkgPath)
      ? fs.readFileSync(pkgPath)
      : await fetchToFile(`${RESOURCE_BASE}/pkg/item.${pkgHash}.zip`, pkgPath);

    const order = Object.keys(itemData)
      .filter((id) => itemData[id]?.sortId?.cn != null)
      .sort((a, b) => itemData[a].sortId.cn - itemData[b].sortId.cn);

    return { key: mapMd5, order, pkg };
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

async function getRecognizer() {
  const resources = await loadResources();
  if (cached?.key === resources.key) return cached.recognizer;

  const { DeportRecognizer } = await import("@arkntools/depot-recognition");
  const recognizer = new DeportRecognizer({ order: resources.order, pkg: resources.pkg });
  cached = { key: resources.key, recognizer };
  return recognizer;
}

/**
 * @param {Buffer[]} images png/jpeg buffers, one per depot screenshot
 * @returns {Promise<Record<string, number>>} itemId -> quantity
 */
export async function recognizeDepot(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("No images were provided.");
  }
  const { toSimpleTrustedResult } = await import("@arkntools/depot-recognition");
  const recognizer = await getRecognizer();
  const merged = {};
  let failures = 0;

  for (const image of images) {
    try {
      const { data } = await recognizer.recognize(image);
      const simple = toSimpleTrustedResult(data);
      for (const [itemId, count] of Object.entries(simple)) {
        if (typeof count !== "number") continue;
        merged[itemId] = Math.max(merged[itemId] ?? 0, count);
      }
    } catch {
      // Screenshots that contain no depot grid make the detector throw; skip them.
      failures += 1;
    }
  }

  if (failures === images.length) {
    throw new Error("No depot grid was found in these screenshots. Use uncropped, full-resolution captures.");
  }
  return merged;
}

export function decodeImagePayload(payload) {
  if (typeof payload !== "string") throw new Error("Invalid image payload.");
  const comma = payload.indexOf(",");
  const base64 = payload.startsWith("data:") && comma !== -1 ? payload.slice(comma + 1) : payload;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new Error("Empty image payload.");
  if (buffer.length > 10 * 1024 * 1024) throw new Error("Image is larger than 10 MB.");
  return buffer;
}
