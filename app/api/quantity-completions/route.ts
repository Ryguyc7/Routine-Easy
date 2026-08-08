import { env } from "cloudflare:workers";
import { ensureDatabase, ownerKey } from "../../../db/storage";

export async function POST(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as { routineId?: number; date?: string; count?: number };
  const count = Math.round(Number(payload.count));
  if (!Number.isInteger(payload.routineId) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "") || !Number.isInteger(count) || count < 0 || count > 12) {
    return Response.json({ error: "Invalid quantity completion" }, { status: 400 });
  }
  const routine = await env.DB.prepare("SELECT target_count AS targetCount FROM routines WHERE owner_key = ? AND id = ? AND tracking_mode IN ('quantity', 'hybrid')")
    .bind(owner, payload.routineId).first<{ targetCount: number }>();
  if (!routine) return Response.json({ error: "Routine not found" }, { status: 404 });
  const safeCount = Math.min(count, routine.targetCount);
  if (safeCount === 0) {
    await env.DB.prepare("DELETE FROM quantity_completions WHERE owner_key = ? AND routine_id = ? AND date = ?")
      .bind(owner, payload.routineId, payload.date).run();
  } else {
    await env.DB.prepare(`INSERT INTO quantity_completions (owner_key, routine_id, date, count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(owner_key, routine_id, date) DO UPDATE SET count = excluded.count`)
      .bind(owner, payload.routineId, payload.date, safeCount).run();
  }
  return Response.json({ ok: true, count: safeCount });
}
