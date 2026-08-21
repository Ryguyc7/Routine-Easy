import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";

const DATA_KEY = "routine-easy-device-data-v1";
const PREFERENCES_KEY = "routineez-preferences";
const ONBOARDING_KEY = "routineez-onboarding-complete";

export type DeviceSnapshot = {
  version: 1;
  routines: unknown[];
  completions: unknown[];
  itemCompletions: unknown[];
  amountCompletions: unknown[];
  trackerEntries: unknown[];
};

export const isNativeApp = () => Capacitor.isNativePlatform();

export async function loadDeviceSnapshot(): Promise<DeviceSnapshot> {
  const { value } = await Preferences.get({ key: DATA_KEY });
  if (!value) return emptyDeviceSnapshot();
  try {
    const saved = JSON.parse(value) as Partial<DeviceSnapshot>;
    return {
      version: 1,
      routines: Array.isArray(saved.routines) ? saved.routines : [],
      completions: Array.isArray(saved.completions) ? saved.completions : [],
      itemCompletions: Array.isArray(saved.itemCompletions) ? saved.itemCompletions : [],
      amountCompletions: Array.isArray(saved.amountCompletions) ? saved.amountCompletions : [],
      trackerEntries: Array.isArray(saved.trackerEntries) ? saved.trackerEntries : [],
    };
  } catch {
    return emptyDeviceSnapshot();
  }
}

export async function saveDeviceSnapshot(snapshot: DeviceSnapshot) {
  await Preferences.set({ key: DATA_KEY, value: JSON.stringify(snapshot) });
}

export async function clearDeviceData() {
  await Preferences.remove({ key: DATA_KEY });
  try {
    await Filesystem.rmdir({ path: "routine-photos", directory: Directory.Data, recursive: true });
  } catch {
    // The photo directory does not exist until the first photo is saved.
  }
}

export async function loadDevicePreferences() {
  const { value } = await Preferences.get({ key: PREFERENCES_KEY });
  if (!value) return undefined;
  try { return JSON.parse(value) as unknown; } catch { return undefined; }
}

export async function saveDevicePreferences(value: unknown) {
  await Preferences.set({ key: PREFERENCES_KEY, value: JSON.stringify(value) });
}

export async function hasCompletedDeviceOnboarding() {
  const { value } = await Preferences.get({ key: ONBOARDING_KEY });
  return value === "true";
}

export async function completeDeviceOnboarding() {
  await Preferences.set({ key: ONBOARDING_KEY, value: "true" });
}

function emptyDeviceSnapshot(): DeviceSnapshot {
  return { version: 1, routines: [], completions: [], itemCompletions: [], amountCompletions: [], trackerEntries: [] };
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read photo"));
    reader.readAsDataURL(file);
  });
}

function photoExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic" || file.type === "image/heif") return "heic";
  return "jpg";
}

export async function saveDevicePhoto(routineId: number, trackerKey: string, date: string, file: File) {
  const safeTracker = trackerKey.replace(/[^a-zA-Z0-9_-]/g, "-");
  const path = `routine-photos/${routineId}-${safeTracker}-${date}-${Date.now()}.${photoExtension(file)}`;
  await Filesystem.writeFile({ path, data: await fileToBase64(file), directory: Directory.Data, recursive: true });
  return { path, contentType: file.type || "image/jpeg" };
}

export async function saveDeviceInstructionImage(routineId: number, trackerKey: string, file: File) {
  const safeTracker = trackerKey.replace(/[^a-zA-Z0-9_-]/g, "-");
  const id = crypto.randomUUID();
  const path = `routine-photos/instructions/${routineId}-${safeTracker}-${id}.${photoExtension(file)}`;
  await Filesystem.writeFile({ path, data: await fileToBase64(file), directory: Directory.Data, recursive: true });
  return { id, filePath: path, contentType: file.type || "image/jpeg" };
}

export async function removeDevicePhoto(path?: string) {
  if (!path) return;
  try { await Filesystem.deleteFile({ path, directory: Directory.Data }); } catch { /* Already removed. */ }
}

export async function readDevicePhoto(path: string, contentType = "image/jpeg") {
  const result = await Filesystem.readFile({ path, directory: Directory.Data });
  if (typeof result.data !== "string") return "";
  return `data:${contentType};base64,${result.data}`;
}
