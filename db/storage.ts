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
    amount_config TEXT NOT NULL DEFAULT '[]',
    list_config TEXT NOT NULL DEFAULT '[]',
    day_variants TEXT NOT NULL DEFAULT '{}',
    start_date TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL DEFAULT ''
  )`).run();
  const routineColumns = await env.DB.prepare("PRAGMA table_info(routines)").all<{ name: string }>();
  const existingColumns = new Set(routineColumns.results.map((column) => column.name));
  if (!existingColumns.has("tracking_mode")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN tracking_mode TEXT NOT NULL DEFAULT 'simple'").run();
  if (!existingColumns.has("target_count")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN target_count INTEGER NOT NULL DEFAULT 1").run();
  if (!existingColumns.has("unit")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN unit TEXT NOT NULL DEFAULT 'times'").run();
  if (!existingColumns.has("amount_config")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN amount_config TEXT NOT NULL DEFAULT '[]'").run();
  if (!existingColumns.has("list_config")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN list_config TEXT NOT NULL DEFAULT '[]'").run();
  if (!existingColumns.has("day_variants")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN day_variants TEXT NOT NULL DEFAULT '{}'").run();
  if (!existingColumns.has("start_date")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN start_date TEXT NOT NULL DEFAULT ''").run();
  if (!existingColumns.has("end_date")) await env.DB.prepare("ALTER TABLE routines ADD COLUMN end_date TEXT NOT NULL DEFAULT ''").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed'
  )`).run();
  const completionColumns = await env.DB.prepare("PRAGMA table_info(completions)").all<{ name: string }>();
  if (!new Set(completionColumns.results.map((column) => column.name)).has("status")) await env.DB.prepare("ALTER TABLE completions ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS routine_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    list_key TEXT NOT NULL DEFAULT 'list-1',
    position INTEGER NOT NULL DEFAULT 0
  )`).run();
  const itemColumns = await env.DB.prepare("PRAGMA table_info(routine_items)").all<{ name: string }>();
  if (!new Set(itemColumns.results.map((column) => column.name)).has("list_key")) await env.DB.prepare("ALTER TABLE routine_items ADD COLUMN list_key TEXT NOT NULL DEFAULT 'list-1'").run();
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
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS amount_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    amount_key TEXT NOT NULL,
    date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tracker_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    tracker_key TEXT NOT NULL,
    date TEXT NOT NULL,
    value_text TEXT NOT NULL DEFAULT '',
    file_key TEXT NOT NULL DEFAULT '',
    content_type TEXT NOT NULL DEFAULT ''
  )`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_completions_owner_routine_date
    ON completions(owner_key, routine_id, date)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_routine_items_owner_routine_position
    ON routine_items(owner_key, routine_id, position)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_item_completions_owner_item_date
    ON item_completions(owner_key, item_id, date)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_quantity_completions_owner_routine_date
    ON quantity_completions(owner_key, routine_id, date)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_amount_completions_owner_routine_amount_date
    ON amount_completions(owner_key, routine_id, amount_key, date)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tracker_entries_owner_routine_tracker_date
    ON tracker_entries(owner_key, routine_id, tracker_key, date)`).run();
  const legacyAmounts = await env.DB.prepare(`SELECT id, owner_key AS ownerKey, target_count AS targetCount, unit
    FROM routines WHERE tracking_mode IN ('quantity', 'hybrid') AND amount_config = '[]'`).all<{ id: number; ownerKey: string; targetCount: number; unit: string }>();
  for (const routine of legacyAmounts.results) {
    const amountConfig = JSON.stringify([{ key: "amount-1", name: routine.unit || "pills", targetCount: routine.targetCount || 4 }]);
    await env.DB.prepare("UPDATE routines SET amount_config = ? WHERE id = ? AND owner_key = ?").bind(amountConfig, routine.id, routine.ownerKey).run();
  }
  const legacyLists = await env.DB.prepare(`SELECT id, owner_key AS ownerKey
    FROM routines WHERE tracking_mode IN ('checklist', 'hybrid') AND list_config = '[]'`).all<{ id: number; ownerKey: string }>();
  for (const routine of legacyLists.results) {
    const item = await env.DB.prepare("SELECT id FROM routine_items WHERE owner_key = ? AND routine_id = ? LIMIT 1").bind(routine.ownerKey, routine.id).first();
    if (item) await env.DB.prepare("UPDATE routines SET list_config = ? WHERE id = ? AND owner_key = ?").bind(JSON.stringify([{ key: "list-1", name: "Checklist" }]), routine.id, routine.ownerKey).run();
  }
  await env.DB.prepare(`INSERT OR IGNORE INTO amount_completions (owner_key, routine_id, amount_key, date, count)
    SELECT owner_key, routine_id, 'amount-1', date, count FROM quantity_completions`).run();
  await env.DB.prepare("PRAGMA optimize").run();
}
