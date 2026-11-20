// =====================================================================
// /api/data  -  the dashboard's shared storage, with password checks.
//
//   GET  /api/data  -> { role, data }   (needs VIEW_PASSWORD if one is set)
//   PUT  /api/data  -> saves the data   (always needs EDIT_PASSWORD)
//
// The password is sent in the "x-dashboard-password" header.
// Set the passwords in Netlify: Site configuration > Environment variables
//   EDIT_PASSWORD  (required)  lets people load data and change settings
//   VIEW_PASSWORD  (optional)  if set, people need it just to look
// Data is kept in Netlify Blobs (a store named "quintile-dashboard").
// =====================================================================
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

const STORE = "quintile-dashboard";
const KEY = "dashboard";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB is plenty for years of monthly exports

// Compare passwords without leaking timing information
const hash = (s) => createHash("sha256").update(String(s)).digest();
const same = (a, b) => timingSafeEqual(hash(a), hash(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Work out what this password is allowed to do: "edit", "view" or nothing (null)
function roleFor(pw) {
  const edit = process.env.EDIT_PASSWORD || "";
  const view = process.env.VIEW_PASSWORD || "";
  if (edit && pw && same(pw, edit)) return "edit";
  if (view && pw && same(pw, view)) return "view";
  if (!view) return "view"; // no view password set: anyone with the link can look
  return null;
}

function isValid(data) {
  return data && typeof data === "object" && Array.isArray(data.rows) && data.settings && typeof data.settings === "object";
}

export default async (req) => {
  const pw = req.headers.get("x-dashboard-password") || "";
  const role = roleFor(pw);

  if (!role) {
    await sleep(800); // slows down password guessing
    return json({ error: "wrong_password", message: "Password required" }, 401);
  }

  const store = getStore({ name: STORE, consistency: "strong" });

  if (req.method === "GET") {
    const data = await store.get(KEY, { type: "json" });
    return json({ role, data: data ?? null, editConfigured: !!process.env.EDIT_PASSWORD });
  }

  if (req.method === "PUT") {
    if (!process.env.EDIT_PASSWORD) return json({ error: "not_configured", message: "EDIT_PASSWORD is not set on Netlify" }, 500);
    if (role !== "edit") {
      await sleep(800);
      return json({ error: "edit_password_required", message: "Edit password required" }, 403);
    }

    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: "too_large", message: "Data is too large" }, 413);

    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "bad_json", message: "Could not read the data" }, 400); }
    if (!isValid(body?.data)) return json({ error: "bad_data", message: "Data is missing rows or settings" }, 400);

    // Stop two editors from overwriting each other: the client says which version it started from
    const current = await store.get(KEY, { type: "json" });
    if (current && body.base !== current.updated) return json({ error: "conflict", data: current }, 409);

    const data = { ...body.data, updated: Date.now() };
    await store.setJSON(KEY, data);
    return json({ ok: true, updated: data.updated });
  }

  return json({ error: "method_not_allowed" }, 405);
};

export const config = { path: "/api/data" };
