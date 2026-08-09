import { env } from "cloudflare:workers";
import { ensureDatabase, ownerKey } from "../../../db/storage";

export async function POST(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as { routineId?: number; date?: string; completed?: boolean; status?: "completed" | "skipped" | null };
  if (!Number.isInteger(payload.routineId) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "")) {
    return Response.json({ error: "Invalid completion" }, { status: 400 });
  }
  const status = payload.status === "completed" || payload.status === "skipped" ? payload.status : payload.completed ? "completed" : null;
  if (status) {
    await env.DB.prepare(`INSERT INTO completions (owner_key, routine_id, date, status) VALUES (?, ?, ?, ?)
      ON CONFLICT(owner_key, routine_id, date) DO UPDATE SET status = excluded.status`).bind(owner, payload.routineId, payload.date, status).run();
  } else {
    await env.DB.prepare("DELETE FROM completions WHERE owner_key = ? AND routine_id = ? AND date = ?").bind(owner, payload.routineId, payload.date).run();
  }
  return Response.json({ ok: true });
}
