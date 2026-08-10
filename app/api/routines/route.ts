import { env } from "cloudflare:workers";
import { ensureDatabase, ownerKey } from "../../../db/storage";

type TrackingMode = "simple" | "checklist" | "quantity" | "hybrid";
const usesChecklist = (mode: TrackingMode) => mode === "checklist" || mode === "hybrid";
const usesQuantity = (mode: TrackingMode) => mode === "quantity" || mode === "hybrid";
type RoutineRow = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  time: string;
  days: string;
  trackingMode: string;
  targetCount: number;
  unit: string;
  amountConfig: string;
  listConfig: string;
  dayVariants: string;
  startDate: string;
  endDate: string;
};
type RoutineItemRow = { id: number; routineId: number; title: string; listKey: string; position: number };
type RoutineAmount = { key: string; name: string; targetCount: number };
type RoutineListInput = { key: string; name: string; items: string[] };

const ROUTINE_SELECT = `id, name, emoji, color, time, days,
  tracking_mode AS trackingMode, target_count AS targetCount, unit, amount_config AS amountConfig, list_config AS listConfig, day_variants AS dayVariants,
  start_date AS startDate, end_date AS endDate`;

function cleanItems(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item).trim().slice(0, 80)).filter(Boolean).slice(0, 20);
}

function cleanMode(mode: unknown): TrackingMode {
  return mode === "checklist" || mode === "quantity" || mode === "hybrid" ? mode : "simple";
}

function cleanCount(count: unknown, mode: TrackingMode) {
  if (!usesQuantity(mode)) return 1;
  const value = Math.round(Number(count));
  return Number.isFinite(value) ? Math.min(12, Math.max(2, value)) : 4;
}

function cleanUnit(unit: unknown, mode: TrackingMode) {
  if (!usesQuantity(mode)) return "times";
  return String(unit ?? "pills").trim().slice(0, 24) || "pills";
}

function cleanAmounts(amounts: unknown, mode: TrackingMode, fallback?: { targetCount: number; unit: string }) {
  if (!usesQuantity(mode)) return [];
  const source = Array.isArray(amounts) ? amounts : [];
  const clean: RoutineAmount[] = [];
  const usedKeys = new Set<string>();
  for (const [index, item] of source.slice(0, 6).entries()) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    let key = String(record.key ?? `amount-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || `amount-${index + 1}`;
    while (usedKeys.has(key)) key = `${key}-${index + 1}`;
    usedKeys.add(key);
    const name = String(record.name ?? "").trim().slice(0, 24);
    const count = Math.round(Number(record.targetCount));
    if (name) clean.push({ key, name, targetCount: Number.isFinite(count) ? Math.min(12, Math.max(2, count)) : 4 });
  }
  if (clean.length) return clean;
  return [{ key: "amount-1", name: fallback?.unit || "pills", targetCount: fallback?.targetCount || 4 }];
}

function cleanLists(lists: unknown, mode: TrackingMode, legacyItems: unknown = []) {
  if (!usesChecklist(mode)) return [];
  const source = Array.isArray(lists) ? lists : [];
  const clean: RoutineListInput[] = [];
  const usedKeys = new Set<string>();
  for (const [index, item] of source.slice(0, 6).entries()) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    let key = String(record.key ?? `list-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || `list-${index + 1}`;
    while (usedKeys.has(key)) key = `${key}-${index + 1}`;
    usedKeys.add(key);
    const name = String(record.name ?? "").trim().slice(0, 24);
    const items = cleanItems(record.items);
    if (name && items.length) clean.push({ key, name, items });
  }
  if (clean.length) return clean;
  const items = cleanItems(legacyItems);
  return items.length ? [{ key: "list-1", name: "Checklist", items }] : [];
}

function cleanDayVariants(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean: Record<string, string> = {};
  for (let day = 0; day < 7; day += 1) {
    const label = String((value as Record<string, unknown>)[day] ?? "").trim().slice(0, 80);
    if (label) clean[String(day)] = label;
  }
  return clean;
}

function cleanDate(value: unknown) {
  const date = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00`)) ? date : "";
}

function cleanDays(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
}

function invalidDateRange(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && endDate < startDate);
}

function normalize(row: RoutineRow, items: RoutineItemRow[]) {
  const trackingMode = row.trackingMode === "simple" && items.length ? "checklist" : cleanMode(row.trackingMode);
  let dayVariants: Record<string, string> = {};
  let storedAmounts: unknown = [];
  let storedLists: Array<{ key: string; name: string }> = [];
  try { dayVariants = cleanDayVariants(JSON.parse(row.dayVariants)); } catch { dayVariants = {}; }
  try { storedAmounts = JSON.parse(row.amountConfig); } catch { storedAmounts = []; }
  try { storedLists = JSON.parse(row.listConfig); } catch { storedLists = []; }
  const amounts = cleanAmounts(storedAmounts, trackingMode, { targetCount: row.targetCount, unit: row.unit });
  const lists = usesChecklist(trackingMode) ? (storedLists.length ? storedLists : items.length ? [{ key: "list-1", name: "Checklist" }] : []) : [];
  return { ...row, trackingMode, dayVariants, days: JSON.parse(row.days) as number[], items, amounts, lists };
}

async function getItems(owner: string) {
  return env.DB.prepare(`SELECT id, routine_id AS routineId, title, list_key AS listKey, position
    FROM routine_items WHERE owner_key = ? ORDER BY routine_id, position, id`)
    .bind(owner).all<RoutineItemRow>();
}

async function getRoutine(owner: string, id: number) {
  return env.DB.prepare(`SELECT ${ROUTINE_SELECT} FROM routines WHERE owner_key = ? AND id = ?`)
    .bind(owner, id).first<RoutineRow>();
}

export async function GET(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const routines = await env.DB.prepare(`SELECT ${ROUTINE_SELECT} FROM routines WHERE owner_key = ? ORDER BY id`)
    .bind(owner).all<RoutineRow>();

  const [items, completions, itemCompletions, amountCompletions] = await Promise.all([
    getItems(owner),
    env.DB.prepare("SELECT routine_id AS routineId, date, status FROM completions WHERE owner_key = ?").bind(owner).all<{ routineId: number; date: string; status: string }>(),
    env.DB.prepare("SELECT item_id AS itemId, date FROM item_completions WHERE owner_key = ?").bind(owner).all<{ itemId: number; date: string }>(),
    env.DB.prepare("SELECT routine_id AS routineId, amount_key AS amountKey, date, count FROM amount_completions WHERE owner_key = ?").bind(owner).all<{ routineId: number; amountKey: string; date: string; count: number }>(),
  ]);
  const itemsByRoutine = new Map<number, RoutineItemRow[]>();
  for (const item of items.results) itemsByRoutine.set(item.routineId, [...(itemsByRoutine.get(item.routineId) ?? []), item]);
  return Response.json({
    routines: routines.results.map((routine) => normalize(routine, itemsByRoutine.get(routine.id) ?? [])),
    completions: completions.results,
    itemCompletions: itemCompletions.results,
    amountCompletions: amountCompletions.results,
  });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as {
    name?: string; emoji?: string; color?: string; time?: string; days?: number[];
    trackingMode?: TrackingMode; targetCount?: number; unit?: string; amounts?: unknown; lists?: unknown; dayVariants?: Record<string, string>; startDate?: string; endDate?: string; items?: string[];
  };
  const name = payload.name?.trim();
  const days = cleanDays(payload.days);
  if (!name || !days.length) return Response.json({ error: "Name and days are required" }, { status: 400 });
  const trackingMode = cleanMode(payload.trackingMode);
  const lists = cleanLists(payload.lists, trackingMode, payload.items);
  if (usesChecklist(trackingMode) && !lists.length) return Response.json({ error: "Add at least one named list with an item" }, { status: 400 });
  const targetCount = cleanCount(payload.targetCount, trackingMode);
  const unit = cleanUnit(payload.unit, trackingMode);
  const amounts = cleanAmounts(payload.amounts, trackingMode, { targetCount, unit });
  const primaryAmount = amounts[0] ?? { targetCount: 1, name: "times" };
  const dayVariants = cleanDayVariants(payload.dayVariants);
  const startDate = cleanDate(payload.startDate);
  const endDate = cleanDate(payload.endDate);
  if (invalidDateRange(startDate, endDate)) return Response.json({ error: "Stop date must be on or after the start date" }, { status: 400 });
  const result = await env.DB.prepare(`INSERT INTO routines
    (owner_key, name, emoji, color, time, days, tracking_mode, target_count, unit, amount_config, list_config, day_variants, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING ${ROUTINE_SELECT}`)
    .bind(owner, name.slice(0, 40), payload.emoji ?? "✨", payload.color ?? "#6C5CE7", payload.time ?? "", JSON.stringify(days), trackingMode, primaryAmount.targetCount, primaryAmount.name, JSON.stringify(amounts), JSON.stringify(lists.map(({ key, name }) => ({ key, name }))), JSON.stringify(dayVariants), startDate, endDate)
    .first<RoutineRow>();
  if (lists.length) {
    await env.DB.batch(lists.flatMap((list) => list.items.map((title, position) =>
      env.DB.prepare("INSERT INTO routine_items (owner_key, routine_id, title, list_key, position) VALUES (?, ?, ?, ?, ?)").bind(owner, result!.id, title, list.key, position),
    )));
  }
  const items = await env.DB.prepare("SELECT id, routine_id AS routineId, title, list_key AS listKey, position FROM routine_items WHERE owner_key = ? AND routine_id = ? ORDER BY list_key, position, id")
    .bind(owner, result!.id).all<RoutineItemRow>();
  return Response.json({ routine: normalize(result!, items.results) }, { status: 201 });
}

export async function PUT(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as {
    id?: number; name?: string; emoji?: string; color?: string; time?: string; days?: number[];
    trackingMode?: TrackingMode; targetCount?: number; unit?: string; amounts?: unknown; lists?: unknown; dayVariants?: Record<string, string>; startDate?: string; endDate?: string; items?: string[];
  };
  if (!Number.isInteger(payload.id)) return Response.json({ error: "Invalid routine" }, { status: 400 });
  const existing = await getRoutine(owner, payload.id!);
  if (!existing) return Response.json({ error: "Routine not found" }, { status: 404 });
  const name = String(payload.name ?? existing.name).trim().slice(0, 40);
  if (!name) return Response.json({ error: "Routine name is required" }, { status: 400 });
  let existingDays: number[] = [];
  try { existingDays = cleanDays(JSON.parse(existing.days)); } catch { existingDays = []; }
  const days = payload.days === undefined ? existingDays : cleanDays(payload.days);
  if (!days.length) return Response.json({ error: "Choose at least one repeat day" }, { status: 400 });
  const emoji = String(payload.emoji ?? existing.emoji).trim().slice(0, 16) || existing.emoji;
  const requestedColor = String(payload.color ?? existing.color).trim();
  const color = /^#[0-9a-f]{6}$/i.test(requestedColor) ? requestedColor : existing.color;
  const currentMode = cleanMode(existing.trackingMode);
  const trackingMode = cleanMode(payload.trackingMode ?? existing.trackingMode);
  const targetCount = cleanCount(payload.targetCount ?? existing.targetCount, trackingMode);
  const unit = cleanUnit(payload.unit ?? existing.unit, trackingMode);
  let existingAmountData: unknown = [];
  try { existingAmountData = JSON.parse(existing.amountConfig); } catch { existingAmountData = []; }
  const currentAmounts = cleanAmounts(existingAmountData, currentMode, { targetCount: existing.targetCount, unit: existing.unit });
  const amounts = cleanAmounts(payload.amounts ?? currentAmounts, trackingMode, { targetCount, unit });
  const primaryAmount = amounts[0] ?? { targetCount: 1, name: "times" };
  let currentDayVariants: Record<string, string> = {};
  try { currentDayVariants = cleanDayVariants(JSON.parse(existing.dayVariants)); } catch { currentDayVariants = {}; }
  const dayVariants = cleanDayVariants(payload.dayVariants ?? currentDayVariants);
  const startDate = cleanDate(payload.startDate ?? existing.startDate);
  const endDate = cleanDate(payload.endDate ?? existing.endDate);
  if (invalidDateRange(startDate, endDate)) return Response.json({ error: "Stop date must be on or after the start date" }, { status: 400 });
  const lists = cleanLists(payload.lists, trackingMode, payload.items);
  if (usesChecklist(trackingMode) && !lists.length) return Response.json({ error: "Add at least one named list with an item" }, { status: 400 });
  const currentItems = await env.DB.prepare("SELECT id, routine_id AS routineId, title, list_key AS listKey, position FROM routine_items WHERE owner_key = ? AND routine_id = ? ORDER BY list_key, position, id")
    .bind(owner, existing.id).all<RoutineItemRow>();
  const currentListConfig = (() => { try { return JSON.parse(existing.listConfig); } catch { return []; } })();
  const nextListConfig = lists.map(({ key, name }) => ({ key, name }));
  const nextItemData = lists.flatMap((list) => list.items.map((title, position) => ({ title, listKey: list.key, position })));
  const itemsChanged = usesChecklist(currentMode) !== usesChecklist(trackingMode) || JSON.stringify(currentListConfig) !== JSON.stringify(nextListConfig) || JSON.stringify(currentItems.results.map(({ title, listKey, position }) => ({ title, listKey, position }))) !== JSON.stringify(nextItemData);
  const statements = [
    env.DB.prepare("UPDATE routines SET name = ?, emoji = ?, color = ?, time = ?, days = ?, tracking_mode = ?, target_count = ?, unit = ?, amount_config = ?, list_config = ?, day_variants = ?, start_date = ?, end_date = ? WHERE owner_key = ? AND id = ?")
      .bind(name, emoji, color, payload.time ?? existing.time, JSON.stringify(days), trackingMode, primaryAmount.targetCount, primaryAmount.name, JSON.stringify(amounts), JSON.stringify(nextListConfig), JSON.stringify(dayVariants), startDate, endDate, owner, existing.id),
  ];
  if (itemsChanged) {
    statements.push(
      env.DB.prepare("DELETE FROM item_completions WHERE owner_key = ? AND item_id IN (SELECT id FROM routine_items WHERE owner_key = ? AND routine_id = ?)").bind(owner, owner, existing.id),
      env.DB.prepare("DELETE FROM routine_items WHERE owner_key = ? AND routine_id = ?").bind(owner, existing.id),
      ...nextItemData.map(({ title, listKey, position }) => env.DB.prepare("INSERT INTO routine_items (owner_key, routine_id, title, list_key, position) VALUES (?, ?, ?, ?, ?)").bind(owner, existing.id, title, listKey, position)),
    );
  }
  if (!usesQuantity(trackingMode)) {
    statements.push(env.DB.prepare("DELETE FROM amount_completions WHERE owner_key = ? AND routine_id = ?").bind(owner, existing.id));
  } else {
    const amountKeys = new Set(amounts.map((amount) => amount.key));
    for (const oldAmount of currentAmounts) {
      if (!amountKeys.has(oldAmount.key)) statements.push(env.DB.prepare("DELETE FROM amount_completions WHERE owner_key = ? AND routine_id = ? AND amount_key = ?").bind(owner, existing.id, oldAmount.key));
    }
    for (const amount of amounts) statements.push(env.DB.prepare("UPDATE amount_completions SET count = MIN(count, ?) WHERE owner_key = ? AND routine_id = ? AND amount_key = ?").bind(amount.targetCount, owner, existing.id, amount.key));
  }
  await env.DB.batch(statements);
  const [updated, items] = await Promise.all([
    getRoutine(owner, existing.id),
    env.DB.prepare("SELECT id, routine_id AS routineId, title, list_key AS listKey, position FROM routine_items WHERE owner_key = ? AND routine_id = ? ORDER BY list_key, position, id")
      .bind(owner, existing.id).all<RoutineItemRow>(),
  ]);
  return Response.json({ routine: normalize(updated!, items.results) });
}

export async function DELETE(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid routine" }, { status: 400 });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM item_completions WHERE owner_key = ? AND item_id IN (SELECT id FROM routine_items WHERE owner_key = ? AND routine_id = ?)").bind(owner, owner, id),
    env.DB.prepare("DELETE FROM routine_items WHERE owner_key = ? AND routine_id = ?").bind(owner, id),
    env.DB.prepare("DELETE FROM completions WHERE owner_key = ? AND routine_id = ?").bind(owner, id),
    env.DB.prepare("DELETE FROM quantity_completions WHERE owner_key = ? AND routine_id = ?").bind(owner, id),
    env.DB.prepare("DELETE FROM amount_completions WHERE owner_key = ? AND routine_id = ?").bind(owner, id),
    env.DB.prepare("DELETE FROM routines WHERE owner_key = ? AND id = ?").bind(owner, id),
  ]);
  return Response.json({ ok: true });
}
