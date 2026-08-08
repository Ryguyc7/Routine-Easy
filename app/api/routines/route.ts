import { env } from "cloudflare:workers";

type RoutineRow = { id: number; name: string; emoji: string; color: string; time: string; days: string };

function ownerKey(request: Request) {
  return request.headers.get("oai-authenticated-user-id") ?? "daydrop-local-user";
}

async function ensureDatabase() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,
    time TEXT NOT NULL,
    days TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    date TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_completions_owner_routine_date
    ON completions(owner_key, routine_id, date)`).run();
  await env.DB.prepare("PRAGMA optimize").run();
}

function normalize(row: RoutineRow) {
  return { ...row, days: JSON.parse(row.days) as number[] };
}

export async function GET(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  let routines = await env.DB.prepare("SELECT id, name, emoji, color, time, days FROM routines WHERE owner_key = ? ORDER BY id")
    .bind(owner).all<RoutineRow>();

  if (!routines.results.length) {
    const defaults = [
      ["Morning vitamins", "💊", "#6C5CE7", "08:00", "[0,1,2,3,4,5,6]"],
      ["Workout", "🏋️", "#4D96FF", "07:30", "[1,3,5]"],
      ["Breakfast", "🥣", "#F4B942", "08:30", "[0,1,2,3,4,5,6]"],
      ["Lunch", "🥗", "#FF8A65", "12:30", "[0,1,2,3,4,5,6]"],
      ["Dinner", "🍲", "#49A078", "18:30", "[0,1,2,3,4,5,6]"],
    ];
    await env.DB.batch(defaults.map((item) => env.DB.prepare("INSERT INTO routines (owner_key, name, emoji, color, time, days) VALUES (?, ?, ?, ?, ?, ?)").bind(owner, ...item)));
    routines = await env.DB.prepare("SELECT id, name, emoji, color, time, days FROM routines WHERE owner_key = ? ORDER BY id").bind(owner).all<RoutineRow>();
  }

  const completions = await env.DB.prepare("SELECT routine_id AS routineId, date FROM completions WHERE owner_key = ?").bind(owner).all<{ routineId: number; date: string }>();
  return Response.json({ routines: routines.results.map(normalize), completions: completions.results });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as { name?: string; emoji?: string; color?: string; time?: string; days?: number[] };
  const name = payload.name?.trim();
  if (!name || !payload.days?.length) return Response.json({ error: "Name and days are required" }, { status: 400 });
  const result = await env.DB.prepare("INSERT INTO routines (owner_key, name, emoji, color, time, days) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, name, emoji, color, time, days")
    .bind(owner, name.slice(0, 40), payload.emoji ?? "✨", payload.color ?? "#6C5CE7", payload.time ?? "08:00", JSON.stringify(payload.days)).first<RoutineRow>();
  return Response.json({ routine: normalize(result!) }, { status: 201 });
}

export async function DELETE(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid routine" }, { status: 400 });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM completions WHERE owner_key = ? AND routine_id = ?").bind(owner, id),
    env.DB.prepare("DELETE FROM routines WHERE owner_key = ? AND id = ?").bind(owner, id),
  ]);
  return Response.json({ ok: true });
}
