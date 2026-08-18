import { env } from "cloudflare:workers";
import { ensureDatabase, ownerKey } from "../../../db/storage";

type TrackerConfig = { key: string; kind?: string };

async function findTracker(owner: string, routineId: number, trackerKey: string) {
  const routine = await env.DB.prepare("SELECT amount_config AS amountConfig FROM routines WHERE owner_key = ? AND id = ?")
    .bind(owner, routineId).first<{ amountConfig: string }>();
  if (!routine) return null;
  let trackers: TrackerConfig[] = [];
  try { trackers = JSON.parse(routine.amountConfig); } catch { trackers = []; }
  return trackers.find((tracker) => tracker.key === trackerKey) ?? null;
}

export async function POST(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as { routineId?: number; trackerKey?: string; date?: string; value?: string };
  const trackerKey = String(payload.trackerKey ?? "").trim();
  const date = String(payload.date ?? "");
  if (!Number.isInteger(payload.routineId) || !trackerKey || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Invalid tracker entry" }, { status: 400 });
  const tracker = await findTracker(owner, payload.routineId!, trackerKey);
  if (!tracker || tracker.kind !== "note") return Response.json({ error: "Note tracker not found" }, { status: 404 });
  const value = String(payload.value ?? "").trim().slice(0, 2000);
  if (value) {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO tracker_entries (owner_key, routine_id, tracker_key, date, value_text, file_key, content_type)
        VALUES (?, ?, ?, ?, ?, '', '')
        ON CONFLICT(owner_key, routine_id, tracker_key, date) DO UPDATE SET value_text = excluded.value_text, file_key = '', content_type = ''`)
        .bind(owner, payload.routineId, trackerKey, date, value),
      env.DB.prepare(`INSERT INTO amount_completions (owner_key, routine_id, amount_key, date, count) VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(owner_key, routine_id, amount_key, date) DO UPDATE SET count = 1`)
        .bind(owner, payload.routineId, trackerKey, date),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM tracker_entries WHERE owner_key = ? AND routine_id = ? AND tracker_key = ? AND date = ?").bind(owner, payload.routineId, trackerKey, date),
      env.DB.prepare("DELETE FROM amount_completions WHERE owner_key = ? AND routine_id = ? AND amount_key = ? AND date = ?").bind(owner, payload.routineId, trackerKey, date),
    ]);
  }
  return Response.json({ ok: true, entry: value ? { routineId: payload.routineId, trackerKey, date, value, hasFile: false } : null });
}
