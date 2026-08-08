import { env } from "cloudflare:workers";

export function ownerKey(request: Request) {
  return request.headers.get("oai-authenticated-user-id") ?? "daydrop-local-user";
}

export async function ensureDatabase() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,
    time TEXT NOT NULL,
    days TEXT NOT NULL,
    tracking_mode TEXT NOT NULL DEFAULT 'simple',
    target_count INTEGER NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'times',
    day_variants TEXT NOT NULL DEFAULT '{}'
  )`).run();
  const routineColumns = await env.DB.prepare("PRAGMA table_info(routines)").all<{ name: string }>();
  const existingColumns = new Set(routineColumns.results.map((column) => column.name));
  if (!existingColumns.has("tracking_mode")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN tracking_mode TEXT NOT NULL DEFAULT 'simple'").run();
  if (!existingColumns.has("target_count")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN target_count INTEGER NOT NULL DEFAULT 1").run();
  if (!existingColumns.has("unit")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN unit TEXT NOT NULL DEFAULT 'times'").run();
  if (!existingColumns.has("day_variants")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN day_variants TEXT NOT NULL DEFAULT '{}'").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    date TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS routine_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS item_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    item_id INTEGER NOT NULL REFERENCES routine_items(id) ON DELETE CASCADE,
    date TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS quantity_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0
  )`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_completions_owner_routine_date
    ON completions(owner_key, routine_id, date)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_routine_items_owner_routine_position
    ON routine_items(owner_key, routine_id, position)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_item_completions_owner_item_date
    ON item_completions(owner_key, item_id, date)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_quantity_completions_owner_routine_date
    ON quantity_completions(owner_key, routine_id, date)`).run();
  await env.DB.prepare("PRAGMA optimize").run();
}
