/**
 * Local import API, mounted by both the Vite dev/preview server and server/serve.mjs.
 * It exists because the game endpoints do not allow browser CORS requests.
 */
import { fetchAccountWithCode, fetchAccountWithToken, sendAuthMail, SUPPORTED_SERVERS } from "./yostar.mjs";
import { decodeImagePayload, recognizeDepot } from "./depotOcr.mjs";

const PREFIX = "/api/import";
const MAX_JSON = 1024 * 1024;
const MAX_OCR_JSON = 64 * 1024 * 1024;

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Request body is not valid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

const isEmail = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isServer = (value) => SUPPORTED_SERVERS.includes(value);

function fail(error, status = 502) {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error?.status === "number" ? error.status : status;
  return { status: code, body: { error: message } };
}

export async function handleImportApi(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith(PREFIX)) return false;

  const route = url.pathname.slice(PREFIX.length) || "/";

  try {
    if (req.method === "GET" && route === "/health") {
      sendJson(res, 200, { ok: true, servers: SUPPORTED_SERVERS, ocr: true });
      return true;
    }

    if (req.method === "POST" && route === "/mail") {
      const body = await readJson(req, MAX_JSON);
      if (!isEmail(body?.email)) throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
      if (!isServer(body?.server)) throw Object.assign(new Error("Unsupported server."), { status: 400 });
      await sendAuthMail(body.email, body.server);
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (req.method === "POST" && route === "/data") {
      const body = await readJson(req, MAX_JSON);
      if (!isServer(body?.server)) throw Object.assign(new Error("Unsupported server."), { status: 400 });

      let result;
      if (body?.tokenData) {
        result = await fetchAccountWithToken(body.tokenData, body.server);
      } else {
        if (!isEmail(body?.email)) throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
        if (typeof body?.code !== "string" || !/^\d{4,8}$/.test(body.code)) {
          throw Object.assign(new Error("Enter the code from the email."), { status: 400 });
        }
        result = await fetchAccountWithCode({
          email: body.email,
          code: body.code,
          server: body.server,
        });
      }

      const status = result?.user?.status;
      if (!status) throw new Error("The account response did not contain status data.");
      if (status.level === 1) {
        throw Object.assign(
          new Error(
            "This login returned a level-1 account. The email is probably not bound to your main account — see the warning above.",
          ),
          { status: 422 },
        );
      }

      sendJson(res, 200, result);
      return true;
    }

    if (req.method === "POST" && route === "/depot") {
      const body = await readJson(req, MAX_OCR_JSON);
      const images = Array.isArray(body?.images) ? body.images : [];
      if (images.length === 0) throw Object.assign(new Error("Choose at least one screenshot."), { status: 400 });
      if (images.length > 12) throw Object.assign(new Error("At most 12 screenshots at once."), { status: 400 });

      const buffers = images.map((image) => decodeImagePayload(image));
      const counted = await recognizeDepot(buffers);
      sendJson(res, 200, { items: counted });
      return true;
    }

    sendJson(res, 404, { error: "Unknown endpoint." });
    return true;
  } catch (error) {
    const { status, body } = fail(error);
    sendJson(res, status, body);
    return true;
  }
}

/** Connect-style middleware used by Vite (dev + preview). */
export function importApiMiddleware(req, res, next) {
  handleImportApi(req, res)
    .then((handled) => {
      if (!handled) next();
    })
    .catch((error) => {
      if (!res.headersSent) sendJson(res, 500, { error: error?.message ?? "Internal error." });
      else res.end();
    });
}
