import { env } from "cloudflare:workers";
import { ensureDatabase, ownerKey } from "../../../db/storage";

type TrackingMode = "simple" | "checklist" | "quantity";
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
};
type RoutineItemRow = { id: number; routineId: number; title: string; position: number };

const ROUTINE_SELECT = `id, name, emoji, color, time, days,
  tracking_mode AS trackingMode, target_count AS targetCount, unit`;

function cleanItems(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item).trim().slice(0, 80)).filter(Boolean).slice(0, 20);
}

function cleanMode(mode: unknown): TrackingMode {
  return mode === "checklist" || mode === "quantity" ? mode : "simple";
}

function cleanCount(count: unknown, mode: TrackingMode) {
  if (mode !== "quantity") return 1;
  const value = Math.round(Number(count));
  return Number.isFinite(value) ? Math.min(12, Math.max(2, value)) : 4;
}

function cleanUnit(unit: unknown, mode: TrackingMode) {
  if (mode !== "quantity") return "times";
  return String(unit ?? "pills").trim().slice(0, 24) || "pills";
}

function normalize(row: RoutineRow, items: RoutineItemRow[]) {
  const trackingMode = row.trackingMode === "simple" && items.length ? "checklist" : cleanMode(row.trackingMode);
  return { ...row, trackingMode, days: JSON.parse(row.days) as number[], items };
}

async function getItems(owner: string) {
  return env.DB.prepare(`SELECT id, routine_id AS routineId, title, position
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
  let routines = await env.DB.prepare(`SELECT ${ROUTINE_SELECT} FROM routines WHERE owner_key = ? ORDER BY id`)
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
    routines = await env.DB.prepare(`SELECT ${ROUTINE_SELECT} FROM routines WHERE owner_key = ? ORDER BY id`).bind(owner).all<RoutineRow>();
    const workout = routines.results.find((routine) => routine.name === "Workout");
    if (workout) {
      await env.DB.prepare("UPDATE routines SET tracking_mode = 'checklist' WHERE owner_key = ? AND id = ?").bind(owner, workout.id).run();
      workout.trackingMode = "checklist";
      await env.DB.batch(["Warm up", "Main workout", "Cool down"].map((title, position) =>
        env.DB.prepare("INSERT INTO routine_items (owner_key, routine_id, title, position) VALUES (?, ?, ?, ?)").bind(owner, workout.id, title, position),
      ));
    }
  }

  const [items, completions, itemCompletions, quantityCompletions] = await Promise.all([
    getItems(owner),
    env.DB.prepare("SELECT routine_id AS routineId, date FROM completions WHERE owner_key = ?").bind(owner).all<{ routineId: number; date: string }>(),
    env.DB.prepare("SELECT item_id AS itemId, date FROM item_completions WHERE owner_key = ?").bind(owner).all<{ itemId: number; date: string }>(),
    env.DB.prepare("SELECT routine_id AS routineId, date, count FROM quantity_completions WHERE owner_key = ?").bind(owner).all<{ routineId: number; date: string; count: number }>(),
  ]);
  const itemsByRoutine = new Map<number, RoutineItemRow[]>();
  for (const item of items.results) itemsByRoutine.set(item.routineId, [...(itemsByRoutine.get(item.routineId) ?? []), item]);
  return Response.json({
    routines: routines.results.map((routine) => normalize(routine, itemsByRoutine.get(routine.id) ?? [])),
    completions: completions.results,
    itemCompletions: itemCompletions.results,
    quantityCompletions: quantityCompletions.results,
  });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as {
    name?: string; emoji?: string; color?: string; time?: string; days?: number[];
    trackingMode?: TrackingMode; targetCount?: number; unit?: string; items?: string[];
  };
  const name = payload.name?.trim();
  if (!name || !payload.days?.length) return Response.json({ error: "Name and days are required" }, { status: 400 });
  const trackingMode = cleanMode(payload.trackingMode);
  const targetCount = cleanCount(payload.targetCount, trackingMode);
  const unit = cleanUnit(payload.unit, trackingMode);
  const result = await env.DB.prepare(`INSERT INTO routines
    (owner_key, name, emoji, color, time, days, tracking_mode, target_count, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING ${ROUTINE_SELECT}`)
    .bind(owner, name.slice(0, 40), payload.emoji ?? "✨", payload.color ?? "#6C5CE7", payload.time ?? "", JSON.stringify(payload.days), trackingMode, targetCount, unit)
    .first<RoutineRow>();
  const itemTitles = trackingMode === "checklist" ? cleanItems(payload.items) : [];
  if (itemTitles.length) {
    await env.DB.batch(itemTitles.map((title, position) =>
      env.DB.prepare("INSERT INTO routine_items (owner_key, routine_id, title, position) VALUES (?, ?, ?, ?)").bind(owner, result!.id, title, position),
    ));
  }
  const items = await env.DB.prepare("SELECT id, routine_id AS routineId, title, position FROM routine_items WHERE owner_key = ? AND routine_id = ? ORDER BY position, id")
    .bind(owner, result!.id).all<RoutineItemRow>();
  return Response.json({ routine: normalize(result!, items.results) }, { status: 201 });
}

export async function PUT(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const payload = await request.json() as {
    id?: number; time?: string; trackingMode?: TrackingMode; targetCount?: number; unit?: string; items?: string[];
  };
  if (!Number.isInteger(payload.id)) return Response.json({ error: "Invalid routine" }, { status: 400 });
  const existing = await getRoutine(owner, payload.id!);
  if (!existing) return Response.json({ error: "Routine not found" }, { status: 404 });
  const trackingMode = cleanMode(payload.trackingMode ?? existing.trackingMode);
  const targetCount = cleanCount(payload.targetCount ?? existing.targetCount, trackingMode);
  const unit = cleanUnit(payload.unit ?? existing.unit, trackingMode);
  const itemTitles = trackingMode === "checklist" ? cleanItems(payload.items) : [];
  await env.DB.batch([
    env.DB.prepare("UPDATE routines SET time = ?, tracking_mode = ?, target_count = ?, unit = ? WHERE owner_key = ? AND id = ?")
      .bind(payload.time ?? existing.time, trackingMode, targetCount, unit, owner, existing.id),
    env.DB.prepare("DELETE FROM item_completions WHERE owner_key = ? AND item_id IN (SELECT id FROM routine_items WHERE owner_key = ? AND routine_id = ?)").bind(owner, owner, existing.id),
    env.DB.prepare("DELETE FROM routine_items WHERE owner_key = ? AND routine_id = ?").bind(owner, existing.id),
    env.DB.prepare("DELETE FROM quantity_completions WHERE owner_key = ? AND routine_id = ?").bind(owner, existing.id),
    ...itemTitles.map((title, position) => env.DB.prepare("INSERT INTO routine_items (owner_key, routine_id, title, position) VALUES (?, ?, ?, ?)").bind(owner, existing.id, title, position)),
  ]);
  const [updated, items] = await Promise.all([
    getRoutine(owner, existing.id),
    env.DB.prepare("SELECT id, routine_id AS routineId, title, position FROM routine_items WHERE owner_key = ? AND routine_id = ? ORDER BY position, id")
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
    env.DB.prepare("DELETE FROM routines WHERE owner_key = ? AND id = ?").bind(owner, id),
  ]);
  return Response.json({ ok: true });
}
