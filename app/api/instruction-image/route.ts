import { env } from "cloudflare:workers";
import { instructionImageObjectKey } from "../../../db/instruction-images";
import { ensureDatabase, ownerKey } from "../../../db/storage";

type UploadEnv = { DB: D1Database; UPLOADS: R2Bucket };
type InstructionImage = { id: string; contentType?: string };
type TrackerConfig = { key: string; kind?: string; images?: InstructionImage[] };
const runtime = env as unknown as UploadEnv;
const IMAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function findInstructionTracker(owner: string, routineId: number, trackerKey: string) {
  const routine = await runtime.DB.prepare("SELECT amount_config AS amountConfig FROM routines WHERE owner_key = ? AND id = ?")
    .bind(owner, routineId).first<{ amountConfig: string }>();
  if (!routine) return null;
  let trackers: TrackerConfig[] = [];
  try { trackers = JSON.parse(routine.amountConfig); } catch { trackers = []; }
  const trackerIndex = trackers.findIndex((item) => item.key === trackerKey && item.kind === "instructions");
  return trackerIndex < 0 ? null : { trackers, trackerIndex };
}

function readIdentity(url: URL) {
  return {
    routineId: Number(url.searchParams.get("routineId")),
    trackerKey: String(url.searchParams.get("trackerKey") ?? "").trim(),
    imageId: String(url.searchParams.get("imageId") ?? "").trim().toLowerCase(),
  };
}

function validRoutineTracker(routineId: number, trackerKey: string) {
  return Number.isInteger(routineId) && routineId > 0 && /^[a-zA-Z0-9_-]{1,40}$/.test(trackerKey);
}

export async function POST(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const form = await request.formData();
  const routineId = Number(form.get("routineId"));
  const trackerKey = String(form.get("trackerKey") ?? "").trim();
  const file = form.get("image");
  if (!validRoutineTracker(routineId, trackerKey) || !(file instanceof File) || !file.type.startsWith("image/") || file.size <= 0 || file.size > 8 * 1024 * 1024) {
    return Response.json({ error: "Choose an image up to 8 MB" }, { status: 400 });
  }
  const match = await findInstructionTracker(owner, routineId, trackerKey);
  if (!match) return Response.json({ error: "Instructions section not found" }, { status: 404 });
  const tracker = match.trackers[match.trackerIndex];
  if ((tracker.images?.length ?? 0) >= 6) return Response.json({ error: "Instructions can include up to 6 images" }, { status: 400 });

  const image: InstructionImage = { id: crypto.randomUUID(), contentType: file.type || "image/jpeg" };
  const objectKey = await instructionImageObjectKey(owner, routineId, trackerKey, image.id);
  await runtime.UPLOADS.put(objectKey, file.stream(), { httpMetadata: { contentType: image.contentType } });
  match.trackers[match.trackerIndex] = { ...tracker, images: [...(tracker.images ?? []), image] };
  try {
    await runtime.DB.prepare("UPDATE routines SET amount_config = ? WHERE owner_key = ? AND id = ?").bind(JSON.stringify(match.trackers), owner, routineId).run();
  } catch (error) {
    await runtime.UPLOADS.delete(objectKey);
    throw error;
  }
  return Response.json({ ok: true, image });
}

export async function GET(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const identity = readIdentity(new URL(request.url));
  if (!validRoutineTracker(identity.routineId, identity.trackerKey) || !IMAGE_ID.test(identity.imageId)) return new Response("Invalid image", { status: 400 });
  const match = await findInstructionTracker(owner, identity.routineId, identity.trackerKey);
  const image = match?.trackers[match.trackerIndex].images?.find((item) => item.id === identity.imageId);
  if (!image) return new Response("Image not found", { status: 404 });
  const object = await runtime.UPLOADS.get(await instructionImageObjectKey(owner, identity.routineId, identity.trackerKey, identity.imageId));
  if (!object) return new Response("Image not found", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": image.contentType || object.httpMetadata?.contentType || "application/octet-stream", "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  await ensureDatabase();
  const owner = ownerKey(request);
  const identity = readIdentity(new URL(request.url));
  if (!validRoutineTracker(identity.routineId, identity.trackerKey) || !IMAGE_ID.test(identity.imageId)) return Response.json({ error: "Invalid image" }, { status: 400 });
  const match = await findInstructionTracker(owner, identity.routineId, identity.trackerKey);
  if (!match) return Response.json({ error: "Instructions section not found" }, { status: 404 });
  const tracker = match.trackers[match.trackerIndex];
  if (!tracker.images?.some((item) => item.id === identity.imageId)) return Response.json({ error: "Image not found" }, { status: 404 });
  match.trackers[match.trackerIndex] = { ...tracker, images: tracker.images.filter((item) => item.id !== identity.imageId) };
  await runtime.DB.prepare("UPDATE routines SET amount_config = ? WHERE owner_key = ? AND id = ?").bind(JSON.stringify(match.trackers), owner, identity.routineId).run();
  await runtime.UPLOADS.delete(await instructionImageObjectKey(owner, identity.routineId, identity.trackerKey, identity.imageId));
  return Response.json({ ok: true });
}
