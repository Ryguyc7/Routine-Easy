import { env } from "cloudflare:workers";
import { ensureDatabase, ownerKey } from "../../../db/storage";

type UploadEnv = { DB: D1Database; UPLOADS: R2Bucket };
type TrackerConfig = { key: string; kind?: string };
const runtime = env as unknown as UploadEnv;

function imageContentType(file: File) {
  if (/^image\/(?:jpeg|png|webp|gif|heic|heif)$/i.test(file.type)) return file.type.toLowerCase();
  const match = file.name.toLowerCase().match(/\.(jpe?g|png|webp|gif|heic|heif)$/);
  if (!match) return "";
  return match[1] === "jpg" || match[1] === "jpeg" ? "image/jpeg" : match[1] === "heif" ? "image/heif" : `image/${match[1]}`;
}

async function findPhotoTracker(owner: string, routineId: number, trackerKey: string) {
  const routine = await runtime.DB.prepare("SELECT amount_config AS amountConfig FROM routines WHERE owner_key = ? AND id = ?")
    .bind(owner, routineId).first<{ amountConfig: string }>();
  if (!routine) return null;
  let trackers: TrackerConfig[] = [];
  try { trackers = JSON.parse(routine.amountConfig); } catch { trackers = []; }
  const tracker = trackers.find((item) => item.key === trackerKey);
  return tracker?.kind === "photo" ? tracker : null;
}

function readIdentity(url: URL) {
  return {
    routineId: Number(url.searchParams.get("routineId")),
    trackerKey: String(url.searchParams.get("trackerKey") ?? "").trim(),
    date: String(url.searchParams.get("date") ?? ""),
  };
}

function validIdentity(identity: ReturnType<typeof readIdentity>) {
  return Number.isInteger(identity.routineId) && Boolean(identity.trackerKey) && /^\d{4}-\d{2}-\d{2}$/.test(identity.date);
}

export async function POST(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const form = await request.formData();
  const identity = { routineId: Number(form.get("routineId")), trackerKey: String(form.get("trackerKey") ?? "").trim(), date: String(form.get("date") ?? "") };
  const file = form.get("photo");
  const contentType = file instanceof File ? imageContentType(file) : "";
  if (!validIdentity(identity) || !(file instanceof File) || !contentType || file.size <= 0 || file.size > 20 * 1024 * 1024) {
    return Response.json({ error: "Choose a JPG, PNG, WebP, GIF, or HEIC image up to 20 MB" }, { status: 400 });
  }
  if (!await findPhotoTracker(owner, identity.routineId, identity.trackerKey)) return Response.json({ error: "Photo tracker not found" }, { status: 404 });

  const previous = await runtime.DB.prepare("SELECT file_key AS fileKey FROM tracker_entries WHERE owner_key = ? AND routine_id = ? AND tracker_key = ? AND date = ?")
    .bind(owner, identity.routineId, identity.trackerKey, identity.date).first<{ fileKey: string }>();
  const fileKey = `routine-photos/${crypto.randomUUID()}`;
  await runtime.UPLOADS.put(fileKey, file.stream(), { httpMetadata: { contentType } });
  try {
    await runtime.DB.batch([
      runtime.DB.prepare(`INSERT INTO tracker_entries (owner_key, routine_id, tracker_key, date, value_text, file_key, content_type)
        VALUES (?, ?, ?, ?, '', ?, ?)
        ON CONFLICT(owner_key, routine_id, tracker_key, date) DO UPDATE SET value_text = '', file_key = excluded.file_key, content_type = excluded.content_type`)
        .bind(owner, identity.routineId, identity.trackerKey, identity.date, fileKey, contentType),
      runtime.DB.prepare(`INSERT INTO amount_completions (owner_key, routine_id, amount_key, date, count) VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(owner_key, routine_id, amount_key, date) DO UPDATE SET count = 1`)
        .bind(owner, identity.routineId, identity.trackerKey, identity.date),
    ]);
  } catch (error) {
    await runtime.UPLOADS.delete(fileKey);
    throw error;
  }
  if (previous?.fileKey) await runtime.UPLOADS.delete(previous.fileKey);
  return Response.json({ ok: true, entry: { ...identity, value: "", hasFile: true } });
}

export async function GET(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const identity = readIdentity(new URL(request.url));
  if (!validIdentity(identity)) return new Response("Invalid photo", { status: 400 });
  const entry = await runtime.DB.prepare("SELECT file_key AS fileKey, content_type AS contentType FROM tracker_entries WHERE owner_key = ? AND routine_id = ? AND tracker_key = ? AND date = ?")
    .bind(owner, identity.routineId, identity.trackerKey, identity.date).first<{ fileKey: string; contentType: string }>();
  if (!entry?.fileKey) return new Response("Photo not found", { status: 404 });
  const object = await runtime.UPLOADS.get(entry.fileKey);
  if (!object) return new Response("Photo not found", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": entry.contentType || object.httpMetadata?.contentType || "application/octet-stream", "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const identity = readIdentity(new URL(request.url));
  if (!validIdentity(identity)) return Response.json({ error: "Invalid photo" }, { status: 400 });
  const entry = await runtime.DB.prepare("SELECT file_key AS fileKey FROM tracker_entries WHERE owner_key = ? AND routine_id = ? AND tracker_key = ? AND date = ?")
    .bind(owner, identity.routineId, identity.trackerKey, identity.date).first<{ fileKey: string }>();
  await runtime.DB.batch([
    runtime.DB.prepare("DELETE FROM tracker_entries WHERE owner_key = ? AND routine_id = ? AND tracker_key = ? AND date = ?").bind(owner, identity.routineId, identity.trackerKey, identity.date),
    runtime.DB.prepare("DELETE FROM amount_completions WHERE owner_key = ? AND routine_id = ? AND amount_key = ? AND date = ?").bind(owner, identity.routineId, identity.trackerKey, identity.date),
  ]);
  if (entry?.fileKey) await runtime.UPLOADS.delete(entry.fileKey);
  return Response.json({ ok: true });
}
