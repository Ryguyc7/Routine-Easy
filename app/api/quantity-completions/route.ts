import { env } from "cloudflare:workers";
import { ensureDatabase, ownerKey } from "../../../db/storage";

export async function POST(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as { routineId?: number; amountKey?: string; date?: string; count?: number };
  const count = Math.round(Number(payload.count));
  const amountKey = String(payload.amountKey ?? "").trim();
  if (!Number.isInteger(payload.routineId) || !amountKey || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "") || !Number.isInteger(count) || count < 0 || count > 12) {
    return Response.json({ error: "Invalid quantity completion" }, { status: 400 });
  }
  const routine = await env.DB.prepare("SELECT amount_config AS amountConfig FROM routines WHERE owner_key = ? AND id = ? AND tracking_mode IN ('quantity', 'hybrid')")
    .bind(owner, payload.routineId).first<{ amountConfig: string }>();
  if (!routine) return Response.json({ error: "Routine not found" }, { status: 404 });
  let amounts: Array<{ key: string; targetCount: number }> = [];
  try { amounts = JSON.parse(routine.amountConfig); } catch { amounts = []; }
  const amount = amounts.find((item) => item.key === amountKey);
  if (!amount) return Response.json({ error: "Amount tracker not found" }, { status: 404 });
  const safeCount = Math.min(count, Math.max(2, Math.min(12, Math.round(Number(amount.targetCount)) || 4)));
  if (safeCount === 0) {
    await env.DB.prepare("DELETE FROM amount_completions WHERE owner_key = ? AND routine_id = ? AND amount_key = ? AND date = ?")
      .bind(owner, payload.routineId, amountKey, payload.date).run();
  } else {
    await env.DB.prepare(`INSERT INTO amount_completions (owner_key, routine_id, amount_key, date, count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(owner_key, routine_id, amount_key, date) DO UPDATE SET count = excluded.count`)
      .bind(owner, payload.routineId, amountKey, payload.date, safeCount).run();
  }
  return Response.json({ ok: true, count: safeCount });
}
