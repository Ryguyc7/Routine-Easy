type InstructionImageLike = { id?: string };
type InstructionTrackerLike = { key?: string; kind?: string; images?: InstructionImageLike[] };

async function ownerNamespace(owner: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(owner));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export async function instructionImageObjectKey(owner: string, routineId: number, trackerKey: string, imageId: string) {
  const safeTracker = trackerKey.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
  return `instruction-images/${await ownerNamespace(owner)}/${routineId}/${safeTracker}/${imageId}`;
}

export async function instructionImageKeys(owner: string, routineId: number, trackers: InstructionTrackerLike[]) {
  const keys: string[] = [];
  for (const tracker of trackers) {
    if (tracker.kind !== "instructions" || !tracker.key) continue;
    for (const image of tracker.images ?? []) {
      if (image.id) keys.push(await instructionImageObjectKey(owner, routineId, tracker.key, image.id));
    }
  }
  return keys;
}
