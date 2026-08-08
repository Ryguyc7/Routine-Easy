import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  const owner = request.headers.get("oai-authenticated-user-id") ?? "daydrop-local-user";
  const payload = await request.json() as { routineId?: number; date?: string; completed?: boolean };
  if (!Number.isInteger(payload.routineId) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "")) {
    return Response.json({ error: "Invalid completion" }, { status: 400 });
  }
  if (payload.completed) {
    await env.DB.prepare("INSERT OR IGNORE INTO completions (owner_key, routine_id, date) VALUES (?, ?, ?)").bind(owner, payload.routineId, payload.date).run();
  } else {
    await env.DB.prepare("DELETE FROM completions WHERE owner_key = ? AND routine_id = ? AND date = ?").bind(owner, payload.routineId, payload.date).run();
  }
  return Response.json({ ok: true });
}
