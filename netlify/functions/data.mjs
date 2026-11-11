// Shared storage for the dashboard: one JSON "state" blob in Netlify Blobs.
//   GET   /api/data[?since=<v>]  -> { role, state }   (state omitted if unchanged since <v>)
//   PUT   /api/data               -> replace everything (rows, targets, quintiles)   [editor only]
//   PATCH /api/data               -> update targets/quintiles only                   [editor only]
// Passwords come from Netlify environment variables: EDITOR_PASSWORD (required to save),
// VIEWER_PASSWORD (optional; if set, reading also needs a password).
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

const sha = (s) => createHash("sha256").update(String(s)).digest();
const same = (a, b) => a !== "" && b !== "" && timingSafeEqual(sha(a), sha(b));
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const ED = process.env.EDITOR_PASSWORD || "";
  const VW = process.env.VIEWER_PASSWORD || "";
  const pw = req.headers.get("x-auth") || "";
  const role = same(pw, ED) ? "editor" : !VW || same(pw, VW) ? "viewer" : null;
  const store = getStore("sales-dashboard");

  if (req.method === "GET") {
    if (!role) return json({ error: "password required" }, 401);
    const since = Number(new URL(req.url).searchParams.get("since")) || 0;
    const state = await store.get("state", { type: "json" });
    if (!state) return json({ role, state: null });
    if (since && state.v === since) return json({ role, unchanged: true });
    return json({ role, state });
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    if (!ED) return json({ error: "EDITOR_PASSWORD is not set on the server" }, 503);
    if (role !== "editor") return json({ error: "editor password required" }, 401);
    let body;
    try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }
    const v = Date.now();
    const updated = new Date().toISOString();
    let state;
    if (req.method === "PUT") {
      state = {
        rows: Array.isArray(body.rows) ? body.rows : [],
        tg: body.tg || {}, tgs: body.tgs || {}, qn: body.qn || { emp: {}, store: {} },
        updated, v,
      };
    } else {
      const cur = (await store.get("state", { type: "json" })) || { rows: [] };
      state = {
        ...cur,
        tg: body.tg ?? cur.tg, tgs: body.tgs ?? cur.tgs, qn: body.qn ?? cur.qn,
        updated, v,
      };
    }
    await store.setJSON("state", state);
    return json({ ok: true, v, updated });
  }

  return json({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/data" };
