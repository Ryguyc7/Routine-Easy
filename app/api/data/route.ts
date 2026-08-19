import { env } from "cloudflare:workers";
import { ensureDatabase, ownerKey } from "../../../db/storage";

type RoutineRow = {
  id: number; name: string; emoji: string; color: string; time: string; days: string; trackingMode: string;
  targetCount: number; unit: string; amountConfig: string; listConfig: string; dayVariants: string; startDate: string; endDate: string;
};
type ItemRow = { id: number; routineId: number; title: string; listKey: string; position: number };
type TrackerKind = "amount" | "duration" | "timer" | "rating" | "number" | "note" | "photo" | "avoidance";
type DayVariant = string | { tracking: string[]; label?: string };

const ROUTINE_SELECT = `id, name, emoji, color, time, days, tracking_mode AS trackingMode,
  target_count AS targetCount, unit, amount_config AS amountConfig, list_config AS listConfig,
  day_variants AS dayVariants, start_date AS startDate, end_date AS endDate`;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function array(value: unknown) { return Array.isArray(value) ? value : []; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function json(value: string, fallback: unknown) { try { return JSON.parse(value); } catch { return fallback; } }
function cleanDate(value: unknown) { const date = String(value ?? ""); return DATE_PATTERN.test(date) ? date : ""; }
function cleanKey(value: unknown, fallback: string) { return String(value ?? fallback).trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || fallback; }
function cleanDayVariants(value: unknown) {
  const source = record(value);
  const clean: Record<string, DayVariant> = {};
  for (let day = 0; day < 7; day += 1) {
    const raw = source[day];
    if (typeof raw === "string") {
      const label = raw.trim().slice(0, 80);
      if (label) clean[String(day)] = label;
      continue;
    }
    const plan = record(raw);
    const tracking = [...new Set(array(plan.tracking).map((item) => String(item).trim()).filter((item) => /^(all|simple|(?:list|amount):[a-zA-Z0-9_-]{1,40})$/.test(item)))].slice(0, 18);
    const label = String(plan.label ?? "").trim().slice(0, 80);
    if (tracking.length || label) clean[String(day)] = { tracking: tracking.length ? tracking : ["all"], ...(label ? { label } : {}) };
  }
  return clean;
}

async function ownerRows(owner: string) {
  const [routines, items, completions, itemCompletions, amountCompletions, trackerEntries] = await Promise.all([
    env.DB.prepare(`SELECT ${ROUTINE_SELECT} FROM routines WHERE owner_key = ? ORDER BY id`).bind(owner).all<RoutineRow>(),
    env.DB.prepare("SELECT id, routine_id AS routineId, title, list_key AS listKey, position FROM routine_items WHERE owner_key = ? ORDER BY routine_id, position, id").bind(owner).all<ItemRow>(),
    env.DB.prepare("SELECT routine_id AS routineId, date, status FROM completions WHERE owner_key = ? ORDER BY routine_id, date").bind(owner).all<{ routineId: number; date: string; status: string }>(),
    env.DB.prepare("SELECT item_id AS itemId, date FROM item_completions WHERE owner_key = ? ORDER BY item_id, date").bind(owner).all<{ itemId: number; date: string }>(),
    env.DB.prepare("SELECT routine_id AS routineId, amount_key AS amountKey, date, count FROM amount_completions WHERE owner_key = ? ORDER BY routine_id, amount_key, date").bind(owner).all<{ routineId: number; amountKey: string; date: string; count: number }>(),
    env.DB.prepare("SELECT routine_id AS routineId, tracker_key AS trackerKey, date, value_text AS value, file_key AS fileKey FROM tracker_entries WHERE owner_key = ? ORDER BY routine_id, tracker_key, date").bind(owner).all<{ routineId: number; trackerKey: string; date: string; value: string; fileKey: string }>(),
  ]);
  return { routines: routines.results, items: items.results, completions: completions.results, itemCompletions: itemCompletions.results, amountCompletions: amountCompletions.results, trackerEntries: trackerEntries.results };
}

export async function GET(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const data = await ownerRows(owner);
  const itemIdsByRoutine = new Map<number, Set<number>>();
  for (const item of data.items) itemIdsByRoutine.set(item.routineId, new Set([...(itemIdsByRoutine.get(item.routineId) ?? []), item.id]));
  const photosExcluded = data.trackerEntries.filter((entry) => Boolean(entry.fileKey)).length;
  return Response.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    photosExcluded,
    routines: data.routines.map((routine) => {
      const itemIds = itemIdsByRoutine.get(routine.id) ?? new Set<number>();
      return {
        sourceId: routine.id,
        name: routine.name,
        emoji: routine.emoji,
        color: routine.color,
        time: routine.time,
        days: json(routine.days, []),
        trackingMode: routine.trackingMode,
        targetCount: routine.targetCount,
        unit: routine.unit,
        amounts: json(routine.amountConfig, []),
        lists: json(routine.listConfig, []),
        dayVariants: json(routine.dayVariants, {}),
        startDate: routine.startDate,
        endDate: routine.endDate,
        items: data.items.filter((item) => item.routineId === routine.id).map((item) => ({ sourceId: item.id, title: item.title, listKey: item.listKey, position: item.position })),
        completions: data.completions.filter((item) => item.routineId === routine.id).map(({ date, status }) => ({ date, status })),
        itemCompletions: data.itemCompletions.filter((item) => itemIds.has(item.itemId)).map((item) => ({ sourceItemId: item.itemId, date: item.date })),
        amountCompletions: data.amountCompletions.filter((item) => item.routineId === routine.id).map(({ amountKey, date, count }) => ({ amountKey, date, count })),
        trackerEntries: data.trackerEntries.filter((item) => item.routineId === routine.id && !item.fileKey && item.value).map(({ trackerKey, date, value }) => ({ trackerKey, date, value })),
      };
    }),
  });
}

function cleanRoutine(value: unknown, index: number) {
  const source = record(value);
  const name = String(source.name ?? "").trim().slice(0, 40);
  if (!name) throw new Error(`Routine ${index + 1} needs a name`);
  const trackingMode = source.trackingMode === "checklist" || source.trackingMode === "quantity" || source.trackingMode === "hybrid" ? source.trackingMode : "simple";
  const days = [...new Set(array(source.days).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
  if (!days.length) throw new Error(`Routine ${index + 1} needs a day`);
  const kinds = new Set<TrackerKind>(["amount", "duration", "timer", "rating", "number", "note", "photo", "avoidance"]);
  const amountKeys = new Set<string>();
  const amounts = array(source.amounts).slice(0, 10).map((value, amountIndex) => {
    const item = record(value);
    let key = cleanKey(item.key, `amount-${amountIndex + 1}`);
    while (amountKeys.has(key)) key = `${key}-${amountIndex + 1}`;
    amountKeys.add(key);
    const requestedKind = String(item.kind ?? "amount") as TrackerKind;
    const kind = kinds.has(requestedKind) ? requestedKind : "amount";
    const maximum = kind === "amount" ? 12 : kind === "duration" || kind === "timer" ? 1440 : 1;
    const minimum = kind === "amount" ? 2 : 1;
    const targetCount = Math.min(maximum, Math.max(minimum, Math.round(Number(item.targetCount)) || (kind === "amount" ? 4 : kind === "timer" || kind === "duration" ? 30 : 1)));
    const defaultUnit = kind === "timer" || kind === "duration" ? "min" : kind === "rating" ? "stars" : "";
    return { key, name: String(item.name ?? "Tracker").trim().slice(0, 24) || "Tracker", targetCount, kind, unit: String(item.unit ?? defaultUnit).trim().slice(0, 16) };
  });
  const listKeys = new Set<string>();
  const lists = array(source.lists).slice(0, 6).map((value, listIndex) => {
    const item = record(value);
    let key = cleanKey(item.key, `list-${listIndex + 1}`);
    while (listKeys.has(key)) key = `${key}-${listIndex + 1}`;
    listKeys.add(key);
    return { key, name: String(item.name ?? "Checklist").trim().slice(0, 24) || "Checklist" };
  });
  const itemSourceIds = new Set<number>();
  const items = array(source.items).slice(0, 120).map((value, itemIndex) => {
    const item = record(value);
    const sourceId = Number(item.sourceId);
    if (Number.isInteger(sourceId)) itemSourceIds.add(sourceId);
    return { sourceId, title: String(item.title ?? "").trim().slice(0, 80), listKey: listKeys.has(String(item.listKey)) ? String(item.listKey) : lists[0]?.key ?? "list-1", position: Math.max(0, Math.round(Number(item.position)) || itemIndex) };
  }).filter((item) => item.title);
  const dayVariants = cleanDayVariants(source.dayVariants);
  const cleanCompletions = array(source.completions).slice(0, 5000).map(record).map((item) => ({ date: cleanDate(item.date), status: item.status === "skipped" ? "skipped" : "completed" })).filter((item) => item.date);
  const cleanItemCompletions = array(source.itemCompletions).slice(0, 10000).map(record).map((item) => ({ sourceItemId: Number(item.sourceItemId), date: cleanDate(item.date) })).filter((item) => item.date && itemSourceIds.has(item.sourceItemId));
  const cleanAmounts = array(source.amountCompletions).slice(0, 10000).map(record).map((item) => ({ amountKey: String(item.amountKey), date: cleanDate(item.date), count: Math.min(1_000_000_000, Math.max(0, Math.round(Number(item.count)) || 0)) })).filter((item) => item.date && amountKeys.has(item.amountKey) && item.count > 0);
  const noteKeys = new Set(amounts.filter((item) => item.kind === "note").map((item) => item.key));
  const cleanEntries = array(source.trackerEntries).slice(0, 5000).map(record).map((item) => ({ trackerKey: String(item.trackerKey), date: cleanDate(item.date), value: String(item.value ?? "").slice(0, 2000) })).filter((item) => item.date && item.value.trim() && noteKeys.has(item.trackerKey));
  const requestedColor = String(source.color ?? "#6C5CE7");
  const startDate = cleanDate(source.startDate);
  const endDate = cleanDate(source.endDate);
  return {
    name, emoji: String(source.emoji ?? "✨").slice(0, 16) || "✨", color: /^#[0-9a-f]{6}$/i.test(requestedColor) ? requestedColor : "#6C5CE7",
    time: /^\d{2}:\d{2}$/.test(String(source.time ?? "")) ? String(source.time) : "", days, trackingMode, amounts, lists, dayVariants,
    startDate, endDate: startDate && endDate && endDate < startDate ? "" : endDate, items, completions: cleanCompletions, itemCompletions: cleanItemCompletions, amountCompletions: cleanAmounts, trackerEntries: cleanEntries,
  };
}

async function deleteOwner(owner: string) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM item_completions WHERE owner_key = ?").bind(owner),
    env.DB.prepare("DELETE FROM routine_items WHERE owner_key = ?").bind(owner),
    env.DB.prepare("DELETE FROM completions WHERE owner_key = ?").bind(owner),
    env.DB.prepare("DELETE FROM quantity_completions WHERE owner_key = ?").bind(owner),
    env.DB.prepare("DELETE FROM amount_completions WHERE owner_key = ?").bind(owner),
    env.DB.prepare("DELETE FROM tracker_entries WHERE owner_key = ?").bind(owner),
    env.DB.prepare("DELETE FROM routines WHERE owner_key = ?").bind(owner),
  ]);
}

export async function PUT(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as { backup?: { version?: number; routines?: unknown[] } };
  if (payload.backup?.version !== 1 || !Array.isArray(payload.backup.routines) || payload.backup.routines.length > 100) return Response.json({ error: "Invalid Routine EASY backup" }, { status: 400 });
  let routines: ReturnType<typeof cleanRoutine>[];
  try { routines = payload.backup.routines.map(cleanRoutine); } catch { return Response.json({ error: "Invalid Routine EASY backup" }, { status: 400 }); }
  const temporaryOwner = `${owner}:restore:${crypto.randomUUID()}`;
  try {
    for (const routine of routines) {
      const primary = routine.amounts[0] ?? { targetCount: 1, name: "times" };
      const inserted = await env.DB.prepare(`INSERT INTO routines
        (owner_key, name, emoji, color, time, days, tracking_mode, target_count, unit, amount_config, list_config, day_variants, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
        .bind(temporaryOwner, routine.name, routine.emoji, routine.color, routine.time, JSON.stringify(routine.days), routine.trackingMode, primary.targetCount, primary.name, JSON.stringify(routine.amounts), JSON.stringify(routine.lists), JSON.stringify(routine.dayVariants), routine.startDate, routine.endDate).first<{ id: number }>();
      const itemIdMap = new Map<number, number>();
      for (const item of routine.items) {
        const created = await env.DB.prepare("INSERT INTO routine_items (owner_key, routine_id, title, list_key, position) VALUES (?, ?, ?, ?, ?) RETURNING id")
          .bind(temporaryOwner, inserted!.id, item.title, item.listKey, item.position).first<{ id: number }>();
        if (Number.isInteger(item.sourceId)) itemIdMap.set(item.sourceId, created!.id);
      }
      const statements = [
        ...routine.completions.map((item) => env.DB.prepare("INSERT OR IGNORE INTO completions (owner_key, routine_id, date, status) VALUES (?, ?, ?, ?)").bind(temporaryOwner, inserted!.id, item.date, item.status)),
        ...routine.itemCompletions.flatMap((item) => itemIdMap.has(item.sourceItemId) ? [env.DB.prepare("INSERT OR IGNORE INTO item_completions (owner_key, item_id, date) VALUES (?, ?, ?)").bind(temporaryOwner, itemIdMap.get(item.sourceItemId), item.date)] : []),
        ...routine.amountCompletions.map((item) => env.DB.prepare("INSERT OR IGNORE INTO amount_completions (owner_key, routine_id, amount_key, date, count) VALUES (?, ?, ?, ?, ?)").bind(temporaryOwner, inserted!.id, item.amountKey, item.date, item.count)),
        ...routine.trackerEntries.flatMap((item) => [
          env.DB.prepare("INSERT OR IGNORE INTO tracker_entries (owner_key, routine_id, tracker_key, date, value_text, file_key, content_type) VALUES (?, ?, ?, ?, ?, '', '')").bind(temporaryOwner, inserted!.id, item.trackerKey, item.date, item.value),
          env.DB.prepare("INSERT OR REPLACE INTO amount_completions (owner_key, routine_id, amount_key, date, count) VALUES (?, ?, ?, ?, 1)").bind(temporaryOwner, inserted!.id, item.trackerKey, item.date),
        ]),
      ];
      if (statements.length) await env.DB.batch(statements);
    }
    const oldFiles = await env.DB.prepare("SELECT file_key AS fileKey FROM tracker_entries WHERE owner_key = ? AND file_key <> ''").bind(owner).all<{ fileKey: string }>();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM item_completions WHERE owner_key = ?").bind(owner),
      env.DB.prepare("DELETE FROM routine_items WHERE owner_key = ?").bind(owner),
      env.DB.prepare("DELETE FROM completions WHERE owner_key = ?").bind(owner),
      env.DB.prepare("DELETE FROM quantity_completions WHERE owner_key = ?").bind(owner),
      env.DB.prepare("DELETE FROM amount_completions WHERE owner_key = ?").bind(owner),
      env.DB.prepare("DELETE FROM tracker_entries WHERE owner_key = ?").bind(owner),
      env.DB.prepare("DELETE FROM routines WHERE owner_key = ?").bind(owner),
      env.DB.prepare("UPDATE routines SET owner_key = ? WHERE owner_key = ?").bind(owner, temporaryOwner),
      env.DB.prepare("UPDATE routine_items SET owner_key = ? WHERE owner_key = ?").bind(owner, temporaryOwner),
      env.DB.prepare("UPDATE completions SET owner_key = ? WHERE owner_key = ?").bind(owner, temporaryOwner),
      env.DB.prepare("UPDATE item_completions SET owner_key = ? WHERE owner_key = ?").bind(owner, temporaryOwner),
      env.DB.prepare("UPDATE amount_completions SET owner_key = ? WHERE owner_key = ?").bind(owner, temporaryOwner),
      env.DB.prepare("UPDATE tracker_entries SET owner_key = ? WHERE owner_key = ?").bind(owner, temporaryOwner),
    ]);
    const uploads = (env as unknown as { UPLOADS?: R2Bucket }).UPLOADS;
    if (uploads && oldFiles.results.length) await uploads.delete(oldFiles.results.map((item) => item.fileKey));
    return Response.json({ ok: true, routines: routines.length });
  } catch {
    await deleteOwner(temporaryOwner);
    return Response.json({ error: "Backup could not be restored" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const files = await env.DB.prepare("SELECT file_key AS fileKey FROM tracker_entries WHERE owner_key = ? AND file_key <> ''").bind(owner).all<{ fileKey: string }>();
  await deleteOwner(owner);
  const uploads = (env as unknown as { UPLOADS?: R2Bucket }).UPLOADS;
  if (uploads && files.results.length) await uploads.delete(files.results.map((item) => item.fileKey));
  return Response.json({ ok: true });
}
