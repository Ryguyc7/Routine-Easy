import { env } from "cloudflare:workers";
import { ensureDatabase, ownerKey } from "../../../db/storage";

export async function POST(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as { itemId?: number; routineId?: number; date?: string; completed?: boolean };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "")) return Response.json({ error: "Invalid date" }, { status: 400 });

  if (Number.isInteger(payload.routineId)) {
    const items = await env.DB.prepare("SELECT id FROM routine_items WHERE owner_key = ? AND routine_id = ?").bind(owner, payload.routineId).all<{ id: number }>();
    if (payload.completed) {
      if (items.results.length) await env.DB.batch(items.results.map((item: { id: number }) => env.DB.prepare("INSERT OR IGNORE INTO item_completions (owner_key, item_id, date) VALUES (?, ?, ?)").bind(owner, item.id, payload.date)));
    } else {
      await env.DB.prepare("DELETE FROM item_completions WHERE owner_key = ? AND date = ? AND item_id IN (SELECT id FROM routine_items WHERE owner_key = ? AND routine_id = ?)")
        .bind(owner, payload.date, owner, payload.routineId).run();
    }
    return Response.json({ ok: true });
  }

  if (!Number.isInteger(payload.itemId)) return Response.json({ error: "Invalid item" }, { status: 400 });
  if (payload.completed) {
    await env.DB.prepare("INSERT OR IGNORE INTO item_completions (owner_key, item_id, date) SELECT ?, id, ? FROM routine_items WHERE owner_key = ? AND id = ?")
      .bind(owner, payload.date, owner, payload.itemId).run();
  } else {
    await env.DB.prepare("DELETE FROM item_completions WHERE owner_key = ? AND item_id = ? AND date = ?").bind(owner, payload.itemId, payload.date).run();
  }
  return Response.json({ ok: true });
}
