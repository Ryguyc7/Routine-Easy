"use client";

import { FormEvent, startTransition, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CalendarDays, CalendarPlus2, ChevronLeft, ChevronRight, CircleCheckBig, CircleUserRound, Clock3, Copy, Database, Download, EyeOff, History, ListChecks, Monitor, Moon, ShieldCheck, SkipForward, Settings2, Sparkles, Sun, Trash2, Upload, Volume2, X, type LucideIcon } from "lucide-react";
import { clearDeviceData, isNativeApp, loadDevicePreferences, loadDeviceSnapshot, readDevicePhoto, removeDevicePhoto, saveDevicePhoto, saveDevicePreferences, saveDeviceSnapshot, type DeviceSnapshot } from "./device-storage";

type RoutineItem = { id: number; routineId: number; title: string; listKey: string; position: number };
type TrackerKind = "amount" | "duration" | "timer" | "rating" | "number" | "note" | "photo" | "avoidance";
type RoutineAmount = { key: string; name: string; targetCount: number; kind?: TrackerKind; unit?: string };
type RoutineList = { key: string; name: string };
type RoutineListDraft = RoutineList & { items: string };
type DayTrackingPlan = { tracking: string[]; label?: string };
type DayVariant = string | DayTrackingPlan;
type TrackingMode = "simple" | "checklist" | "quantity" | "hybrid";
const usesChecklist = (mode: TrackingMode) => mode === "checklist" || mode === "hybrid";
const usesQuantity = (mode: TrackingMode) => mode === "quantity" || mode === "hybrid";
type Routine = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  time: string;
  days: number[];
  trackingMode: TrackingMode;
  targetCount: number;
  unit: string;
  amounts: RoutineAmount[];
  lists: RoutineList[];
  dayVariants: Partial<Record<number, DayVariant>>;
  startDate: string;
  endDate: string;
  items: RoutineItem[];
};

type Completion = { routineId: number; date: string; status: "completed" | "skipped" };
type ItemCompletion = { itemId: number; date: string };
type AmountCompletion = { routineId: number; amountKey: string; date: string; count: number };
type TrackerEntry = { routineId: number; trackerKey: string; date: string; value: string; hasFile: boolean; filePath?: string; contentType?: string };
type Tab = "today" | "calendar" | "routines" | "history" | "settings";
type MainTab = Exclude<Tab, "settings">;
type BottomNavPhase = "idle" | "exiting" | "entering";
type TimeFormat = "12-hour" | "24-hour";
type WeekStart = "sunday" | "monday";
type MotionPreference = "full" | "reduced";
type ThemePreference = "light" | "dark" | "system";
type TogglePreference = "on" | "off";
type CompletedVisibility = "show" | "hide";
type AppPreferences = { timeFormat: TimeFormat; weekStartsOn: WeekStart; motion: MotionPreference; theme: ThemePreference; completedVisibility: CompletedVisibility; feedback: TogglePreference; reminders: TogglePreference };
type RoutineTemplate = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  time: string;
  days: number[];
  lists?: RoutineListDraft[];
  amounts?: RoutineAmount[];
  dayVariants?: Partial<Record<number, DayVariant>>;
  startDate?: string;
  endDate?: string;
};

const DEFAULT_PREFERENCES: AppPreferences = { timeFormat: "12-hour", weekStartsOn: "sunday", motion: "full", theme: "system", completedVisibility: "show", feedback: "on", reminders: "off" };
const SPLASH_DURATION_MS = 2100;
const SPLASH_FADE_MS = 650;

function cleanPreferences(value: unknown): AppPreferences {
  const saved = value && typeof value === "object" ? value as Partial<AppPreferences> : {};
  return {
    timeFormat: saved.timeFormat === "24-hour" ? "24-hour" : "12-hour",
    weekStartsOn: saved.weekStartsOn === "monday" ? "monday" : "sunday",
    motion: saved.motion === "reduced" ? "reduced" : "full",
    theme: saved.theme === "light" || saved.theme === "dark" ? saved.theme : "system",
    completedVisibility: saved.completedVisibility === "hide" ? "hide" : "show",
    feedback: saved.feedback === "off" ? "off" : "on",
    reminders: saved.reminders === "on" ? "on" : "off",
  };
}

const COLORS = [
  "#6C5CE7", "#845EF7", "#8338EC", "#9C36B5", "#CC5DE8", "#8E7DBE", "#5F3DC4", "#6741D9",
  "#4D96FF", "#3A86FF", "#4263EB", "#364FC7", "#339AF0", "#1C7ED6", "#22B8CF", "#0C8599",
  "#00A896", "#2A9D8F", "#20C997", "#099268", "#49A078", "#2F9E44", "#51CF66", "#6A994E",
  "#94D82D", "#74B816", "#F4B942", "#FFBE0B", "#FCC419", "#F08C00", "#FF922B", "#E67700",
  "#FF8A65", "#FF6B35", "#E76F51", "#E8590C", "#FF6B6B", "#EF476F", "#EC6F91", "#F06595",
  "#D9485F", "#C2255C", "#C92A2A", "#8D6E63", "#A66A4C", "#6B7280", "#495057", "#212529",
];
const ICON_CATEGORIES = [
  { id: "basics", label: "Basics", icon: "✨", icons: ["✨", "✅", "⭐", "🎯", "⏰", "📅", "📝", "💡", "🧠", "❤️", "🙏", "🌈", "🔥", "🎉", "💯", "🚀", "⚡", "🏆", "📌", "📍", "🔑", "🗓️", "⌛", "🎈", "🧭", "🪄", "🛎️", "❗", "❓", "🎲", "🪙", "🔆", "📣", "🧱"] },
  { id: "health", label: "Health", icon: "💊", icons: ["💊", "💉", "🩺", "🩹", "🧪", "🌡️", "🦷", "🪥", "🧴", "🧼", "🚿", "🛁", "🧬", "🩸", "🩻", "🦠", "🧫", "🫁", "🫀", "👁️", "👂", "👃", "🦴", "🦵", "🦶", "💪", "🧑‍⚕️", "👩‍⚕️", "👨‍⚕️", "🏥", "🚑", "🩼", "🦽", "🦯", "👓", "🥼"] },
  { id: "wellness", label: "Wellness", icon: "🌙", icons: ["💧", "😴", "🛏️", "🌙", "☀️", "🌅", "🧘", "🌬️", "💆", "🧖", "💅", "🪞", "🛌", "🕯️", "🪷", "🌸", "🌺", "🍃", "🌊", "🫧", "🫶", "😊", "😌", "🥱", "🤗", "🧘‍♀️", "🧘‍♂️", "💆‍♀️", "💆‍♂️", "🧖‍♀️", "🧖‍♂️", "💤", "🌤️", "🌌"] },
  { id: "fitness", label: "Fitness", icon: "🏃", icons: ["🏋️", "🏃", "🚶", "🚴", "🏊", "🧗", "🤸", "⛹️", "⚽", "🏀", "🎾", "🥊", "🏄", "🚣", "🏂", "⛷️", "🏌️", "🏇", "🤾", "🏸", "🏓", "🏈", "⚾", "🏐", "🏉", "🥏", "🛹", "🛼", "🥋", "🥅", "🎿", "🛶", "🏹", "🏒", "🥌"] },
  { id: "food", label: "Food", icon: "🥗", icons: ["🥣", "🍳", "🥑", "🥗", "🍲", "🥪", "🍝", "🍚", "🍜", "🍣", "🍞", "🥐", "🥞", "🥕", "🥦", "🍎", "🍊", "🍌", "🍓", "🫐", "🥜", "🥛", "☕", "🍵", "🥤", "🍽️", "🍇", "🍉", "🍋", "🍍", "🥭", "🍑", "🍒", "🥝", "🍅", "🫑", "🌽", "🧅", "🧄", "🥔", "🍠", "🥒", "🍆", "🍄", "🫘", "🧀", "🥚", "🥩", "🍗", "🍔", "🍕", "🌮", "🌯", "🥙", "🥘", "🍛", "🍱", "🥟", "🍤", "🍦", "🍪", "🎂", "🍫", "🍯", "🧃"] },
  { id: "home", label: "Home", icon: "🧹", icons: ["🧹", "🧽", "🧺", "👕", "🗑️", "🪴", "🌿", "🌻", "🐕", "🐈", "🐾", "🏠", "🏡", "🛋️", "🪑", "🪟", "🚪", "🧯", "🧰", "🪛", "🔨", "🪚", "🪠", "🪣", "🧤", "🔧", "⚙️", "🔩", "🧸", "🖼️", "🕰️", "📦", "🪻", "🌱", "🌳", "🐇", "🐟", "🐦", "🐢"] },
  { id: "work", label: "Work", icon: "💼", icons: ["📚", "✍️", "💻", "📧", "📞", "💼", "💰", "🛒", "🗂️", "📊", "📈", "📉", "🧮", "🗃️", "📋", "📎", "🖇️", "✂️", "🖨️", "🖥️", "⌨️", "🖱️", "🗄️", "🏦", "🧾", "🗒️", "🧑‍💻", "👩‍💻", "👨‍💻", "🏢", "🏷️"] },
  { id: "creative", label: "Creative", icon: "🎨", icons: ["🎨", "🎵", "🎸", "🎮", "🧩", "📸", "🎭", "🎬", "🎤", "🎹", "🎻", "🥁", "🎷", "🎺", "🪕", "🖌️", "🖍️", "✏️", "🧵", "🧶", "🪡", "📐", "📏", "🩰", "🪩", "🎙️", "🎚️", "🎛️", "🎼"] },
  { id: "life", label: "Life", icon: "🌍", icons: ["🌍", "🚗", "✈️", "🎁", "👨‍👩‍👧‍👦", "🤝", "💬", "📵", "🔔", "🗺️", "🏖️", "🏕️", "⛺", "🚆", "🚇", "🚲", "🛵", "🚌", "🚕", "🚙", "🚤", "🚢", "🛫", "🛬", "🧳", "🛂", "🏨", "🗼", "🏔️", "🌋", "🏝️", "🎟️", "🎫", "🎪", "🎡", "🎢", "🥳", "🎊", "👥", "👶", "🧑", "🧓", "👫", "💌", "📮", "☎️"] },
] as const;
type IconCategoryId = "all" | typeof ICON_CATEGORIES[number]["id"];
const EMOJIS = ICON_CATEGORIES.flatMap((category) => [...category.icons]);
const ALL_ICON_PREVIEW_COUNT = 48;
const EASY_CATEGORY_COLORS = ["var(--purple)", "var(--coral)", "var(--gold)", "var(--sky)"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  { id: "vitamins", name: "Morning vitamins", description: "A simple daily supplement check.", emoji: "💊", color: "#6C5CE7", time: "08:00", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "workout", name: "Workout", description: "Warm up, train, and cool down.", emoji: "🏋️", color: "#4D96FF", time: "07:30", days: [1, 3, 5], lists: [{ key: "workout-list", name: "Workout", items: "Warm up\nMain workout\nCool down" }] },
  { id: "breakfast", name: "Breakfast", description: "Keep your first meal consistent.", emoji: "🥣", color: "#F4B942", time: "08:30", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "evening-reset", name: "Evening reset", description: "Close the day with a clean slate.", emoji: "🌙", color: "#845EF7", time: "20:30", days: [0, 1, 2, 3, 4, 5, 6], lists: [{ key: "evening-list", name: "Reset", items: "Tidy up\nPlan tomorrow\nPut phone away" }] },
  { id: "cleaning", name: "Weekly clean", description: "A compact weekend cleaning list.", emoji: "🧹", color: "#00A896", time: "10:00", days: [6], lists: [{ key: "cleaning-list", name: "Cleaning", items: "Kitchen\nBathroom\nFloors" }] },
  { id: "bedtime", name: "Bedtime routine", description: "Wind down without overthinking it.", emoji: "😴", color: "#9C36B5", time: "22:00", days: [0, 1, 2, 3, 4, 5, 6], lists: [{ key: "bedtime-list", name: "Wind down", items: "Brush teeth\nSet alarm\nRead" }] },
];

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function readDayVariants(form: FormData) {
  const serialized = form.get("dayVariants");
  if (typeof serialized === "string" && serialized) {
    try {
      const source = JSON.parse(serialized) as Record<string, unknown>;
      const variants: Record<string, DayVariant> = {};
      DAY_NAMES.forEach((_, day) => {
        const value = source[String(day)];
        if (typeof value === "string") {
          const label = value.trim().slice(0, 80);
          if (label) variants[String(day)] = label;
          return;
        }
        if (!value || typeof value !== "object" || Array.isArray(value)) return;
        const raw = value as { tracking?: unknown; label?: unknown };
        const tracking = Array.isArray(raw.tracking) ? [...new Set(raw.tracking.map(String).filter((item) => /^(all|simple|(?:list|amount):[a-zA-Z0-9_-]{1,40})$/.test(item)))].slice(0, 18) : [];
        const label = String(raw.label ?? "").trim().slice(0, 80);
        if (tracking.length || label) variants[String(day)] = { tracking: tracking.length ? tracking : ["all"], ...(label ? { label } : {}) };
      });
      return variants;
    } catch { /* Fall back to legacy fields below. */ }
  }
  const variants: Record<string, DayVariant> = {};
  DAY_NAMES.forEach((_, day) => {
    const value = String(form.get(`dayVariant-${day}`) ?? "").trim();
    if (value) variants[String(day)] = value;
  });
  return variants;
}

function trackingModeFor(lists: RoutineListDraft[], amounts: RoutineAmount[]): TrackingMode {
  return lists.length && amounts.length ? "hybrid" : lists.length ? "checklist" : amounts.length ? "quantity" : "simple";
}

function trackerKind(tracker: RoutineAmount): TrackerKind {
  return tracker.kind ?? "amount";
}

function trackerIsComplete(tracker: RoutineAmount, count: number) {
  const kind = trackerKind(tracker);
  if (kind === "rating" || kind === "number" || kind === "note" || kind === "photo" || kind === "avoidance") return count > 0;
  if (kind === "timer") return count >= tracker.targetCount * 60;
  return count >= tracker.targetCount;
}

function trackerProgress(tracker: RoutineAmount, count: number) {
  if (trackerKind(tracker) === "rating" || trackerKind(tracker) === "number" || trackerKind(tracker) === "note" || trackerKind(tracker) === "photo" || trackerKind(tracker) === "avoidance") return count > 0 ? 100 : 0;
  if (trackerKind(tracker) === "timer") return Math.min(100, Math.round((count / Math.max(60, tracker.targetCount * 60)) * 100));
  return Math.min(100, Math.round((count / Math.max(1, tracker.targetCount)) * 100));
}

function trackerCompletionValue(tracker: RoutineAmount) {
  const kind = trackerKind(tracker);
  if (kind === "timer") return tracker.targetCount * 60;
  if (kind === "rating" || kind === "number" || kind === "avoidance") return 1;
  return tracker.targetCount;
}

function trackerMaximumValue(tracker: RoutineAmount) {
  const kind = trackerKind(tracker);
  if (kind === "rating") return 5;
  if (kind === "avoidance") return 1;
  if (kind === "timer") return 86_400;
  if (kind === "number") return 1_000_000_000;
  return tracker.targetCount;
}

function formatTimerSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function trackerSummary(tracker: RoutineAmount, count: number) {
  const kind = trackerKind(tracker);
  if (kind === "rating") return count ? `${count}/5 ${tracker.name}` : `Rate ${tracker.name}`;
  if (kind === "note") return count ? `${tracker.name} added` : `Add ${tracker.name}`;
  if (kind === "photo") return count ? `${tracker.name} added` : `Add ${tracker.name}`;
  if (kind === "avoidance") return count ? `${tracker.name}: on track` : tracker.name;
  if (kind === "number") return count ? `${count}${tracker.unit ? ` ${tracker.unit}` : ""} ${tracker.name}` : `Enter ${tracker.name}`;
  if (kind === "timer") return `${formatTimerSeconds(count)} / ${tracker.targetCount}:00 ${tracker.name}`;
  const unit = tracker.unit || (kind === "duration" || kind === "timer" ? "min" : "");
  return `${count}/${tracker.targetCount}${unit ? ` ${unit}` : ""} ${tracker.name}`;
}

function trackerKindLabel(tracker: RoutineAmount) {
  const labels: Record<TrackerKind, string> = { amount: "Daily amount", duration: "Duration", timer: "Timer", rating: "Rating", number: "Number", note: "Note", photo: "Photo", avoidance: "Avoided habit" };
  return labels[trackerKind(tracker)];
}

function readTrackingLists(form: FormData) {
  try {
    const lists = JSON.parse(String(form.get("lists") ?? "[]")) as RoutineListDraft[];
    return lists.map((list) => ({ ...list, items: list.items.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) }));
  } catch {
    return [];
  }
}

function routineFromForm(form: FormData, id: number, existing: Routine | undefined, nextItemId: number): Routine {
  const drafts = readTrackingLists(form);
  const amounts = (() => {
    try { return JSON.parse(String(form.get("amounts") ?? "[]")) as RoutineAmount[]; } catch { return []; }
  })();
  const days = DAY_NAMES.map((_, index) => index).filter((index) => form.get(`day-${index}`));
  let itemId = nextItemId;
  const items = drafts.flatMap((list) => list.items.map((title, position) => {
    const previous = existing?.items.find((item) => item.listKey === list.key && item.title === title);
    return { id: previous?.id ?? itemId++, routineId: id, title, listKey: list.key, position };
  }));
  return {
    id,
    name: String(form.get("name") ?? "New routine").trim().slice(0, 80) || "New routine",
    emoji: String(form.get("emoji") ?? "✨").slice(0, 12),
    color: String(form.get("color") ?? COLORS[0]),
    time: String(form.get("time") ?? ""),
    days,
    trackingMode: trackingModeFor(drafts.map(({ key, name, items }) => ({ key, name, items: items.join("\n") })), amounts),
    targetCount: amounts[0]?.targetCount ?? 1,
    unit: amounts[0]?.unit ?? "",
    amounts,
    lists: drafts.map(({ key, name }) => ({ key, name })),
    dayVariants: readDayVariants(form),
    startDate: String(form.get("startDate") ?? ""),
    endDate: String(form.get("endDate") ?? ""),
    items,
  };
}

function routineActiveOnDate(routine: Routine, date: string) {
  return (!routine.startDate || date >= routine.startDate) && (!routine.endDate || date <= routine.endDate);
}

function routineTrackingForDay(routine: Routine, day: number) {
  const variant = routine.dayVariants?.[day];
  const refs = typeof variant === "object" && Array.isArray(variant.tracking) ? variant.tracking : [];
  const useAll = !refs.length || refs.includes("all");
  const lists = useAll ? routine.lists : routine.lists.filter((list) => refs.includes(`list:${list.key}`));
  const amounts = useAll ? routine.amounts : routine.amounts.filter((amount) => refs.includes(`amount:${amount.key}`));
  const listKeys = new Set(lists.map((list) => list.key));
  const items = useAll ? routine.items : routine.items.filter((item) => listKeys.has(item.listKey));
  const mode: TrackingMode = lists.length && amounts.length ? "hybrid" : lists.length ? "checklist" : amounts.length ? "quantity" : "simple";
  return { lists, amounts, items, mode };
}

function routineTrackingForDate(routine: Routine, date: string) {
  return routineTrackingForDay(routine, new Date(`${date}T12:00:00`).getDay());
}

function formatShortDate(date: string) {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateRange(routine: Routine) {
  if (routine.startDate && routine.endDate) return `${formatShortDate(routine.startDate)}–${formatShortDate(routine.endDate)}`;
  if (routine.startDate) return `From ${formatShortDate(routine.startDate)}`;
  if (routine.endDate) return `Until ${formatShortDate(routine.endDate)}`;
  return "No date limit";
}

function formatRoutineTime(time: string, format: TimeFormat) {
  if (!time) return "Anytime";
  if (format === "24-hour") return time;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function useAnimatedNumber(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    if (duration <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      valueRef.current = target;
      setValue(target);
      return;
    }

    const from = valueRef.current;
    const difference = target - from;
    if (difference === 0) return;
    const startedAt = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      const elapsed = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      const next = Math.round(from + difference * eased);
      valueRef.current = next;
      setValue(next);
      if (elapsed < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

export default function Home() {
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashLeaving, setSplashLeaving] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const settingsReturnTabRef = useRef<Exclude<Tab, "settings">>("today");
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [itemCompletions, setItemCompletions] = useState<ItemCompletion[]>([]);
  const [amountCompletions, setAmountCompletions] = useState<AmountCompletion[]>([]);
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoutine, setSelectedRoutine] = useState<number | "all">("all");
  const [selectedHistoryRoutine, setSelectedHistoryRoutine] = useState<number | "all">("all");
  const [month, setMonth] = useState(() => new Date(2000, 0, 1, 12));
  const [showAdd, setShowAdd] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [historyDayEditorOpen, setHistoryDayEditorOpen] = useState(false);
  const [bottomNavReturning, setBottomNavReturning] = useState(false);
  const [bottomNavPhase, setBottomNavPhase] = useState<BottomNavPhase>("idle");
  const [selectedTemplate, setSelectedTemplate] = useState<RoutineTemplate | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  const [routineToDelete, setRoutineToDelete] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const completionsRef = useRef<Completion[]>([]);
  const itemCompletionsRef = useRef<ItemCompletion[]>([]);
  const amountCompletionsRef = useRef<AmountCompletion[]>([]);
  const trackerEntriesRef = useRef<TrackerEntry[]>([]);
  const routineMutationQueuesRef = useRef(new Map<number, Promise<void>>());
  const deviceSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingDeviceSnapshotRef = useRef<DeviceSnapshot | null>(null);
  const deviceSaveTimerRef = useRef<number | undefined>(undefined);
  const bottomNavReturnTimerRef = useRef<number | undefined>(undefined);
  const bottomNavSwitchTimerRef = useRef<number | undefined>(undefined);
  const [today, setToday] = useState(() => new Date(2000, 0, 1, 12));
  const todayKey = localDateKey(today);

  function updateCompletions(updater: (items: Completion[]) => Completion[]) {
    const next = updater(completionsRef.current);
    completionsRef.current = next;
    setCompletions(next);
  }

  function updateItemCompletions(updater: (items: ItemCompletion[]) => ItemCompletion[]) {
    const next = updater(itemCompletionsRef.current);
    itemCompletionsRef.current = next;
    setItemCompletions(next);
  }

  function updateAmountCompletions(updater: (items: AmountCompletion[]) => AmountCompletion[]) {
    const next = updater(amountCompletionsRef.current);
    amountCompletionsRef.current = next;
    setAmountCompletions(next);
  }

  function updateTrackerEntries(updater: (items: TrackerEntry[]) => TrackerEntry[]) {
    const next = updater(trackerEntriesRef.current);
    trackerEntriesRef.current = next;
    setTrackerEntries(next);
  }

  function queueRoutineMutation(routineId: number, request: () => Promise<Response>) {
    if (isNativeApp()) return Promise.resolve();
    const queues = routineMutationQueuesRef.current;
    const previous = queues.get(routineId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(async () => {
      const response = await request();
      if (!response.ok) throw new Error("Routine update failed");
    }).catch(async () => {
      await loadData();
    }).finally(() => {
      if (queues.get(routineId) === current) queues.delete(routineId);
    });
    queues.set(routineId, current);
    return current;
  }

  async function loadData() {
    try {
      if (isNativeApp()) {
        const data = await loadDeviceSnapshot();
        setRoutines(data.routines as Routine[]);
        completionsRef.current = data.completions as Completion[];
        itemCompletionsRef.current = data.itemCompletions as ItemCompletion[];
        amountCompletionsRef.current = data.amountCompletions as AmountCompletion[];
        trackerEntriesRef.current = data.trackerEntries as TrackerEntry[];
        setCompletions(completionsRef.current);
        setItemCompletions(itemCompletionsRef.current);
        setAmountCompletions(amountCompletionsRef.current);
        setTrackerEntries(trackerEntriesRef.current);
        setError("");
        return;
      }
      const response = await fetch("/api/routines", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load your routines.");
      const data = await response.json();
      setRoutines(data.routines);
      completionsRef.current = data.completions;
      itemCompletionsRef.current = data.itemCompletions ?? [];
      amountCompletionsRef.current = data.amountCompletions ?? [];
      trackerEntriesRef.current = data.trackerEntries ?? [];
      setCompletions(completionsRef.current);
      setItemCompletions(itemCompletionsRef.current);
      setAmountCompletions(amountCompletionsRef.current);
      setTrackerEntries(trackerEntriesRef.current);
      setError("");
    } catch {
      setError("Your routines could not be loaded. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentDate = new Date();
    setToday(currentDate);
    setMonth(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12));
    let splashExitTimer = 0;
    let splashTimer = 0;
    let cancelled = false;
    const initialize = async () => {
      let savedPreferences: unknown = {};
      try {
        if (isNativeApp()) {
          savedPreferences = await loadDevicePreferences() ?? {};
        } else {
          savedPreferences = JSON.parse(window.localStorage.getItem("routineez-preferences") ?? "{}");
        }
      } catch { savedPreferences = {}; }
      if (cancelled) return;
      setPreferences(cleanPreferences(savedPreferences));
      setPreferencesLoaded(true);
      splashTimer = window.setTimeout(() => {
        setSplashLeaving(true);
        splashExitTimer = window.setTimeout(() => setSplashVisible(false), SPLASH_FADE_MS);
      }, SPLASH_DURATION_MS);
      void loadData();
    };
    void initialize();
    return () => {
      cancelled = true;
      window.clearTimeout(splashTimer);
      window.clearTimeout(splashExitTimer);
    };
  }, []);

  function flushDeviceSnapshotSave() {
    const snapshot = pendingDeviceSnapshotRef.current;
    if (!snapshot) return;
    pendingDeviceSnapshotRef.current = null;
    deviceSaveQueueRef.current = deviceSaveQueueRef.current
      .catch(() => undefined)
      .then(() => saveDeviceSnapshot(snapshot))
      .catch(() => setError("Your latest change could not be saved on this device."));
  }

  useEffect(() => {
    if (!isNativeApp() || loading) return;
    pendingDeviceSnapshotRef.current = { version: 1, routines, completions, itemCompletions, amountCompletions, trackerEntries };
    if (deviceSaveTimerRef.current) window.clearTimeout(deviceSaveTimerRef.current);
    deviceSaveTimerRef.current = window.setTimeout(() => {
      deviceSaveTimerRef.current = undefined;
      flushDeviceSnapshotSave();
    }, 180);
    return () => {
      if (deviceSaveTimerRef.current) window.clearTimeout(deviceSaveTimerRef.current);
    };
  }, [routines, completions, itemCompletions, amountCompletions, trackerEntries, loading]);

  useEffect(() => {
    if (!isNativeApp()) return;
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushDeviceSnapshotSave();
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      if (deviceSaveTimerRef.current) window.clearTimeout(deviceSaveTimerRef.current);
      flushDeviceSnapshotSave();
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const darkTheme = preferences.theme === "dark" || (preferences.theme === "system" && systemDark);
  const nativeApp = isNativeApp();

  function selectBottomTab(nextTab: MainTab) {
    if (nextTab === tab) {
      if (bottomNavPhase === "exiting") {
        if (bottomNavSwitchTimerRef.current) window.clearTimeout(bottomNavSwitchTimerRef.current);
        setBottomNavPhase("entering");
        bottomNavSwitchTimerRef.current = window.setTimeout(() => {
          setBottomNavPhase("idle");
          bottomNavSwitchTimerRef.current = undefined;
        }, 390);
      }
      return;
    }
    if (preferences.motion === "reduced") {
      setTab(nextTab);
      return;
    }
    if (bottomNavSwitchTimerRef.current) window.clearTimeout(bottomNavSwitchTimerRef.current);
    setBottomNavPhase("exiting");
    bottomNavSwitchTimerRef.current = window.setTimeout(() => {
      setTab(nextTab);
      setBottomNavPhase("entering");
      bottomNavSwitchTimerRef.current = window.setTimeout(() => {
        setBottomNavPhase("idle");
        bottomNavSwitchTimerRef.current = undefined;
      }, 390);
    }, 215);
  }

  function animateBottomNavReturn() {
    if (bottomNavReturnTimerRef.current) window.clearTimeout(bottomNavReturnTimerRef.current);
    setBottomNavReturning(true);
    bottomNavReturnTimerRef.current = window.setTimeout(() => setBottomNavReturning(false), 620);
  }

  function prepareCreationFlow() {
    if (bottomNavReturnTimerRef.current) window.clearTimeout(bottomNavReturnTimerRef.current);
    if (bottomNavSwitchTimerRef.current) window.clearTimeout(bottomNavSwitchTimerRef.current);
    setBottomNavReturning(false);
    setBottomNavPhase("idle");
  }

  function closeTemplatePicker() {
    setShowTemplatePicker(false);
    animateBottomNavReturn();
  }

  function closeAddRoutine() {
    setShowAdd(false);
    setSelectedTemplate(null);
    animateBottomNavReturn();
  }

  function closeEditRoutine() {
    setEditingRoutineId(null);
    animateBottomNavReturn();
  }

  useEffect(() => {
    if (!preferencesLoaded) return;
    const resolvedDarkTheme = preferences.theme === "dark" || (preferences.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = resolvedDarkTheme ? "dark" : "light";
    document.documentElement.style.colorScheme = resolvedDarkTheme ? "dark" : "light";
  }, [preferences.theme, preferencesLoaded, systemDark]);

  useEffect(() => () => {
    if (bottomNavReturnTimerRef.current) window.clearTimeout(bottomNavReturnTimerRef.current);
    if (bottomNavSwitchTimerRef.current) window.clearTimeout(bottomNavSwitchTimerRef.current);
  }, []);

  function openAddFromHeader() {
    prepareCreationFlow();
    setEditingRoutineId(null);
    setShowAdd(false);
    setShowTemplatePicker(true);
    if (tab !== "routines") startTransition(() => setTab("routines"));
  }

  function openSettings() {
    prepareCreationFlow();
    setShowProfile(false);
    if (tab !== "settings") settingsReturnTabRef.current = tab;
    setTab("settings");
  }

  function closeSettings() {
    setTab(settingsReturnTabRef.current);
    animateBottomNavReturn();
  }

  function openHistoryDayEditor() {
    prepareCreationFlow();
    setHistoryDayEditorOpen(true);
  }

  function closeHistoryDayEditor() {
    setHistoryDayEditorOpen(false);
    animateBottomNavReturn();
  }

  function updatePreferences(next: Partial<AppPreferences>) {
    setPreferences((current) => {
      const updated = { ...current, ...next };
      window.localStorage.setItem("routineez-preferences", JSON.stringify(updated));
      if (isNativeApp()) void saveDevicePreferences(updated);
      return updated;
    });
  }

  function replacePreferences(next: unknown) {
    const updated = cleanPreferences(next);
    setPreferences(updated);
    window.localStorage.setItem("routineez-preferences", JSON.stringify(updated));
    if (isNativeApp()) void saveDevicePreferences(updated);
  }

  const todayRoutines = routines.filter((routine) => routine.days.includes(today.getDay()) && routineActiveOnDate(routine, todayKey));
  const completedToday = new Set(
    completions.filter((item) => item.date === todayKey && item.status === "completed").map((item) => item.routineId),
  );
  const skippedToday = new Set(completions.filter((item) => item.date === todayKey && item.status === "skipped").map((item) => item.routineId));
  const completedItemsToday = new Set(
    itemCompletions.filter((item) => item.date === todayKey).map((item) => item.itemId),
  );
  const amountCount = (routineId: number, amountKey: string, date = todayKey) => amountCompletions.find((item) => item.routineId === routineId && item.amountKey === amountKey && item.date === date)?.count ?? 0;
  const isRoutineDone = (routine: Routine) => {
    if (completedToday.has(routine.id)) return true;
    const tracking = routineTrackingForDay(routine, today.getDay());
    const checklistDone = !usesChecklist(tracking.mode) || (tracking.items.length > 0 && tracking.items.every((item) => completedItemsToday.has(item.id)));
    const quantityDone = !usesQuantity(tracking.mode) || (tracking.amounts.length > 0 && tracking.amounts.every((amount) => trackerIsComplete(amount, amountCount(routine.id, amount.key))));
    return tracking.mode === "simple" ? completedToday.has(routine.id) : checklistDone && quantityDone;
  };
  const visibleTodayRoutines = preferences.completedVisibility === "hide" ? todayRoutines.filter((routine) => skippedToday.has(routine.id) || !isRoutineDone(routine)) : todayRoutines;
  const eligibleTodayRoutines = todayRoutines.filter((routine) => !skippedToday.has(routine.id));
  const doneCount = eligibleTodayRoutines.filter(isRoutineDone).length;
  const progress = eligibleTodayRoutines.length ? Math.round((doneCount / eligibleTodayRoutines.length) * 100) : 0;
  const animatedProgress = useAnimatedNumber(progress, preferences.motion === "reduced" ? 0 : 600);

  useEffect(() => {
    if (preferences.reminders !== "on" || !("Notification" in window) || Notification.permission !== "granted") return;
    const checkReminders = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const storageKey = `routineez-reminders-${todayKey}`;
      let notified: string[] = [];
      try { notified = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]"); } catch { notified = []; }
      const notifiedIds = new Set(notified);
      for (const routine of todayRoutines) {
        const key = String(routine.id);
        if (!routine.time || routine.time > currentTime || notifiedIds.has(key) || skippedToday.has(routine.id) || isRoutineDone(routine)) continue;
        new Notification(`Time for ${routine.name}`, { body: `${routine.emoji} Open Routine EASY to check it off.`, icon: "/routineez-checklist.png", tag: `routine-${routine.id}-${todayKey}` });
        notifiedIds.add(key);
      }
      window.localStorage.setItem(storageKey, JSON.stringify([...notifiedIds]));
    };
    checkReminders();
    const timer = window.setInterval(checkReminders, 30_000);
    return () => window.clearInterval(timer);
  }, [preferences.reminders, routines, completions, itemCompletions, amountCompletions, todayKey]);

  function playCompletionFeedback() {
    if (preferences.feedback !== "on") return;
    navigator.vibrate?.(14);
    try {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.setValueAtTime(620, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(820, context.currentTime + .08);
      gain.gain.setValueAtTime(.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .11);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .11);
      oscillator.addEventListener("ended", () => void context.close(), { once: true });
    } catch { /* Feedback is optional when a browser blocks audio. */ }
  }

  useEffect(() => {
    if (!showProfile) return;
    const closeProfile = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowProfile(false);
    };
    window.addEventListener("keydown", closeProfile);
    return () => window.removeEventListener("keydown", closeProfile);
  }, [showProfile]);

  async function toggleRoutine(routineId: number, date = todayKey) {
    const routine = routines.find((item) => item.id === routineId);
    const wasSkipped = completionsRef.current.some((item) => item.routineId === routineId && item.date === date && item.status === "skipped");
    const manuallyCompleted = completionsRef.current.some((item) => item.routineId === routineId && item.date === date && item.status === "completed");
    if (wasSkipped) void setRoutineSkip(routineId, false, date);
    const tracking = routine ? routineTrackingForDate(routine, date) : null;
    if (routine && tracking && tracking.mode !== "simple") {
      const checklistDone = !usesChecklist(tracking.mode) || (tracking.items.length > 0 && tracking.items.every((item) => itemCompletionsRef.current.some((completion) => completion.itemId === item.id && completion.date === date)));
      const quantityDone = !usesQuantity(tracking.mode) || (tracking.amounts.length > 0 && tracking.amounts.every((amount) => trackerIsComplete(amount, amountCompletionsRef.current.find((item) => item.routineId === routineId && item.amountKey === amount.key && item.date === date)?.count ?? 0)));
      if (tracking.amounts.some((amount) => trackerKind(amount) === "note" || trackerKind(amount) === "photo")) {
        if (manuallyCompleted || (checklistDone && quantityDone)) {
          await setRoutineCompletionStatus(routineId, null, date);
          await clearRoutineTracking(routine, date);
        } else {
          if (date === todayKey) playCompletionFeedback();
          await setRoutineCompletionStatus(routineId, "completed", date);
        }
        return;
      }
      const completeEverything = wasSkipped || !(checklistDone && quantityDone);
      if (completeEverything && date === todayKey) playCompletionFeedback();
      await Promise.all([
        usesChecklist(tracking.mode) && tracking.items.length ? setChecklistCompletion(routine, completeEverything, date) : Promise.resolve(),
        ...(usesQuantity(tracking.mode) ? tracking.amounts.map((amount) => setAmount(routineId, amount, completeEverything ? trackerCompletionValue(amount) : 0, date, true, false)) : []),
      ]);
      return;
    }
    const currentlyDone = completionsRef.current.some((item) => item.routineId === routineId && item.date === date && item.status === "completed");
    if (!currentlyDone && date === todayKey) playCompletionFeedback();
    updateCompletions((items) =>
      currentlyDone
        ? items.filter((item) => !(item.routineId === routineId && item.date === date))
        : [...items.filter((item) => !(item.routineId === routineId && item.date === date)), { routineId, date, status: "completed" }],
    );
    await queueRoutineMutation(routineId, () => fetch("/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routineId, date, completed: !currentlyDone }),
    }));
  }

  async function setRoutineSkip(routineId: number, skipped: boolean, date = todayKey) {
    await setRoutineCompletionStatus(routineId, skipped ? "skipped" : null, date);
  }

  async function setRoutineCompletionStatus(routineId: number, status: Completion["status"] | null, date: string) {
    updateCompletions((items) => status
      ? [...items.filter((item) => !(item.routineId === routineId && item.date === date)), { routineId, date, status }]
      : items.filter((item) => !(item.routineId === routineId && item.date === date)),
    );
    await queueRoutineMutation(routineId, () => fetch("/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routineId, date, status }),
    }));
  }

  async function setChecklistCompletion(routine: Routine, completed: boolean, date = todayKey) {
    const routineItemIds = new Set(routine.items.map((item) => item.id));
    updateItemCompletions((items) => completed
      ? [...items.filter((item) => item.date !== date || !routineItemIds.has(item.itemId)), ...routine.items.map((item) => ({ itemId: item.id, date }))]
      : items.filter((item) => item.date !== date || !routineItemIds.has(item.itemId)),
    );
    await queueRoutineMutation(routine.id, () => fetch("/api/item-completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routineId: routine.id, date, completed }),
    }));
  }

  async function setAmount(routineId: number, amount: RoutineAmount, count: number, date = todayKey, clearSkipped = true, giveFeedback = true) {
    const routine = routines.find((item) => item.id === routineId);
    if (!routine || !usesQuantity(routine.trackingMode)) return;
    if (clearSkipped && completionsRef.current.some((item) => item.routineId === routineId && item.date === date && item.status === "skipped")) void setRoutineSkip(routineId, false, date);
    const kind = trackerKind(amount);
    if (kind === "note" || kind === "photo") return;
    const maximum = trackerMaximumValue(amount);
    const safeCount = Math.min(maximum, Math.max(0, Math.round(count)));
    const previousCount = amountCompletionsRef.current.find((item) => item.routineId === routineId && item.amountKey === amount.key && item.date === date)?.count ?? 0;
    if (giveFeedback && safeCount > previousCount && date === todayKey && (kind === "amount" || kind === "rating" || kind === "avoidance")) playCompletionFeedback();
    updateAmountCompletions((items) => safeCount === 0
      ? items.filter((item) => !(item.routineId === routineId && item.amountKey === amount.key && item.date === date))
      : [...items.filter((item) => !(item.routineId === routineId && item.amountKey === amount.key && item.date === date)), { routineId, amountKey: amount.key, date, count: safeCount }],
    );
    await queueRoutineMutation(routineId, () => fetch("/api/quantity-completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routineId, amountKey: amount.key, date, count: safeCount }),
    }));
  }

  async function setNoteEntry(routineId: number, tracker: RoutineAmount, value: string, date = todayKey) {
    const rawValue = value.slice(0, 2000);
    const cleanValue = rawValue.trim() ? rawValue : "";
    updateTrackerEntries((items) => cleanValue
      ? [...items.filter((item) => !(item.routineId === routineId && item.trackerKey === tracker.key && item.date === date)), { routineId, trackerKey: tracker.key, date, value: cleanValue, hasFile: false }]
      : items.filter((item) => !(item.routineId === routineId && item.trackerKey === tracker.key && item.date === date)),
    );
    updateAmountCompletions((items) => cleanValue
      ? [...items.filter((item) => !(item.routineId === routineId && item.amountKey === tracker.key && item.date === date)), { routineId, amountKey: tracker.key, date, count: 1 }]
      : items.filter((item) => !(item.routineId === routineId && item.amountKey === tracker.key && item.date === date)),
    );
    await queueRoutineMutation(routineId, () => fetch("/api/tracker-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routineId, trackerKey: tracker.key, date, value: cleanValue }),
    }));
  }

  async function uploadTrackerPhoto(routineId: number, tracker: RoutineAmount, file: File, date = todayKey) {
    const version = String(Date.now());
    if (isNativeApp()) {
      const previous = trackerEntriesRef.current.find((item) => item.routineId === routineId && item.trackerKey === tracker.key && item.date === date);
      const saved = await saveDevicePhoto(routineId, tracker.key, date, file);
      await removeDevicePhoto(previous?.filePath);
      updateTrackerEntries((items) => [...items.filter((item) => !(item.routineId === routineId && item.trackerKey === tracker.key && item.date === date)), { routineId, trackerKey: tracker.key, date, value: version, hasFile: true, filePath: saved.path, contentType: saved.contentType }]);
      updateAmountCompletions((items) => [...items.filter((item) => !(item.routineId === routineId && item.amountKey === tracker.key && item.date === date)), { routineId, amountKey: tracker.key, date, count: 1 }]);
      return;
    }
    updateTrackerEntries((items) => [...items.filter((item) => !(item.routineId === routineId && item.trackerKey === tracker.key && item.date === date)), { routineId, trackerKey: tracker.key, date, value: version, hasFile: true }]);
    updateAmountCompletions((items) => [...items.filter((item) => !(item.routineId === routineId && item.amountKey === tracker.key && item.date === date)), { routineId, amountKey: tracker.key, date, count: 1 }]);
    const form = new FormData();
    form.set("routineId", String(routineId));
    form.set("trackerKey", tracker.key);
    form.set("date", date);
    form.set("photo", file);
    await queueRoutineMutation(routineId, () => fetch("/api/tracker-photo", { method: "POST", body: form }));
  }

  async function removeTrackerPhoto(routineId: number, tracker: RoutineAmount, date = todayKey) {
    const previous = trackerEntriesRef.current.find((item) => item.routineId === routineId && item.trackerKey === tracker.key && item.date === date);
    updateTrackerEntries((items) => items.filter((item) => !(item.routineId === routineId && item.trackerKey === tracker.key && item.date === date)));
    updateAmountCompletions((items) => items.filter((item) => !(item.routineId === routineId && item.amountKey === tracker.key && item.date === date)));
    if (isNativeApp()) {
      await removeDevicePhoto(previous?.filePath);
      return;
    }
    const query = new URLSearchParams({ routineId: String(routineId), trackerKey: tracker.key, date });
    await queueRoutineMutation(routineId, () => fetch(`/api/tracker-photo?${query}`, { method: "DELETE" }));
  }

  async function clearRoutineTracking(routine: Routine, date: string) {
    const tracking = routineTrackingForDate(routine, date);
    await Promise.all([
      usesChecklist(tracking.mode) && tracking.items.length ? setChecklistCompletion(routine, false, date) : Promise.resolve(),
      ...(usesQuantity(tracking.mode) ? tracking.amounts.map((amount) => trackerKind(amount) === "note"
        ? setNoteEntry(routine.id, amount, "", date)
        : trackerKind(amount) === "photo"
          ? removeTrackerPhoto(routine.id, amount, date)
          : setAmount(routine.id, amount, 0, date, false)) : []),
    ]);
  }

  async function undoRoutineSkip(routine: Routine, date = todayKey) {
    await setRoutineSkip(routine.id, false, date);
    await clearRoutineTracking(routine, date);
  }

  async function setHistoryDayStatus(routine: Routine, date: string, status: EditableHistoryStatus) {
    if (status === "completed" || routineTrackingForDate(routine, date).mode === "simple") {
      await setRoutineCompletionStatus(routine.id, status === "missed" ? null : status, date);
      return;
    }

    await setRoutineCompletionStatus(routine.id, null, date);
    await clearRoutineTracking(routine, date);
    if (status === "skipped") await setRoutineCompletionStatus(routine.id, "skipped", date);
  }

  function prepareHistoryDetailEdit(routineId: number, date: string) {
    if (completionsRef.current.some((item) => item.routineId === routineId && item.date === date)) {
      void setRoutineCompletionStatus(routineId, null, date);
    }
  }

  async function editHistoryItem(routine: Routine, itemId: number, date: string) {
    prepareHistoryDetailEdit(routine.id, date);
    await toggleItem(itemId, date);
  }

  async function editHistoryAmount(routine: Routine, tracker: RoutineAmount, count: number, date: string) {
    prepareHistoryDetailEdit(routine.id, date);
    await setAmount(routine.id, tracker, count, date, false);
  }

  async function editHistoryNote(routine: Routine, tracker: RoutineAmount, value: string, date: string) {
    prepareHistoryDetailEdit(routine.id, date);
    await setNoteEntry(routine.id, tracker, value, date);
  }

  async function editHistoryPhoto(routine: Routine, tracker: RoutineAmount, file: File, date: string) {
    prepareHistoryDetailEdit(routine.id, date);
    await uploadTrackerPhoto(routine.id, tracker, file, date);
  }

  async function removeHistoryPhoto(routine: Routine, tracker: RoutineAmount, date: string) {
    prepareHistoryDetailEdit(routine.id, date);
    await removeTrackerPhoto(routine.id, tracker, date);
  }

  async function toggleItem(itemId: number, date = todayKey) {
    const routine = routines.find((candidate) => candidate.items.some((item) => item.id === itemId));
    if (routine && completionsRef.current.some((item) => item.routineId === routine.id && item.date === date && item.status === "skipped")) void setRoutineSkip(routine.id, false, date);
    const currentlyDone = itemCompletionsRef.current.some((item) => item.itemId === itemId && item.date === date);
    if (!currentlyDone && date === todayKey) playCompletionFeedback();
    updateItemCompletions((items) => currentlyDone
      ? items.filter((item) => !(item.itemId === itemId && item.date === date))
      : [...items, { itemId, date }],
    );
    await queueRoutineMutation(routine?.id ?? -itemId, () => fetch("/api/item-completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, date, completed: !currentlyDone }),
    }));
  }

  async function addRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const trackingMode = String(form.get("trackingMode") ?? "simple") as TrackingMode;
    const days = DAY_NAMES.map((_, index) => index).filter((index) => form.get(`day-${index}`));
    if (!days.length) {
      setError("Choose at least one day for your routine.");
      return;
    }
    setSaving(true);
    if (isNativeApp()) {
      const id = Math.max(0, ...routines.map((routine) => routine.id)) + 1;
      const nextItemId = Math.max(0, ...routines.flatMap((routine) => routine.items.map((item) => item.id))) + 1;
      setRoutines((items) => [...items, routineFromForm(form, id, undefined, nextItemId)]);
      setShowAdd(false);
      setSelectedTemplate(null);
      animateBottomNavReturn();
      setError("");
      setSaving(false);
      return;
    }
    const response = await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        emoji: form.get("emoji"),
        color: form.get("color"),
        time: form.get("time"),
        days,
        trackingMode,
        amounts: JSON.parse(String(form.get("amounts") ?? "[]")),
        lists: readTrackingLists(form),
        dayVariants: readDayVariants(form),
        startDate: form.get("startDate"),
        endDate: form.get("endDate"),
      }),
    });
    if (response.ok) {
      const data = await response.json();
      setRoutines((items) => [...items, data.routine]);
      setShowAdd(false);
      setSelectedTemplate(null);
      animateBottomNavReturn();
      setError("");
    } else {
      setError("That routine could not be added. Please try again.");
    }
    setSaving(false);
  }

  function duplicateRoutine(routine: Routine) {
    prepareCreationFlow();
    setEditingRoutineId(null);
    setSelectedTemplate({
      id: `duplicate-${routine.id}`,
      name: `${routine.name} copy`,
      description: `A copy of ${routine.name}`,
      emoji: routine.emoji,
      color: routine.color,
      time: routine.time,
      days: [...routine.days],
      amounts: routine.amounts.map((amount) => ({ ...amount })),
      lists: routine.lists.map((list) => ({
        ...list,
        items: routine.items.filter((item) => item.listKey === list.key).map((item) => item.title).join("\n"),
      })),
      dayVariants: { ...routine.dayVariants },
      startDate: routine.startDate,
      endDate: routine.endDate,
    });
    setShowTemplatePicker(false);
    setShowAdd(true);
  }

  async function deleteRoutine(id: number) {
    setDeleting(true);
    const itemIds = new Set(routines.find((routine) => routine.id === id)?.items.map((item) => item.id) ?? []);
    const removedPhotos = trackerEntriesRef.current.filter((item) => item.routineId === id).map((item) => item.filePath);
    setRoutines((items) => items.filter((routine) => routine.id !== id));
    updateCompletions((items) => items.filter((item) => item.routineId !== id));
    updateItemCompletions((items) => items.filter((item) => !itemIds.has(item.itemId)));
    updateAmountCompletions((items) => items.filter((item) => item.routineId !== id));
    updateTrackerEntries((items) => items.filter((item) => item.routineId !== id));
    if (isNativeApp()) {
      await Promise.all(removedPhotos.map((path) => removeDevicePhoto(path)));
      setError("");
      setDeleting(false);
      setRoutineToDelete(null);
      return;
    }
    try {
      const response = await fetch(`/api/routines?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      setError("");
    } catch {
      setError("That routine could not be deleted. Please try again.");
      await loadData();
    } finally {
      setDeleting(false);
      setRoutineToDelete(null);
    }
  }

  async function saveRoutineOptions(event: FormEvent<HTMLFormElement>, routine: Routine) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const trackingMode = String(form.get("trackingMode") ?? "simple") as TrackingMode;
    const days = DAY_NAMES.map((_, index) => index).filter((index) => form.get(`day-${index}`));
    if (!days.length) {
      setError("Choose at least one day for your routine.");
      return;
    }
    setSavingList(true);
    if (isNativeApp()) {
      const nextItemId = Math.max(0, ...routines.flatMap((item) => item.items.map((entry) => entry.id))) + 1;
      const updated = routineFromForm(form, routine.id, routine, nextItemId);
      const nextItemIds = new Set(updated.items.map((item) => item.id));
      const removedItemIds = new Set(routine.items.filter((item) => !nextItemIds.has(item.id)).map((item) => item.id));
      setRoutines((items) => items.map((item) => item.id === routine.id ? updated : item));
      updateItemCompletions((items) => items.filter((item) => !removedItemIds.has(item.itemId)));
      setEditingRoutineId(null);
      animateBottomNavReturn();
      setError("");
      setSavingList(false);
      return;
    }
    const response = await fetch("/api/routines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: routine.id,
        name: form.get("name"),
        emoji: form.get("emoji"),
        color: form.get("color"),
        time: form.get("time"),
        days,
        trackingMode,
        amounts: JSON.parse(String(form.get("amounts") ?? "[]")),
        lists: readTrackingLists(form),
        dayVariants: readDayVariants(form),
        startDate: form.get("startDate"),
        endDate: form.get("endDate"),
      }),
    });
    if (response.ok) {
      await loadData();
      setEditingRoutineId(null);
      animateBottomNavReturn();
      setError("");
    } else {
      setError("That routine could not be saved. Please try again.");
    }
    setSavingList(false);
  }

  const monthDays = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const weekStartIndex = preferences.weekStartsOn === "monday" ? 1 : 0;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells: Array<Date | null> = Array((firstWeekday - weekStartIndex + 7) % 7).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, monthIndex, day));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [month, preferences.weekStartsOn]);
  const viewingCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const calendarDayNames = preferences.weekStartsOn === "monday" ? [...DAY_NAMES.slice(1), DAY_NAMES[0]] : DAY_NAMES;
  const selectedCalendarRoutine = selectedRoutine === "all" ? undefined : routines.find((routine) => routine.id === selectedRoutine);
  const calendarEntries = useMemo(() => monthDays.map((date) => date ? {
    date,
    matches: routines.filter((routine) => routine.days.includes(date.getDay()) && routineActiveOnDate(routine, localDateKey(date)) && (selectedRoutine === "all" || selectedRoutine === routine.id)),
  } : null), [monthDays, routines, selectedRoutine]);
  const { calendarScheduledDays, calendarRoutineCount } = useMemo(() => ({
    calendarScheduledDays: calendarEntries.filter((entry) => entry && entry.matches.length > 0).length,
    calendarRoutineCount: new Set(calendarEntries.flatMap((entry) => entry?.matches.map((routine) => routine.id) ?? [])).size,
  }), [calendarEntries]);

  const splashOverlay = splashVisible ? <OnboardingSplash leaving={splashLeaving} /> : null;

  return (
    <><main className={`app-shell${nativeApp ? " native-app" : ""}${preferences.motion === "reduced" ? " reduce-motion" : ""}${darkTheme ? " theme-dark" : ""}${tab === "settings" ? " settings-view-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand" aria-label="Routine EASY home">
          <img className="brand-logo" src="/routineez-checklist-glossy.png" alt="" />
          <span>Routine<EasyWord className="brand-easy" /></span>
        </div>
        <p className="sidebar-date">{today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        <nav className="side-nav" aria-label="Main navigation">
          <NavButton active={tab === "today"} onClick={() => setTab("today")} icon={CircleCheckBig} label="Today" />
          <NavButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={CalendarDays} label="Calendar" />
          <NavButton active={tab === "routines"} onClick={() => setTab("routines")} icon={ListChecks} label="Routines" />
          <NavButton active={tab === "history"} onClick={() => setTab("history")} icon={History} label="History" />
          <NavButton active={tab === "settings"} onClick={openSettings} icon={Settings2} label="Settings" />
        </nav>
      </aside>

      <section className="content">
        <BlobCorners className="app-background-blobs" />
        <header className="mobile-header">
          <button className={`mobile-profile${showProfile ? " active" : ""}`} onClick={() => setShowProfile((visible) => !visible)} aria-label="Open profile" aria-expanded={showProfile}><CircleUserRound aria-hidden="true" /></button>
          <div className="mobile-wordmark" aria-label="Routine EASY">
            <img src="/routineez-checklist-glossy.png" alt="" />
            <span className="mobile-wordmark-name">Routine<EasyWord className="mobile-wordmark-easy" /></span>
          </div>
          <button className="mobile-add premium-action" onClick={openAddFromHeader} aria-label="Add routine"><span aria-hidden="true">+</span></button>
        </header>

        {showProfile && <div className="profile-popover-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowProfile(false); }}>
          <section className="profile-card" role="dialog" aria-label="Your Routine EASY profile">
            <button className="profile-close" onClick={() => setShowProfile(false)} aria-label="Close profile"><X aria-hidden="true" /></button>
            <div className="profile-avatar"><CircleUserRound aria-hidden="true" /></div>
            <div className="profile-copy"><small>Your profile</small><h2>My Routine<EasyWord className="brand-easy" /></h2><p>Small routines. Easier days.</p></div>
            <div className="profile-stats"><div><i><ListChecks aria-hidden="true" /></i><span><strong>{routines.length}</strong><small>Routines</small></span></div><div><i><CircleCheckBig aria-hidden="true" /></i><span><strong>{doneCount}/{eligibleTodayRoutines.length}</strong><small>Done today</small></span></div></div>
            <div className="profile-actions">
              <button className="profile-settings-button" onClick={openSettings}><Settings2 aria-hidden="true" />Settings</button>
              <button className="profile-routines-button" onClick={() => { setTab("routines"); setShowProfile(false); }}><ListChecks aria-hidden="true" />Manage routines</button>
            </div>
          </section>
        </div>}

        {routineToDelete && <DeleteRoutineDialog routine={routineToDelete} deleting={deleting} onCancel={() => setRoutineToDelete(null)} onConfirm={() => deleteRoutine(routineToDelete.id)} />}
        {showTemplatePicker && <TemplateChooser onCancel={closeTemplatePicker} onChoose={(template) => { setSelectedTemplate(template); setShowTemplatePicker(false); setShowAdd(true); }} />}

        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}

        {tab === "today" && (
          <div className="page today-page">
            <section className="progress-card">
              <div className="progress-copy">
                <span className="progress-icon">✦</span>
                <div><strong>{progress === 100 && eligibleTodayRoutines.length ? "Beautiful work!" : progress > 50 ? "You’re on a roll!" : "Let’s make a start"}</strong><p>{doneCount} of {eligibleTodayRoutines.length} routines complete{skippedToday.size ? ` · ${skippedToday.size} skipped` : ""}</p></div>
              </div>
              <div className="progress-number" aria-label={`${progress}% complete`}><span aria-hidden="true">{animatedProgress}%</span></div>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            </section>

            <section className="routine-section">
              <div className="routine-list">
                {loading ? <LoadingRows /> : visibleTodayRoutines.length ? visibleTodayRoutines.map((routine) => (
                  <RoutineRow
                    key={routine.id}
                    routine={routine}
                    completed={!skippedToday.has(routine.id) && isRoutineDone(routine)}
                    skipped={skippedToday.has(routine.id)}
                    completedItemIds={completedItemsToday}
                    amountCounts={Object.fromEntries(routine.amounts.map((amount) => [amount.key, amountCount(routine.id, amount.key)]))}
                    trackerEntries={Object.fromEntries(trackerEntries.filter((entry) => entry.routineId === routine.id && entry.date === todayKey).map((entry) => [entry.trackerKey, entry]))}
                    onToggle={() => toggleRoutine(routine.id)}
                    onToggleItem={toggleItem}
                    onSetAmount={(amount, count) => setAmount(routine.id, amount, count)}
                    onSetNote={(tracker, value) => setNoteEntry(routine.id, tracker, value)}
                    onUploadPhoto={(tracker, file) => uploadTrackerPhoto(routine.id, tracker, file)}
                    onRemovePhoto={(tracker) => removeTrackerPhoto(routine.id, tracker)}
                    onSkip={(nextSkipped) => nextSkipped ? setRoutineSkip(routine.id, true) : undoRoutineSkip(routine)}
                    timeFormat={preferences.timeFormat}
                  />
                )) : todayRoutines.length ? <div className="completed-hidden-state"><CircleCheckBig aria-hidden="true" /><strong>Everything completed is hidden</strong><p>You can bring finished routines back whenever you want.</p><button type="button" onClick={() => updatePreferences({ completedVisibility: "show" })}>Show completed routines</button></div> : <EmptyToday onAdd={() => { setTab("routines"); setShowTemplatePicker(true); }} />}
              </div>
            </section>
          </div>
        )}

        {tab === "calendar" && (
          <div className="page calendar-page calendar-page-matched">
            <ScrollablePicker label="Calendar routine filters" className="calendar-filter-picker" scrollClassName="filter-pills">
              <button className={selectedRoutine === "all" ? "active" : ""} aria-pressed={selectedRoutine === "all"} onClick={() => setSelectedRoutine("all")}>All routines</button>
              {routines.map((routine) => <button key={routine.id} className={selectedRoutine === routine.id ? "active" : ""} aria-pressed={selectedRoutine === routine.id} style={{ "--pill": routine.color } as React.CSSProperties} onClick={() => setSelectedRoutine(routine.id)}><span>{routine.emoji}</span>{routine.name}</button>)}
            </ScrollablePicker>
            <section className="calendar-detail-card" style={{ "--history-color": selectedCalendarRoutine?.color ?? "var(--sky)" } as React.CSSProperties}>
              <header className="calendar-detail-heading"><div className="history-title-row"><span className="history-emoji calendar-heading-icon">{selectedCalendarRoutine ? selectedCalendarRoutine.emoji : <CalendarDays aria-hidden="true" />}</span><h2>{selectedCalendarRoutine?.name ?? "All routines"}</h2></div></header>
              <div className="history-month-toolbar calendar-detail-toolbar">
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft aria-hidden="true" /></button>
                <div className="calendar-month-heading">
                  <h3>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
                  {!viewingCurrentMonth && <button className="calendar-today-button" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>}
                </div>
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight aria-hidden="true" /></button>
              </div>
              <div className="history-stats calendar-summary-stats"><div><strong>{calendarScheduledDays}</strong><span>Days scheduled</span></div><div><strong>{calendarRoutineCount}</strong><span>Routines shown</span></div></div>
              <div className="history-month-calendar calendar-month-view">
                <div className="history-weekday-row">{calendarDayNames.map((day) => <span key={day}>{day}</span>)}</div>
                <div className="history-grid calendar-grid">
                {calendarEntries.map((entry, index) => {
                  if (!entry) return <i className="history-day-spacer" key={`blank-${index}`} />;
                  const { date, matches } = entry;
                  const key = localDateKey(date);
                  const isToday = key === todayKey;
                  return <div className={`history-day calendar-day ${isToday ? "is-today" : ""} ${matches.length ? "has-routines" : ""}`} style={matches.length ? { "--calendar-day-accent": matches[0].color } as React.CSSProperties : undefined} key={key} aria-current={isToday ? "date" : undefined} aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${matches.length ? `: ${matches.map((routine) => routine.name).join(", ")}` : ""}`}>
                    {matches.length > 0 && <div className="day-fill" style={{ gridTemplateColumns: `repeat(${matches.length}, minmax(0, 1fr))` }} aria-hidden="true">{matches.map((routine) => <span key={routine.id} style={{ background: routine.color }} />)}</div>}
                    <span className="day-number">{date.getDate()}</span>
                  </div>;
                })}
                </div>
              </div>
              <div className="calendar-legend">Colored bars show the routines scheduled for each day.</div>
            </section>
          </div>
        )}

        {tab === "routines" && (
          <div className="page routines-page">
            {showAdd && <AddRoutineForm key={selectedTemplate?.id ?? "blank"} template={selectedTemplate} onSubmit={addRoutine} onCancel={closeAddRoutine} saving={saving} usedEmojis={routines.map((routine) => routine.emoji)} usedColors={routines.map((routine) => routine.color)} />}
            {editingRoutineId !== null && (() => {
              const routine = routines.find((item) => item.id === editingRoutineId);
              return routine ? <RoutineOptionsEditor routine={routine} onSubmit={(event) => saveRoutineOptions(event, routine)} onCancel={closeEditRoutine} saving={savingList} usedEmojis={routines.filter((item) => item.id !== routine.id).map((item) => item.emoji)} usedColors={routines.filter((item) => item.id !== routine.id).map((item) => item.color)} /> : null;
            })()}
            <section className={`routine-library${!loading && !routines.length ? " routine-library-empty" : ""}`}>
              {(loading || routines.length > 0) && <div className="section-title"><h2>Your routines</h2><div className="section-title-actions"><span>{routines.length} total</span><button className="desktop-routine-add premium-action" onClick={() => { prepareCreationFlow(); setEditingRoutineId(null); setShowTemplatePicker(true); }}>+ Add routine</button></div></div>}
              <div className="routine-grid">
                {loading ? <LoadingRows /> : routines.length ? routines.map((routine) => <RoutineCard key={routine.id} routine={routine} timeFormat={preferences.timeFormat} onEditOptions={() => { prepareCreationFlow(); setShowAdd(false); setEditingRoutineId(routine.id); }} onDuplicate={() => duplicateRoutine(routine)} onHistory={() => { setSelectedHistoryRoutine(routine.id); setTab("history"); }} onDelete={() => setRoutineToDelete(routine)} />) : <section className="routines-empty"><span className="empty-state-icon routines-empty-icon" aria-hidden="true"><ListChecks /></span><h3>Your routines start here</h3><p>Create one small routine and build from there.</p><button className="primary-button premium-action" onClick={openAddFromHeader}>Add your first routine</button></section>}
              </div>
            </section>
          </div>
        )}

        {tab === "history" && <HistoryPage routines={routines} selectedRoutine={selectedHistoryRoutine} onSelectRoutine={setSelectedHistoryRoutine} onAddRoutine={openAddFromHeader} onOpenDayEditor={openHistoryDayEditor} onCloseDayEditor={closeHistoryDayEditor} onSetDayStatus={setHistoryDayStatus} onToggleItem={editHistoryItem} onSetAmount={editHistoryAmount} onSetNote={editHistoryNote} onUploadPhoto={editHistoryPhoto} onRemovePhoto={removeHistoryPhoto} completions={completions} itemCompletions={itemCompletions} amountCompletions={amountCompletions} trackerEntries={trackerEntries} todayKey={todayKey} weekStartsOn={preferences.weekStartsOn} loading={loading} />}

        {tab === "settings" && <SettingsPage preferences={preferences} onChange={updatePreferences} onReplacePreferences={replacePreferences} onRefreshData={loadData} onBack={closeSettings} />}
      </section>

      <nav className={`bottom-nav nav-${bottomNavPhase}${showTemplatePicker || showAdd || editingRoutineId !== null || historyDayEditorOpen || tab === "settings" ? " creation-flow-hidden" : bottomNavReturning ? " creation-flow-returning" : ""}`} aria-label="Main navigation">
        <BottomNavSurface
          key={`${tab}-${bottomNavPhase === "exiting" ? "closing" : "opening"}`}
          tab={tab}
          phase={bottomNavPhase}
          reducedMotion={preferences.motion === "reduced"}
        />
        <NavButton active={tab === "today"} onClick={() => selectBottomTab("today")} icon={CircleCheckBig} label="Today" />
        <CalendarNavButton active={tab === "calendar"} onClick={() => selectBottomTab("calendar")} date={today} />
        <NavButton active={tab === "routines"} onClick={() => selectBottomTab("routines")} icon={ListChecks} label="Routines" />
        <NavButton active={tab === "history"} onClick={() => selectBottomTab("history")} icon={History} label="History" />
      </nav>
    </main>{splashOverlay}</>
  );
}

type HistoryDayState = { date: Date; key: string; status: "completed" | "partial" | "skipped" | "missed" | "scheduled" | "off" };
type EditableHistoryStatus = "completed" | "skipped" | "missed";

function buildRoutineHistory(routine: Routine, completions: Completion[], itemCompletions: ItemCompletion[], amountCompletions: AmountCompletion[], todayKey: string, month: Date): HistoryDayState[] {
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth(), index + 1, 12);
    const key = localDateKey(date);
    const saved = completions.find((item) => item.routineId === routine.id && item.date === key)?.status;
    if (saved === "skipped") return { date, key, status: "skipped" };
    const scheduled = routine.days.includes(date.getDay()) && routineActiveOnDate(routine, key);
    if (!scheduled) return { date, key, status: "off" };
    if (saved === "completed") return { date, key, status: "completed" };
    const tracking = routineTrackingForDay(routine, date.getDay());
    const itemIds = new Set(tracking.items.map((item) => item.id));
    const amountKeys = new Set(tracking.amounts.map((amount) => amount.key));
    const checkedItems = itemCompletions.filter((item) => item.date === key && itemIds.has(item.itemId)).length;
    const amounts = amountCompletions.filter((item) => item.routineId === routine.id && item.date === key && amountKeys.has(item.amountKey));
    const checklistDone = !usesChecklist(tracking.mode) || (tracking.items.length > 0 && checkedItems === tracking.items.length);
    const amountDone = !usesQuantity(tracking.mode) || (tracking.amounts.length > 0 && tracking.amounts.every((amount) => trackerIsComplete(amount, amounts.find((item) => item.amountKey === amount.key)?.count ?? 0)));
    const completed = tracking.mode === "simple" ? saved === "completed" : checklistDone && amountDone;
    if (completed) return { date, key, status: "completed" };
    if (checkedItems > 0 || amounts.some((item) => item.count > 0)) return { date, key, status: "partial" };
    return { date, key, status: key < todayKey ? "missed" : "scheduled" };
  });
}

function historyRate(states: HistoryDayState[], count: number) {
  const eligible = states.slice(-count).filter((day) => day.status !== "off" && day.status !== "skipped" && day.status !== "scheduled");
  return eligible.length ? Math.round((eligible.filter((day) => day.status === "completed").length / eligible.length) * 100) : 0;
}

function HistoryPage({ routines, selectedRoutine, onSelectRoutine, onAddRoutine, onOpenDayEditor, onCloseDayEditor, onSetDayStatus, onToggleItem, onSetAmount, onSetNote, onUploadPhoto, onRemovePhoto, completions, itemCompletions, amountCompletions, trackerEntries, todayKey, weekStartsOn, loading }: { routines: Routine[]; selectedRoutine: number | "all"; onSelectRoutine: (routine: number | "all") => void; onAddRoutine: () => void; onOpenDayEditor: () => void; onCloseDayEditor: () => void; onSetDayStatus: (routine: Routine, date: string, status: EditableHistoryStatus) => Promise<void>; onToggleItem: (routine: Routine, itemId: number, date: string) => Promise<void>; onSetAmount: (routine: Routine, tracker: RoutineAmount, count: number, date: string) => Promise<void>; onSetNote: (routine: Routine, tracker: RoutineAmount, value: string, date: string) => Promise<void>; onUploadPhoto: (routine: Routine, tracker: RoutineAmount, file: File, date: string) => Promise<void>; onRemovePhoto: (routine: Routine, tracker: RoutineAmount, date: string) => Promise<void>; completions: Completion[]; itemCompletions: ItemCompletion[]; amountCompletions: AmountCompletion[]; trackerEntries: TrackerEntry[]; todayKey: string; weekStartsOn: WeekStart; loading: boolean }) {
  const selected = selectedRoutine === "all" ? undefined : routines.find((routine) => routine.id === selectedRoutine);
  const effectiveSelection = selected ? selected.id : "all";
  const [editingDay, setEditingDay] = useState<HistoryDayState | null>(null);
  const todayDate = new Date(`${todayKey}T12:00:00`);
  const [historyMonth, setHistoryMonth] = useState(() => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const currentMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const viewingCurrentMonth = historyMonth.getFullYear() === currentMonth.getFullYear() && historyMonth.getMonth() === currentMonth.getMonth();
  const historyMonthLabel = historyMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const historyDayNames = weekStartsOn === "monday" ? [...DAY_NAMES.slice(1), DAY_NAMES[0]] : DAY_NAMES;
  const firstWeekday = (historyMonth.getDay() - (weekStartsOn === "monday" ? 1 : 0) + 7) % 7;
  const historyByRoutine = useMemo(() => new Map(routines.map((routine) => [routine.id, buildRoutineHistory(routine, completions, itemCompletions, amountCompletions, todayKey, historyMonth)])), [routines, completions, itemCompletions, amountCompletions, todayKey, historyMonth]);
  const activeEditingDay = editingDay && selected ? historyByRoutine.get(selected.id)?.find((day) => day.key === editingDay.key) ?? editingDay : null;
  const openDayEditor = (day: HistoryDayState) => {
    onOpenDayEditor();
    setEditingDay(day);
  };
  const closeDayEditor = () => {
    setEditingDay(null);
    onCloseDayEditor();
  };

  return <div className={`page history-page${selected ? " history-page-detail" : ""}${!loading && !routines.length ? " history-page-empty" : ""}`}>
    {routines.length > 0 && <ScrollablePicker label="History routine filters" className="history-filter-picker" scrollClassName="filter-pills">
      <button className={effectiveSelection === "all" ? "active" : ""} aria-pressed={effectiveSelection === "all"} onClick={() => { onSelectRoutine("all"); setHistoryMonth(currentMonth); }}>All routines</button>
      {routines.map((routine) => <button key={routine.id} className={effectiveSelection === routine.id ? "active" : ""} aria-pressed={effectiveSelection === routine.id} style={{ "--pill": routine.color } as React.CSSProperties} onClick={() => onSelectRoutine(routine.id)}><span>{routine.emoji}</span>{routine.name}</button>)}
    </ScrollablePicker>}
    {loading ? <LoadingRows /> : !routines.length ? <section className="history-empty"><span className="empty-state-icon history-empty-icon" aria-hidden="true"><History /></span><h3>Your progress starts here</h3><p>Add a routine and its history will appear here.</p><button className="primary-button premium-action" onClick={onAddRoutine}>Add your first routine</button></section> : selected ? (() => {
      const states = historyByRoutine.get(selected.id) ?? [];
      const eligibleStates = states.filter((day) => day.status !== "off" && day.status !== "skipped" && day.status !== "scheduled");
      const completedDays = eligibleStates.filter((day) => day.status === "completed").length;
      return <section className="history-detail-card" style={{ "--history-color": selected.color } as React.CSSProperties}>
        <header><div className="history-title-row"><span className="history-emoji">{selected.emoji}</span><h2>{selected.name}</h2></div></header>
        <div className="history-month-toolbar"><button onClick={() => setHistoryMonth(new Date(historyMonth.getFullYear(), historyMonth.getMonth() - 1, 1))} aria-label="Previous history month"><ChevronLeft aria-hidden="true" /></button><div className="calendar-month-heading"><h3>{historyMonthLabel}</h3>{!viewingCurrentMonth && <button className="history-current-month-button" onClick={() => setHistoryMonth(currentMonth)}>Today</button>}</div><button onClick={() => setHistoryMonth(new Date(historyMonth.getFullYear(), historyMonth.getMonth() + 1, 1))} aria-label="Next history month" disabled={viewingCurrentMonth}><ChevronRight aria-hidden="true" /></button></div>
        <div className="history-stats"><div><strong>{historyRate(states, states.length)}%</strong><span>Monthly completion</span></div><div><strong>{completedDays}/{eligibleStates.length}</strong><span>Days completed</span></div></div>
        <div className="history-month-calendar"><div className="history-weekday-row">{historyDayNames.map((day) => <span key={day}>{day}</span>)}</div><div className="history-grid">{Array.from({ length: firstWeekday }, (_, index) => <i className="history-day-spacer" key={`spacer-${index}`} />)}{states.map((day) => {
          const isToday = day.key === todayKey;
          const editable = day.key < todayKey && day.status !== "off";
          const className = `history-day ${day.status}${isToday ? " is-today" : ""}${editable ? " history-day-editable" : ""}`;
          const contents = <><small>{day.date.toLocaleDateString("en-US", { weekday: "narrow" })}</small><strong>{day.date.getDate()}</strong></>;
          return editable
            ? <button type="button" key={day.key} className={className} aria-current={isToday ? "date" : undefined} aria-label={`View details for ${day.date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, currently ${day.status}`} onClick={() => openDayEditor(day)}>{contents}</button>
            : <div key={day.key} className={className} aria-current={isToday ? "date" : undefined} title={`${day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${day.status}`}>{contents}</div>;
        })}</div></div>
        <div className="history-legend"><span className="completed">Completed</span><span className="partial">Partial</span><span className="skipped">Skipped</span><span className="missed">Missed</span></div>
        <p className="history-edit-hint">Tap a past day to see what you recorded or correct it.</p>
      </section>;
    })() : <section className="history-overview">
      <header><h2>Monthly progress</h2></header>
      <div className="history-overview-grid">{routines.map((routine) => {
        const states = historyByRoutine.get(routine.id) ?? [];
        const rate = historyRate(states, states.length);
        return <button key={routine.id} className="history-overview-card" style={{ "--history-color": routine.color } as React.CSSProperties} onClick={() => onSelectRoutine(routine.id)} aria-label={`View ${routine.name} monthly history, ${rate}% complete`}>
          <span className="history-overview-emoji">{routine.emoji}</span><span className="history-overview-copy"><strong>{routine.name}</strong><small>View monthly details</small></span><span className="history-overview-meta"><b>{rate}%</b><ChevronRight aria-hidden="true" /></span>
          <span className="history-overview-progress" role="progressbar" aria-label={`${routine.name} monthly progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate}><i style={{ width: `${rate}%` }} /></span>
        </button>;
      })}</div>
    </section>}
    {activeEditingDay && selected && <HistoryDayEditor routine={selected} day={activeEditingDay} itemCompletions={itemCompletions} amountCompletions={amountCompletions} trackerEntries={trackerEntries} onClose={closeDayEditor} onSave={(status) => onSetDayStatus(selected, activeEditingDay.key, status)} onToggleItem={(itemId) => onToggleItem(selected, itemId, activeEditingDay.key)} onSetAmount={(tracker, count) => onSetAmount(selected, tracker, count, activeEditingDay.key)} onSetNote={(tracker, value) => onSetNote(selected, tracker, value, activeEditingDay.key)} onUploadPhoto={(tracker, file) => onUploadPhoto(selected, tracker, file, activeEditingDay.key)} onRemovePhoto={(tracker) => onRemovePhoto(selected, tracker, activeEditingDay.key)} />}
  </div>;
}

function HistoryDayEditor({ routine, day, itemCompletions, amountCompletions, trackerEntries, onClose, onSave, onToggleItem, onSetAmount, onSetNote, onUploadPhoto, onRemovePhoto }: { routine: Routine; day: HistoryDayState; itemCompletions: ItemCompletion[]; amountCompletions: AmountCompletion[]; trackerEntries: TrackerEntry[]; onClose: () => void; onSave: (status: EditableHistoryStatus) => Promise<void>; onToggleItem: (itemId: number) => Promise<void>; onSetAmount: (tracker: RoutineAmount, count: number) => Promise<void>; onSetNote: (tracker: RoutineAmount, value: string) => Promise<void>; onUploadPhoto: (tracker: RoutineAmount, file: File) => Promise<void>; onRemovePhoto: (tracker: RoutineAmount) => Promise<void> }) {
  const [savingStatus, setSavingStatus] = useState<EditableHistoryStatus | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const dateLabel = day.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const completedItemIds = new Set(itemCompletions.filter((item) => item.date === day.key).map((item) => item.itemId));
  const amountByKey = new Map(amountCompletions.filter((item) => item.routineId === routine.id && item.date === day.key).map((item) => [item.amountKey, item.count]));
  const entryByKey = new Map(trackerEntries.filter((item) => item.routineId === routine.id && item.date === day.key).map((item) => [item.trackerKey, item]));
  const tracking = routineTrackingForDay(routine, day.date.getDay());
  const statusLabels: Record<HistoryDayState["status"], string> = { completed: "Completed", partial: "Partially completed", skipped: "Skipped", missed: "Missed", scheduled: "Scheduled", off: "Not scheduled" };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !savingStatus) onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, savingStatus]);

  const save = async (status: EditableHistoryStatus) => {
    setSavingStatus(status);
    await onSave(status);
    setSavingStatus(null);
    onClose();
  };

  const toggleSimple = async () => {
    const status: EditableHistoryStatus = day.status === "completed" ? "missed" : "completed";
    setSavingStatus(status);
    await onSave(status);
    setSavingStatus(null);
  };

  return createPortal(<div className="feature-dialog-backdrop history-edit-page">
    <BlobCorners className="creation-background-blobs" />
    <section className="history-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="history-edit-title" style={{ "--history-color": routine.color, "--routine": routine.color } as React.CSSProperties}>
      <div className="history-edit-sticky">
        <header><button type="button" className="app-page-back history-page-back" onClick={onClose} aria-label="Back to history" disabled={Boolean(savingStatus)}><ChevronLeft /></button><span className="history-emoji" aria-hidden="true">{routine.emoji}</span><div><span>Day details</span><h2 id="history-edit-title">{dateLabel}</h2></div></header>
        <div className={`history-day-summary ${day.status}`}><span aria-hidden="true">{day.status === "completed" ? "✓" : day.status === "partial" ? "◐" : day.status === "skipped" ? <SkipForward /> : "×"}</span><div><strong>{statusLabels[day.status]}</strong><small>{day.status === "completed" ? "Everything required was completed or the day was marked complete." : day.status === "partial" ? "Some tracking was recorded, but the routine was not finished." : day.status === "skipped" ? "This day does not count toward your completion rate." : "No completed record was saved for this day."}</small></div><button type="button" className="history-summary-fix" onClick={() => setShowCorrection((show) => !show)} aria-expanded={showCorrection} disabled={Boolean(savingStatus)}>{showCorrection ? "Cancel" : "Change"}</button></div>
        {showCorrection && <div className="history-status-editor"><span>Change status</span><div className="history-edit-options history-edit-options-compact" role="group" aria-label={`Correct status for ${dateLabel}`}>
          <button type="button" className={`completed${day.status === "completed" ? " active" : ""}`} onClick={() => save("completed")} disabled={Boolean(savingStatus)}><span aria-hidden="true">✓</span><strong>{savingStatus === "completed" ? "Saving…" : "Completed"}</strong></button>
          <button type="button" className={`skipped${day.status === "skipped" ? " active" : ""}`} onClick={() => save("skipped")} disabled={Boolean(savingStatus)}><span aria-hidden="true"><SkipForward /></span><strong>{savingStatus === "skipped" ? "Saving…" : "Skipped"}</strong></button>
          <button type="button" className={`missed${day.status === "missed" ? " active" : ""}`} onClick={() => save("missed")} disabled={Boolean(savingStatus)}><span aria-hidden="true">×</span><strong>{savingStatus === "missed" ? "Saving…" : "Missed"}</strong></button>
        </div></div>}
      </div>
      <div className="history-records">
        {usesChecklist(tracking.mode) && <section className="history-record-section"><div className="history-record-heading"><h3>Checklist</h3><span>Tap to edit · auto-saves</span></div>{tracking.lists.map((list) => <div className="history-record-list" key={list.key}><strong>{list.name}</strong>{tracking.items.filter((item) => item.listKey === list.key).map((item) => { const checked = completedItemIds.has(item.id); return <button type="button" className={`history-record-row history-record-edit${checked ? " recorded" : ""}`} key={item.id} onClick={() => void onToggleItem(item.id)} aria-pressed={checked}><span aria-hidden="true">{checked ? "✓" : "×"}</span><div><strong>{item.title}</strong><small>{checked ? "Done" : "Not done"}</small></div></button>; })}</div>)}</section>}
        {usesQuantity(tracking.mode) && <section className="history-record-section"><div className="history-record-heading"><h3>Tracking</h3><span>Edit here · auto-saves</span></div>{tracking.amounts.map((tracker) => {
          const count = amountByKey.get(tracker.key) ?? 0;
          const entry = entryByKey.get(tracker.key);
          return <div className="history-tracker-editor" key={tracker.key}><TrackerControl routine={routine} tracker={tracker} count={count} entry={entry} date={day.key} onChange={(value) => void onSetAmount(tracker, value)} onSetNote={(value) => void onSetNote(tracker, value)} onUploadPhoto={(file) => void onUploadPhoto(tracker, file)} onRemovePhoto={() => void onRemovePhoto(tracker)} /></div>;
        })}</section>}
        {tracking.mode === "simple" && <button type="button" className={`history-simple-record history-simple-edit${day.status === "completed" ? " recorded" : ""}`} onClick={() => void toggleSimple()} disabled={Boolean(savingStatus)} aria-pressed={day.status === "completed"}><span aria-hidden="true">{day.status === "completed" ? "✓" : "×"}</span><div><strong>Routine check</strong><small>{savingStatus ? "Saving…" : day.status === "completed" ? "Marked done · tap to undo" : "Not marked done · tap to complete"}</small></div></button>}
      </div>
    </section>
  </div>, document.body);
}

function SettingsPage({ preferences, onChange, onReplacePreferences, onRefreshData, onBack }: { preferences: AppPreferences; onChange: (next: Partial<AppPreferences>) => void; onReplacePreferences: (next: unknown) => void; onRefreshData: () => Promise<void>; onBack: () => void }) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [showDataPrivacy, setShowDataPrivacy] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");

  const setReminders = async (enabled: boolean) => {
    if (!enabled) {
      onChange({ reminders: "off" });
      setReminderMessage("");
      return;
    }
    if (!("Notification" in window)) {
      setReminderMessage("Notifications aren’t supported in this browser.");
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      onChange({ reminders: "on" });
      setReminderMessage("Reminders are ready while Routine EASY is open.");
    } else {
      onChange({ reminders: "off" });
      setReminderMessage("Allow notifications in your browser to turn reminders on.");
    }
  };

  return <><div ref={pageRef} className="page settings-page">
    <header className="settings-toolbar">
      <button type="button" className="app-page-back settings-back" onClick={onBack} aria-label="Back to app"><ChevronLeft aria-hidden="true" /></button>
      <h1>Settings</h1>
      <i aria-hidden="true" />
    </header>
    <div className="settings-list" role="group" aria-label="Preferences">
      <section className="setting-card">
        <div className="setting-icon"><Monitor aria-hidden="true" /></div>
        <div className="setting-copy"><h2>Theme</h2><p>Use a light look, dark look, or match this device.</p></div>
        <div className="setting-options setting-options-three" role="group" aria-label="Theme">
          <button className={preferences.theme === "light" ? "active" : ""} onClick={() => onChange({ theme: "light" })}><Sun aria-hidden="true" /><strong>Light</strong></button>
          <button className={preferences.theme === "dark" ? "active" : ""} onClick={() => onChange({ theme: "dark" })}><Moon aria-hidden="true" /><strong>Dark</strong></button>
          <button className={preferences.theme === "system" ? "active" : ""} onClick={() => onChange({ theme: "system" })}><Monitor aria-hidden="true" /><strong>System</strong></button>
        </div>
      </section>
      <section className="setting-card">
        <div className="setting-icon"><Clock3 aria-hidden="true" /></div>
        <div className="setting-copy"><h2>Time format</h2><p>Choose how routine times appear throughout the app.</p></div>
        <div className="setting-options" role="group" aria-label="Time format">
          <button className={preferences.timeFormat === "12-hour" ? "active" : ""} onClick={() => onChange({ timeFormat: "12-hour" })}><strong>12-hour</strong><span>8:30 AM</span></button>
          <button className={preferences.timeFormat === "24-hour" ? "active" : ""} onClick={() => onChange({ timeFormat: "24-hour" })}><strong>24-hour</strong><span>08:30</span></button>
        </div>
      </section>
      <section className="setting-card">
        <div className="setting-icon"><CalendarDays aria-hidden="true" /></div>
        <div className="setting-copy"><h2>Calendar week</h2><p>Pick which day appears first in your calendar.</p></div>
        <div className="setting-options" role="group" aria-label="First day of week">
          <button className={preferences.weekStartsOn === "sunday" ? "active" : ""} onClick={() => onChange({ weekStartsOn: "sunday" })}><strong>Sunday</strong><span>Sun · Mon · Tue</span></button>
          <button className={preferences.weekStartsOn === "monday" ? "active" : ""} onClick={() => onChange({ weekStartsOn: "monday" })}><strong>Monday</strong><span>Mon · Tue · Wed</span></button>
        </div>
      </section>
      <section className="setting-card">
        <div className="setting-icon"><Sparkles aria-hidden="true" /></div>
        <div className="setting-copy"><h2>Animations</h2><p>Keep the polished movement or use a calmer experience.</p></div>
        <div className="setting-options" role="group" aria-label="Animation preference">
          <button className={preferences.motion === "full" ? "active" : ""} onClick={() => onChange({ motion: "full" })}><strong>Full</strong><span>Smooth motion</span></button>
          <button className={preferences.motion === "reduced" ? "active" : ""} onClick={() => onChange({ motion: "reduced" })}><strong>Reduced</strong><span>Less movement</span></button>
        </div>
      </section>
      <section className="setting-card">
        <div className="setting-icon"><EyeOff aria-hidden="true" /></div>
        <div className="setting-copy"><h2>Completed routines</h2><p>Choose whether finished routines remain in Today.</p></div>
        <div className="setting-options" role="group" aria-label="Completed routine visibility">
          <button className={preferences.completedVisibility === "show" ? "active" : ""} onClick={() => onChange({ completedVisibility: "show" })}><strong>Keep visible</strong><span>See your wins</span></button>
          <button className={preferences.completedVisibility === "hide" ? "active" : ""} onClick={() => onChange({ completedVisibility: "hide" })}><strong>Hide</strong><span>Clear the list</span></button>
        </div>
      </section>
      <section className="setting-card">
        <div className="setting-icon"><Volume2 aria-hidden="true" /></div>
        <div className="setting-copy"><h2>Sounds and haptics</h2><p>Give check-offs a small sound and vibration when supported.</p></div>
        <div className="setting-options" role="group" aria-label="Sounds and haptics">
          <button className={preferences.feedback === "on" ? "active" : ""} onClick={() => onChange({ feedback: "on" })}><strong>On</strong><span>Gentle feedback</span></button>
          <button className={preferences.feedback === "off" ? "active" : ""} onClick={() => onChange({ feedback: "off" })}><strong>Off</strong><span>Stay silent</span></button>
        </div>
      </section>
      <section className="setting-card">
        <div className="setting-icon"><Bell aria-hidden="true" /></div>
        <div className="setting-copy"><h2>Reminders</h2><p>Get alerts at routine times while Routine EASY is open.{reminderMessage && <small className="setting-message">{reminderMessage}</small>}</p></div>
        <div className="setting-options" role="group" aria-label="Routine reminders">
          <button className={preferences.reminders === "on" ? "active" : ""} onClick={() => void setReminders(true)}><strong>On</strong><span>Use routine times</span></button>
          <button className={preferences.reminders === "off" ? "active" : ""} onClick={() => void setReminders(false)}><strong>Off</strong><span>No alerts</span></button>
        </div>
      </section>
      <section className="setting-card">
        <div className="setting-icon"><Database aria-hidden="true" /></div>
        <div className="setting-copy"><h2>Data and privacy</h2><p>Download a backup, restore one, or erase your saved data.</p></div>
        <button type="button" className="setting-open-button" onClick={() => setShowDataPrivacy(true)}><ShieldCheck aria-hidden="true" />Manage data</button>
      </section>
    </div>
    <p className="settings-saved"><CircleCheckBig aria-hidden="true" />Preferences save automatically</p>
    {showDataPrivacy && <DataPrivacyDialog preferences={preferences} onClose={() => setShowDataPrivacy(false)} onReplacePreferences={onReplacePreferences} onRefreshData={onRefreshData} />}
  </div>
  <VerticalScrollIndicator scrollerRef={pageRef} label="Settings page" className="settings-scrollbar" headerSelector=".settings-toolbar" />
  </>;
}

function DataPrivacyDialog({ preferences, onClose, onReplacePreferences, onRefreshData }: { preferences: AppPreferences; onClose: () => void; onReplacePreferences: (next: unknown) => void; onRefreshData: () => Promise<void> }) {
  const [busy, setBusy] = useState<"export" | "import" | "erase" | null>(null);
  const [message, setMessage] = useState("");
  const [confirmErase, setConfirmErase] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [busy, onClose]);

  const exportBackup = async () => {
    setBusy("export");
    setMessage("");
    try {
      let data: Record<string, unknown>;
      if (isNativeApp()) {
        data = await loadDeviceSnapshot() as unknown as Record<string, unknown>;
      } else {
        const response = await fetch("/api/data", { cache: "no-store" });
        if (!response.ok) throw new Error("Export failed");
        data = await response.json();
      }
      const blob = new Blob([JSON.stringify({ ...data, preferences }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `routine-easy-backup-${localDateKey()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Backup downloaded.");
    } catch {
      setMessage("Your backup could not be downloaded. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const importBackup = async (file: File) => {
    setBusy("import");
    setMessage("");
    try {
      const backup = JSON.parse(await file.text());
      if (isNativeApp()) {
        await saveDeviceSnapshot({
          version: 1,
          routines: Array.isArray(backup.routines) ? backup.routines : [],
          completions: Array.isArray(backup.completions) ? backup.completions : [],
          itemCompletions: Array.isArray(backup.itemCompletions) ? backup.itemCompletions : [],
          amountCompletions: Array.isArray(backup.amountCompletions) ? backup.amountCompletions : [],
          trackerEntries: Array.isArray(backup.trackerEntries) ? backup.trackerEntries.filter((entry: TrackerEntry) => !entry.hasFile) : [],
        });
      } else {
        const response = await fetch("/api/data", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backup }) });
        if (!response.ok) throw new Error("Import failed");
      }
      if (backup.preferences) onReplacePreferences(backup.preferences);
      await onRefreshData();
      setMessage("Backup restored successfully.");
    } catch {
      setMessage("That backup could not be restored. Choose a Routine EASY backup file.");
    } finally {
      setBusy(null);
    }
  };

  const eraseData = async () => {
    setBusy("erase");
    setMessage("");
    try {
      if (isNativeApp()) {
        await clearDeviceData();
      } else {
        const response = await fetch("/api/data", { method: "DELETE" });
        if (!response.ok) throw new Error("Erase failed");
      }
      onReplacePreferences(DEFAULT_PREFERENCES);
      await onRefreshData();
      onClose();
    } catch {
      setMessage("Your data could not be erased. Please try again.");
      setBusy(null);
    }
  };

  return createPortal(<div className="feature-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="data-dialog" role="dialog" aria-modal="true" aria-labelledby="data-dialog-title">
      <header><div className="data-dialog-icon"><ShieldCheck aria-hidden="true" /></div><div><span>Data and privacy</span><h2 id="data-dialog-title">Your Routine EASY data</h2><p>Keep a personal backup or permanently clear your account data.</p></div><button type="button" onClick={onClose} disabled={Boolean(busy)} aria-label="Close data and privacy"><X /></button></header>
      <div className="data-action-list">
        <button type="button" onClick={() => void exportBackup()} disabled={Boolean(busy)}><Download aria-hidden="true" /><span><strong>{busy === "export" ? "Preparing backup…" : "Download backup"}</strong><small>Routines, progress, notes, and preferences</small></span></button>
        <label className={busy ? "disabled" : ""}><Upload aria-hidden="true" /><span><strong>{busy === "import" ? "Restoring backup…" : "Restore from backup"}</strong><small>Replaces current routines and progress</small></span><input type="file" accept="application/json,.json" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.currentTarget.value = ""; }} /></label>
      </div>
      <p className="data-photo-note">Photo files are not included in JSON backups. Erasing data permanently removes {isNativeApp() ? "photos from this device" : "stored photos"}.</p>
      <div className="data-danger-zone">
        <div><strong>Erase everything</strong><small>Delete every routine, history record, note, and photo.</small></div>
        {!confirmErase ? <button type="button" onClick={() => setConfirmErase(true)} disabled={Boolean(busy)}>Erase data</button> : <button type="button" className="confirm" onClick={() => void eraseData()} disabled={Boolean(busy)}>{busy === "erase" ? "Erasing…" : "Confirm erase"}</button>}
      </div>
      {confirmErase && !busy && <button type="button" className="data-cancel-erase" onClick={() => setConfirmErase(false)}>Cancel erase</button>}
      {message && <p className="data-dialog-message" role="status">{message}</p>}
    </section>
  </div>, document.body);
}

function BlobCorners({ className = "" }: { className?: string }) {
  return <div className={`splash-blobs${className ? ` ${className}` : ""}`} aria-hidden="true">
      <span className="splash-blob splash-blob-purple"><i /></span>
      <span className="splash-blob splash-blob-coral"><i /></span>
      <span className="splash-blob splash-blob-gold"><i /></span>
      <span className="splash-blob splash-blob-sky"><i /></span>
    </div>;
}

function OnboardingSplash({ leaving = false }: { leaving?: boolean }) {
  return <main className={`onboarding-splash splash-overlay${leaving ? " leaving" : ""}`} aria-label="Loading Routine EASY">
    <BlobCorners className="app-background-blobs splash-home-blobs" />
    <div className="splash-brand">
          <img className="splash-logo" src="/routineez-checklist-glossy.png" alt="" />
      <div className="splash-wordmark" aria-hidden="true">
        <span className="splash-routine">Routine</span><EasyWord className="splash-easy" />
      </div>
    </div>
  </main>;
}

function EasyWord({ className }: { className: string }) {
  return <span className={className} aria-hidden="true"><span className="easy-e">E</span><span className="easy-a">A</span><span className="easy-s">S</span><span className="easy-y">Y</span></span>;
}

function BottomNavSurface({ tab, phase, reducedMotion }: { tab: Tab; phase: BottomNavPhase; reducedMotion: boolean }) {
  const centers: Partial<Record<Tab, { percent: string; offset: number }>> = {
    today: { percent: "12.5%", offset: 9 },
    calendar: { percent: "37.5%", offset: 3 },
    routines: { percent: "62.5%", offset: -3 },
    history: { percent: "87.5%", offset: -9 },
  };
  const center = centers[tab] ?? { percent: "0%", offset: -40 };
  const maskId = `bottom-nav-mask-${tab}`;
  const notchId = `bottom-nav-notch-${tab}`;
  const sheenId = `bottom-nav-sheen-${tab}`;
  const closing = phase === "exiting";
  const notchMotionClass = reducedMotion ? "" : closing ? " bottom-nav-notch-closing" : " bottom-nav-notch-opening";

  return <svg className="bottom-nav-surface" aria-hidden="true">
    <defs>
      <path id={notchId} d="M 42 -8 L -42 -8 L -42 0 C -36 0 -34 2 -33 9 C -30 29 -18 42 0 42 C 18 42 30 29 33 9 C 34 2 36 0 42 0 Z" />
      <mask id={maskId} x="0" y="0" width="100%" height="100%" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
        <rect width="100%" height="100%" fill="#fff" />
        <g transform={`translate(${center.offset} 0)`}>
          <g className={`bottom-nav-notch-motion${notchMotionClass}`}>
            <use href={`#${notchId}`} x={center.percent} y="0" fill="#000" />
          </g>
        </g>
      </mask>
      <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
        <stop className="bottom-nav-sheen-top" offset="0" />
        <stop className="bottom-nav-sheen-middle" offset=".54" />
        <stop className="bottom-nav-sheen-bottom" offset="1" />
      </linearGradient>
    </defs>
    <rect className="bottom-nav-surface-fill" width="100%" height="100%" mask={`url(#${maskId})`} />
    <rect className="bottom-nav-surface-sheen" width="100%" height="100%" fill={`url(#${sheenId})`} mask={`url(#${maskId})`} />
  </svg>;
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return <button className={active ? "active" : ""} onClick={onClick} aria-current={active ? "page" : undefined}><span className="nav-icon"><Icon aria-hidden="true" strokeWidth={active ? 2.4 : 2} /></span><span className="nav-label">{label}</span></button>;
}

function CalendarNavButton({ active, onClick, date }: { active: boolean; onClick: () => void; date: Date }) {
  return <button className={`calendar-nav-button ${active ? "active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}><span className="nav-icon date-nav-icon" aria-hidden="true"><i>{date.toLocaleDateString("en-US", { month: "short" })}</i><strong>{date.getDate()}</strong></span><span className="nav-label">Calendar</span></button>;
}

function RoutineRow({ routine, completed, skipped, completedItemIds, amountCounts, trackerEntries, onToggle, onToggleItem, onSetAmount, onSetNote, onUploadPhoto, onRemovePhoto, onSkip, timeFormat }: { routine: Routine; completed: boolean; skipped: boolean; completedItemIds: Set<number>; amountCounts: Record<string, number>; trackerEntries: Record<string, TrackerEntry | undefined>; onToggle: () => void; onToggleItem: (itemId: number) => void; onSetAmount: (amount: RoutineAmount, count: number) => void; onSetNote: (tracker: RoutineAmount, value: string) => void; onUploadPhoto: (tracker: RoutineAmount, file: File) => void; onRemovePhoto: (tracker: RoutineAmount) => void; onSkip: (skipped: boolean) => void; timeFormat: TimeFormat }) {
  const dayVariant = routine.dayVariants?.[new Date().getDay()];
  const activeTracking = routineTrackingForDay(routine, new Date().getDay());
  const { lists: activeLists, amounts: activeAmounts, items: activeItems, mode: activeTrackingMode } = activeTracking;
  const hasDetails = (usesChecklist(activeTrackingMode) && activeItems.length > 0) || (usesQuantity(activeTrackingMode) && activeAmounts.length > 0);
  const [expanded, setExpanded] = useState(false);
  const [expansionHeight, setExpansionHeight] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragXRef = useRef(0);
  const pointerActiveRef = useRef(false);
  const gestureAxisRef = useRef<"pending" | "horizontal" | "vertical">("pending");
  const checkPointerRef = useRef({ active: false, pointerId: -1, x: 0, y: 0 });
  const expansionInnerRef = useRef<HTMLDivElement>(null);
  const skippedRef = useRef(skipped);
  if (skippedRef.current !== skipped) skippedRef.current = skipped;
  useEffect(() => {
    const content = expansionInnerRef.current;
    if (!content) return;
    const measure = () => setExpansionHeight(content.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [hasDetails]);
  const completedCount = activeItems.filter((item) => completedItemIds.has(item.id)).length;
  const todayVariant = typeof dayVariant === "string" ? dayVariant : dayVariant?.label ?? "";
  const progressParts = [
    ...(usesChecklist(activeTrackingMode) && activeItems.length ? [Math.round((completedCount / activeItems.length) * 100)] : []),
    ...(usesQuantity(activeTrackingMode) ? activeAmounts.map((amount) => trackerProgress(amount, amountCounts[amount.key] ?? 0)) : []),
  ];
  const progressValue = completed ? 100 : progressParts.length ? Math.round(progressParts.reduce((sum, value) => sum + value, 0) / progressParts.length) : 0;
  const detail = [
    ...(usesChecklist(activeTrackingMode) ? [`${completedCount}/${activeItems.length} items`] : []),
    ...(usesQuantity(activeTrackingMode) ? [activeAmounts.length === 1 ? trackerSummary(activeAmounts[0], amountCounts[activeAmounts[0].key] ?? 0) : `${activeAmounts.filter((amount) => trackerIsComplete(amount, amountCounts[amount.key] ?? 0)).length}/${activeAmounts.length} trackers`] : []),
  ].join(" · ");
  const toggleSkip = () => {
    const nextSkipped = !skippedRef.current;
    skippedRef.current = nextSkipped;
    onSkip(nextSkipped);
  };
  const activateRoutine = () => {
    if (skippedRef.current) toggleSkip();
    else if (hasDetails) setExpanded((value) => !value);
    else onToggle();
  };
  const activateCheckZone = () => skippedRef.current ? toggleSkip() : onToggle();
  const beginCheckPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    checkPointerRef.current = { active: true, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const finishCheckPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const pointer = checkPointerRef.current;
    const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
    const shouldActivate = pointer.active && pointer.pointerId === event.pointerId && distance < 22;
    checkPointerRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (shouldActivate) activateCheckZone();
  };
  const cancelCheckPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    checkPointerRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const updateDrag = (value: number) => {
    const bounded = Math.max(-104, Math.min(104, value));
    dragXRef.current = bounded;
    setDragX(bounded);
  };
  const beginSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.button !== 0 || target?.closest(".routine-check-zone, .routine-skip-accessible") || (expanded && !target?.closest(".routine-main"))) return;
    pointerActiveRef.current = true;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    gestureAxisRef.current = "pending";
    setSwiping(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current || gestureAxisRef.current === "vertical") return;
    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;
    if (gestureAxisRef.current === "pending") {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      gestureAxisRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      if (gestureAxisRef.current === "vertical") return;
      setSwiping(true);
    }
    if (gestureAxisRef.current === "horizontal") updateDrag(deltaX * .86);
  };
  const finishSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    const gestureAxis = gestureAxisRef.current;
    const completedSwipe = gestureAxis === "horizontal" && Math.abs(dragXRef.current) >= 70;
    const tapGesture = gestureAxis === "pending" || (gestureAxis === "horizontal" && Math.abs(dragXRef.current) < 18);
    pointerActiveRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gestureAxisRef.current = "pending";
    setSwiping(false);
    updateDrag(0);
    if (completedSwipe) toggleSkip();
    else if (tapGesture) activateRoutine();
  };
  const cancelSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gestureAxisRef.current = "pending";
    setSwiping(false);
    updateDrag(0);
  };
  const swipeDirection = dragX > 0 ? "swiping-right" : dragX < 0 ? "swiping-left" : "";
  return <article className={`routine-row mode-${activeTrackingMode} ${completed ? "completed" : ""} ${skipped ? "skipped" : ""} ${expanded ? "expanded" : ""} ${swiping ? "swiping" : ""} ${swipeDirection}`} style={{ "--routine": routine.color } as React.CSSProperties}>
    <div className="routine-swipe-underlay" aria-hidden="true"><span><SkipForward />{skipped ? "Undo skip" : "Skip today"}</span><span>{skipped ? "Undo skip" : "Skip today"}<SkipForward /></span></div>
    <div className="routine-swipe-surface" style={{ transform: `translateX(${dragX}px)` }} onPointerDown={beginSwipe} onPointerMove={moveSwipe} onPointerUp={finishSwipe} onPointerCancel={cancelSwipe}>
      <div className="routine-main" role="button" tabIndex={0} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateRoutine();
        }
      }} aria-label={skipped ? `Undo skip for ${routine.name}` : hasDetails ? `${expanded ? "Collapse" : "Expand"} ${routine.name}` : completed ? `Mark ${routine.name} incomplete` : `Complete ${routine.name}`} aria-expanded={hasDetails ? expanded : undefined} aria-description={skipped ? "Tap anywhere or swipe left or right to undo skip" : "Swipe left or right to skip today"}>
        <span className="routine-emoji">{routine.emoji}</span>
        <span className="routine-info"><strong>{routine.name}</strong><small>{skipped ? "Skipped today" : <>{todayVariant && <b className="today-variant">{todayVariant}</b>}{todayVariant && " · "}{formatRoutineTime(routine.time, timeFormat)}{detail ? ` · ${detail}` : ""}</>}</small></span>
        {hasDetails && <span className="expand-chevron" aria-hidden="true" />}
      </div>
      <button type="button" className="routine-check-zone" onPointerDown={beginCheckPointer} onPointerUp={finishCheckPointer} onPointerCancel={cancelCheckPointer} onLostPointerCapture={() => { checkPointerRef.current.active = false; }} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateCheckZone();
        }
      }} aria-label={skipped ? `Undo skip and reset ${routine.name}` : completed ? `Mark ${routine.name} incomplete` : `Complete ${routine.name}`}><span className="check-circle" aria-hidden="true">{skipped ? <SkipForward /> : "✓"}</span></button>
      <button className="routine-skip-accessible" onClick={toggleSkip}>{skipped ? `Undo skip for ${routine.name}` : `Skip ${routine.name} today`}</button>
    </div>
    {hasDetails && <div className="routine-expansion" aria-hidden={!expanded} inert={!expanded} style={{ height: expanded ? `${expansionHeight}px` : "0px" }}>
      <div ref={expansionInnerRef} className="routine-expansion-inner">
        {usesQuantity(activeTrackingMode) && <div className="quantity-trackers">{activeAmounts.map((amount) => <TrackerControl key={amount.key} routine={routine} tracker={amount} count={amountCounts[amount.key] ?? 0} entry={trackerEntries[amount.key]} date={localDateKey()} onChange={(count) => onSetAmount(amount, count)} onSetNote={(value) => onSetNote(amount, value)} onUploadPhoto={(file) => onUploadPhoto(amount, file)} onRemovePhoto={() => onRemovePhoto(amount)} />)}</div>}
        {usesChecklist(activeTrackingMode) && activeItems.length > 0 && <div className="routine-checklist">{activeLists.map((list) => <section className="routine-list-group" key={list.key}>
          <strong className="routine-list-name">{list.name}</strong>
          {activeItems.filter((item) => item.listKey === list.key).map((item) => {
            const checked = completedItemIds.has(item.id);
            return <button key={item.id} className={checked ? "checked" : ""} onClick={() => onToggleItem(item.id)}>
              <span className="item-check">✓</span><span>{item.title}</span>
            </button>;
          })}
        </section>)}</div>}
      </div>
    </div>}
    {!expanded && <div className="collapsed-progress" role="progressbar" aria-label={`${routine.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}>
      <span style={{ width: `${progressValue}%` }} />
    </div>}
  </article>;
}

function TrackerPhoto({ entry, fallbackUrl, alt }: { entry: TrackerEntry; fallbackUrl: string; alt: string }) {
  const [src, setSrc] = useState(isNativeApp() ? "" : fallbackUrl);

  useEffect(() => {
    let cancelled = false;
    if (!isNativeApp() || !entry.filePath) {
      setSrc(fallbackUrl);
      return;
    }
    void readDevicePhoto(entry.filePath, entry.contentType).then((value) => { if (!cancelled) setSrc(value); });
    return () => { cancelled = true; };
  }, [entry.filePath, entry.contentType, entry.value, fallbackUrl]);

  return src ? <img src={src} alt={alt} /> : <div className="tracker-photo-loading" role="status">Loading photo…</div>;
}

function TrackerControl({ routine, tracker, count, entry, date, onChange, onSetNote, onUploadPhoto, onRemovePhoto }: { routine: Routine; tracker: RoutineAmount; count: number; entry?: TrackerEntry; date: string; onChange: (count: number) => void; onSetNote: (value: string) => void; onUploadPhoto: (file: File) => void; onRemovePhoto: () => void }) {
  const kind = trackerKind(tracker);
  const [draft, setDraft] = useState(entry?.value ?? "");
  const [numberDraft, setNumberDraft] = useState(count ? String(count) : "");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => setDraft(entry?.value ?? ""), [entry?.value]);
  useEffect(() => setNumberDraft(count ? String(count) : ""), [count]);
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  if (kind === "amount") return <div className="quantity-tracker">
    <strong className="quantity-name">{tracker.name}</strong>
    <div className="quantity-pill" style={{ "--segments": tracker.targetCount } as React.CSSProperties} role="group" aria-label={`${routine.name}: ${count} of ${tracker.targetCount} ${tracker.name}`}>
      {Array.from({ length: tracker.targetCount }, (_, index) => {
        const value = index + 1;
        const filled = value <= count;
        return <button key={value} type="button" className={filled ? "filled" : ""} onClick={() => onChange(filled ? value - 1 : value)} aria-label={`${filled ? "Remove" : "Record"} ${tracker.name} ${value}`} aria-pressed={filled}>
          <span>{filled ? "✓" : value}</span>
        </button>;
      })}
    </div>
  </div>;

  if (kind === "duration") return <div className="quantity-tracker tracker-control-row">
    <strong className="quantity-name">{tracker.name}</strong>
    <div className="tracker-stepper" role="group" aria-label={`${tracker.name}: ${count} of ${tracker.targetCount} minutes`}><button type="button" onClick={() => onChange(Math.max(0, count - 5))}>−5</button><span><b>{count}</b> / {tracker.targetCount} min</span><button type="button" onClick={() => onChange(count + 5)}>+5</button></div>
  </div>;

  if (kind === "timer") {
    const stopTimer = () => {
      const sessionSeconds = startedAt === null ? 0 : Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      onChange(count + sessionSeconds);
      setStartedAt(null);
      setElapsedSeconds(0);
    };
    const displayedSeconds = count + (startedAt === null ? 0 : elapsedSeconds);
    return <div className="quantity-tracker tracker-control-row"><strong className="quantity-name">{tracker.name}</strong><div className="tracker-timer"><span><b>{formatTimerSeconds(displayedSeconds)}</b> / {tracker.targetCount}:00</span><button type="button" className={startedAt !== null ? "running" : ""} onClick={() => startedAt === null ? setStartedAt(Date.now()) : stopTimer()}>{startedAt === null ? (count ? "Resume" : "Start") : "Pause"}</button></div></div>;
  }

  if (kind === "rating") return <div className="quantity-tracker tracker-control-row"><strong className="quantity-name">{tracker.name}</strong><div className="tracker-rating" role="group" aria-label={`Rate ${tracker.name}`}>
    {Array.from({ length: 5 }, (_, index) => { const value = index + 1; return <button type="button" key={value} className={value <= count ? "filled" : ""} onClick={() => onChange(count === value ? 0 : value)} aria-label={`${value} stars`} aria-pressed={count === value}>★</button>; })}
  </div></div>;

  if (kind === "number") return <div className="quantity-tracker tracker-control-row"><strong className="quantity-name">{tracker.name}</strong><div className="tracker-number"><input type="number" min="0" step="1" value={numberDraft} onChange={(event) => { const value = event.target.value; setNumberDraft(value); onChange(value === "" ? 0 : Number(value) || 0); }} placeholder="How much?" aria-label={`How much ${tracker.name}`} /><span>{tracker.unit || ""}</span></div></div>;

  if (kind === "note") return <div className="tracker-wide-control tracker-note"><div className="tracker-note-heading"><strong>{tracker.name}</strong><small>{draft.length}/2000</small></div><textarea value={draft} onChange={(event) => { const value = event.target.value; setDraft(value); onSetNote(value); }} placeholder="Write a short note…" maxLength={2000} /></div>;

  if (kind === "photo") {
    const photoUrl = `/api/tracker-photo?${new URLSearchParams({ routineId: String(routine.id), trackerKey: tracker.key, date, v: entry?.value ?? "" })}`;
    return <div className="tracker-wide-control tracker-photo"><div className="tracker-photo-row"><strong>{tracker.name}</strong><div className="tracker-photo-actions"><label><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadPhoto(file); event.currentTarget.value = ""; }} /><span>{entry?.hasFile ? "Replace" : "Choose photo"}</span></label><label><input type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadPhoto(file); event.currentTarget.value = ""; }} /><span>Take photo</span></label>{entry?.hasFile && <button type="button" className="tracker-remove-photo" onClick={onRemovePhoto}>Remove</button>}</div></div>{entry?.hasFile && <TrackerPhoto entry={entry} fallbackUrl={photoUrl} alt={`${tracker.name} for ${date}`} />}</div>;
  }

  return <div className="quantity-tracker tracker-control-row"><strong className="quantity-name">{tracker.name}</strong><button type="button" className={`tracker-avoidance${count ? " active" : ""}`} onClick={() => onChange(count ? 0 : 1)}><span>{count ? "✓" : ""}</span>I avoided this {date === localDateKey() ? "today" : "that day"}</button></div>;
}

function RoutineCard({ routine, timeFormat, onEditOptions, onDuplicate, onHistory, onDelete }: { routine: Routine; timeFormat: TimeFormat; onEditOptions: () => void; onDuplicate: () => void; onHistory: () => void; onDelete: () => void }) {
  const dayLabel = routine.days.length === 7 ? "Every day" : routine.days.map((day) => DAY_NAMES[day]).join(" · ");
  const trackingLabel = routine.trackingMode === "simple" ? "Single check" : [
    ...(usesChecklist(routine.trackingMode) ? [`${routine.lists.length} ${routine.lists.length === 1 ? "list" : "lists"}`] : []),
    ...(usesQuantity(routine.trackingMode) ? [routine.amounts.map((amount) => trackerKindLabel(amount)).join(" + ")] : []),
  ].join(" + ");
  return <article className="routine-card" style={{ "--routine": routine.color } as React.CSSProperties}>
    <div className="card-color"><span>{routine.emoji}</span></div>
    <div className="card-body"><strong>{routine.name}</strong><p>{dayLabel}</p><small>{formatRoutineTime(routine.time, timeFormat)} · {trackingLabel}</small><small className="date-range-label">{formatDateRange(routine)}</small></div>
    <div className="routine-card-actions">
      <button onClick={onEditOptions} aria-label={`Edit ${routine.name}`}>Edit</button>
      <button onClick={onDuplicate} aria-label={`Duplicate ${routine.name}`}><Copy aria-hidden="true" />Duplicate</button>
      <button onClick={onHistory} aria-label={`View history for ${routine.name}`}><History aria-hidden="true" />History</button>
    </div>
    <button className="delete-button" onClick={onDelete} aria-label={`Delete ${routine.name}`}><Trash2 aria-hidden="true" /></button>
  </article>;
}

function DeleteRoutineDialog({ routine, deleting, onCancel, onConfirm }: { routine: Routine; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [deleting, onCancel]);

  return <div className="delete-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) onCancel(); }}>
    <section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
      <div className="delete-dialog-icon" aria-hidden="true"><Trash2 /></div>
      <div className="delete-dialog-copy"><small>Please confirm</small><h2 id="delete-dialog-title">Delete {routine.name}?</h2><p id="delete-dialog-description">This removes the routine, its checklist items, and its completion history. This can’t be undone.</p></div>
      <div className="delete-dialog-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={deleting}>Cancel</button><button type="button" className="delete-confirm-button" onClick={onConfirm} disabled={deleting}>{deleting ? "Deleting…" : "Delete routine"}</button></div>
    </section>
  </div>;
}

function TemplateChooser({ onCancel, onChoose }: { onCancel: () => void; onChoose: (template: RoutineTemplate | null) => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [onCancel]);

  return createPortal(<div className="feature-dialog-backdrop routine-template-page">
    <BlobCorners className="creation-background-blobs" />
    <section className="template-dialog" role="dialog" aria-modal="true" aria-labelledby="template-title">
      <header className="template-dialog-header">
        <button type="button" className="app-page-back template-page-back" onClick={onCancel} aria-label="Back to routines"><ChevronLeft aria-hidden="true" /></button>
        <h2 id="template-title">Create routine</h2>
        <i aria-hidden="true" />
      </header>
      <div className="template-options">
        <button className="blank-template" onClick={() => onChoose(null)}><span className="template-symbol">+</span><span><strong>Start from scratch</strong><small>Build exactly what you need</small></span><ChevronRight aria-hidden="true" /></button>
        <div className="template-grid">{ROUTINE_TEMPLATES.map((template) => <button key={template.id} onClick={() => onChoose(template)} style={{ "--template-color": template.color } as React.CSSProperties}>
          <span className="template-emoji">{template.emoji}</span><span><strong>{template.name}</strong><small>{template.description}</small></span><ChevronRight aria-hidden="true" />
        </button>)}</div>
      </div>
    </section>
  </div>, document.body);
}

function CompletionHistoryDialog({ routine, completions, itemCompletions, amountCompletions, todayKey, onClose }: { routine: Routine; completions: Completion[]; itemCompletions: ItemCompletion[]; amountCompletions: AmountCompletion[]; todayKey: string; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);

  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(`${todayKey}T12:00:00`);
    date.setDate(date.getDate() - (29 - index));
    return { date, key: localDateKey(date) };
  });
  const statusFor = (date: string) => {
    const saved = completions.find((item) => item.routineId === routine.id && item.date === date)?.status;
    if (saved === "skipped") return "skipped" as const;
    const scheduled = routine.days.includes(new Date(`${date}T12:00:00`).getDay()) && routineActiveOnDate(routine, date);
    if (!scheduled) return "off" as const;
    if (saved === "completed") return "completed" as const;
    const tracking = routineTrackingForDate(routine, date);
    const itemIds = new Set(tracking.items.map((item) => item.id));
    const amountKeys = new Set(tracking.amounts.map((amount) => amount.key));
    const checkedItems = itemCompletions.filter((item) => item.date === date && itemIds.has(item.itemId)).length;
    const amounts = amountCompletions.filter((item) => item.routineId === routine.id && item.date === date && amountKeys.has(item.amountKey));
    const checklistDone = !usesChecklist(tracking.mode) || (tracking.items.length > 0 && checkedItems === tracking.items.length);
    const amountDone = !usesQuantity(tracking.mode) || (tracking.amounts.length > 0 && tracking.amounts.every((amount) => trackerIsComplete(amount, amounts.find((item) => item.amountKey === amount.key)?.count ?? 0)));
    const completed = tracking.mode === "simple" ? saved === "completed" : checklistDone && amountDone;
    if (completed) return "completed" as const;
    if (checkedItems > 0 || amounts.some((item) => item.count > 0)) return "partial" as const;
    return date < todayKey ? "missed" as const : "scheduled" as const;
  };
  const states = days.map((day) => ({ ...day, status: statusFor(day.key) }));
  const rateFor = (count: number) => {
    const eligible = states.slice(-count).filter((day) => day.status !== "off" && day.status !== "skipped" && day.status !== "scheduled");
    return eligible.length ? Math.round((eligible.filter((day) => day.status === "completed").length / eligible.length) * 100) : 0;
  };

  return <div className="feature-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-title" style={{ "--history-color": routine.color } as React.CSSProperties}>
      <header><span className="history-emoji">{routine.emoji}</span><div><span>Completion history</span><h2 id="history-title">{routine.name}</h2><p>Your last 30 days at a glance.</p></div><button onClick={onClose} aria-label="Close history"><X /></button></header>
      <div className="history-stats"><div><strong>{rateFor(7)}%</strong><span>Last 7 days</span></div><div><strong>{rateFor(30)}%</strong><span>Last 30 days</span></div></div>
      <div className="history-grid">{states.map((day) => <div key={day.key} className={`history-day ${day.status}`} title={`${day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${day.status}`}><small>{day.date.toLocaleDateString("en-US", { weekday: "narrow" })}</small><strong>{day.date.getDate()}</strong></div>)}</div>
      <div className="history-legend"><span className="completed">Completed</span><span className="partial">Partial</span><span className="skipped">Skipped</span><span className="missed">Missed</span></div>
      <button className="history-close-button" onClick={onClose}>Done</button>
    </section>
  </div>;
}

function RoutineLivePreview({ name, time, emoji, color, trackingMode, lists, amounts, timeFormat }: { name: string; time: string; emoji: string; color: string; trackingMode: TrackingMode; lists: RoutineListDraft[]; amounts: RoutineAmount[]; timeFormat: TimeFormat }) {
  const items = useMemo(() => lists.flatMap((list) => list.items.split(/\r?\n/).map((title) => title.trim()).filter(Boolean).map((title) => ({ listKey: list.key, title }))), [lists]);
  const [expanded, setExpanded] = useState(false);
  const [simpleDone, setSimpleDone] = useState(false);
  const [checkedItems, setCheckedItems] = useState<number[]>([]);
  const [amountCounts, setAmountCounts] = useState<Record<string, number>>({});
  const hasDetails = usesChecklist(trackingMode) || usesQuantity(trackingMode);
  const checklistDone = !usesChecklist(trackingMode) || (items.length > 0 && checkedItems.length === items.length);
  const quantityDone = !usesQuantity(trackingMode) || (amounts.length > 0 && amounts.every((amount) => trackerIsComplete(amount, amountCounts[amount.key] ?? 0)));
  const completed = trackingMode === "simple" ? simpleDone : checklistDone && quantityDone;
  const detail = trackingMode === "simple" ? "Single check" : [
    ...(usesChecklist(trackingMode) ? [items.length ? `${checkedItems.length}/${items.length} items` : "List · Add items below"] : []),
    ...(usesQuantity(trackingMode) ? [amounts.length === 1 ? trackerSummary(amounts[0], amountCounts[amounts[0].key] ?? 0) : `${amounts.filter((amount) => trackerIsComplete(amount, amountCounts[amount.key] ?? 0)).length}/${amounts.length} trackers`] : []),
  ].join(" · ");
  const progressParts = [
    ...(usesChecklist(trackingMode) ? [items.length ? Math.round((checkedItems.length / items.length) * 100) : 0] : []),
    ...(usesQuantity(trackingMode) ? amounts.map((amount) => trackerProgress(amount, amountCounts[amount.key] ?? 0)) : []),
  ];
  const progressValue = trackingMode === "simple" ? simpleDone ? 100 : 0 : Math.round(progressParts.reduce((sum, value) => sum + value, 0) / progressParts.length);

  useEffect(() => {
    setExpanded(trackingMode !== "simple");
    setSimpleDone(false);
    setCheckedItems([]);
    setAmountCounts({});
  }, [trackingMode]);

  useEffect(() => {
    setCheckedItems((checked) => checked.filter((index) => index < items.length));
  }, [items.length]);

  useEffect(() => {
    setAmountCounts((counts) => Object.fromEntries(amounts.map((amount) => [amount.key, Math.min(counts[amount.key] ?? 0, trackerMaximumValue(amount))])));
  }, [amounts]);

  const toggleAll = () => {
    if (trackingMode === "simple") setSimpleDone((done) => !done);
    else {
      if (usesChecklist(trackingMode)) setCheckedItems(completed ? [] : items.map((_, index) => index));
      if (usesQuantity(trackingMode)) setAmountCounts(Object.fromEntries(amounts.map((amount) => [amount.key, completed ? 0 : trackerCompletionValue(amount)])));
    }
  };

  return <section className={`routine-live-preview${expanded ? " expanded" : ""}${completed ? " completed" : ""}`} style={{ "--preview": color } as React.CSSProperties} aria-label="Interactive routine preview">
    <div className="preview-summary">
      <button type="button" className="preview-main" onClick={() => hasDetails ? setExpanded((value) => !value) : toggleAll()} aria-expanded={hasDetails ? expanded : undefined}>
        <span className="preview-icon" aria-hidden="true">{emoji}</span>
        <span className="preview-copy"><strong>{name.trim() || "Your new routine"}</strong><span>{formatRoutineTime(time, timeFormat)} · {detail}</span></span>
        {hasDetails && <span className="preview-chevron" aria-hidden="true" />}
      </button>
      <button type="button" className={`preview-check${completed ? " checked" : ""}`} onClick={toggleAll} aria-label={completed ? "Reset preview completion" : "Complete preview routine"}>{completed ? "✓" : ""}</button>
    </div>
    {expanded && usesQuantity(trackingMode) && <div className="preview-details preview-amount">{amounts.map((amount) => <PreviewTracker key={amount.key} tracker={amount} count={amountCounts[amount.key] ?? 0} onChange={(count) => setAmountCounts((counts) => ({ ...counts, [amount.key]: count }))} />)}</div>}
    {expanded && usesChecklist(trackingMode) && <div className="preview-details preview-list">
      {items.length ? lists.map((list) => <section className="preview-list-group" key={list.key}><strong>{list.name || "New list"}</strong>{items.map((item, index) => ({ item, index })).filter(({ item }) => item.listKey === list.key).map(({ item, index }) => {
        const checked = checkedItems.includes(index);
        return <button type="button" key={`${item.listKey}-${item.title}-${index}`} className={checked ? "checked" : ""} onClick={() => setCheckedItems((current) => checked ? current.filter((value) => value !== index) : [...current, index].sort((a, b) => a - b))}><span>{checked ? "✓" : ""}</span>{item.title}</button>;
      })}</section>) : <p>Add items to a list below to try them here.</p>}
    </div>}
    {!expanded && <div className="preview-progress" role="progressbar" aria-label="Preview progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}><span style={{ width: `${progressValue}%` }} /></div>}
  </section>;
}

function PreviewTracker({ tracker, count, onChange }: { tracker: RoutineAmount; count: number; onChange: (count: number) => void }) {
  const kind = trackerKind(tracker);
  if (kind === "amount") return <div className="preview-amount-row"><strong>{tracker.name}</strong><div className="preview-quantity" style={{ "--preview-segments": tracker.targetCount } as React.CSSProperties}>
    {Array.from({ length: tracker.targetCount }, (_, index) => { const value = index + 1; const filled = value <= count; return <button type="button" key={value} className={filled ? "filled" : ""} onClick={() => onChange(filled ? value - 1 : value)}>{filled ? "✓" : value}</button>; })}
  </div></div>;
  if (kind === "rating") return <div className="preview-amount-row"><strong>{tracker.name}</strong><div className="preview-rating">{Array.from({ length: 5 }, (_, index) => <button type="button" key={index} className={index < count ? "filled" : ""} onClick={() => onChange(index + 1)}>★</button>)}</div></div>;
  if (kind === "avoidance") return <div className="preview-amount-row"><strong>{tracker.name}</strong><button type="button" className={`preview-generic-tracker${count ? " filled" : ""}`} onClick={() => onChange(count ? 0 : 1)}>{count ? "✓ I avoided this today" : "I avoided this today"}</button></div>;
  if (kind === "note" || kind === "photo") return <div className="preview-amount-row"><strong>{tracker.name}</strong><button type="button" className={`preview-generic-tracker${count ? " filled" : ""}`} onClick={() => onChange(count ? 0 : 1)}>{count ? `✓ ${kind === "note" ? "Note added" : "Photo added"}` : `Add ${kind}`}</button></div>;
  if (kind === "number") return <div className="preview-amount-row"><strong>{tracker.name}</strong><label className="preview-number-entry"><input type="number" min="0" step="1" value={count || ""} onChange={(event) => onChange(Math.max(0, Math.round(Number(event.target.value) || 0)))} placeholder="Amount" /><span>{tracker.unit || ""}</span></label></div>;
  if (kind === "timer") return <div className="preview-amount-row"><strong>{tracker.name}</strong><div className="preview-stepper"><button type="button" onClick={() => onChange(Math.max(0, count - 60))}>−</button><span>{formatTimerSeconds(count)} / {tracker.targetCount}:00</span><button type="button" onClick={() => onChange(Math.min(tracker.targetCount * 60, count + 60))}>+</button></div></div>;
  return <div className="preview-amount-row"><strong>{tracker.name}</strong><div className="preview-stepper"><button type="button" onClick={() => onChange(Math.max(0, count - 5))}>−</button><span>{count}/{tracker.targetCount} {tracker.unit}</span><button type="button" onClick={() => onChange(Math.min(tracker.targetCount, count + 5))}>+</button></div></div>;
}

function AddRoutineForm({ template, onSubmit, onCancel, saving, usedEmojis, usedColors }: { template: RoutineTemplate | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; saving: boolean; usedEmojis: string[]; usedColors: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const stepLockRef = useRef(false);
  const stepTimerRef = useRef<number | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [stepSettling, setStepSettling] = useState(false);
  const [selectedDays, setSelectedDays] = useState(() => template?.days ?? DAY_NAMES.map((_, day) => day));
  const [previewName, setPreviewName] = useState(template?.name ?? "");
  const [previewEmoji, setPreviewEmoji] = useState(template?.emoji ?? EMOJIS[0]);
  const [previewColor, setPreviewColor] = useState(template?.color ?? COLORS[8]);
  const [previewLists, setPreviewLists] = useState<RoutineListDraft[]>(template?.lists ?? []);
  const [previewAmounts, setPreviewAmounts] = useState<RoutineAmount[]>(template?.amounts ?? []);
  const [hideUsedEmojis, setHideUsedEmojis] = useState(false);
  const [hideUsedColors, setHideUsedColors] = useState(false);
  const usedColorKeys = useMemo(() => new Set(usedColors.map((color) => color.toLowerCase())), [usedColors]);
  const availableEmojis = hideUsedEmojis ? EMOJIS.filter((emoji) => !usedEmojis.includes(emoji)) : EMOJIS;
  const availableColors = hideUsedColors ? COLORS.filter((color) => !usedColorKeys.has(color.toLowerCase())) : COLORS;
  const toggleUsedEmojis = (checked: boolean) => {
    setHideUsedEmojis(checked);
    if (checked && usedEmojis.includes(previewEmoji)) setPreviewEmoji(EMOJIS.find((emoji) => !usedEmojis.includes(emoji)) ?? previewEmoji);
  };
  const toggleUsedColors = (checked: boolean) => {
    setHideUsedColors(checked);
    if (checked && usedColorKeys.has(previewColor.toLowerCase())) setPreviewColor(COLORS.find((color) => !usedColorKeys.has(color.toLowerCase())) ?? previewColor);
  };
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      if (stepTimerRef.current) window.clearTimeout(stepTimerRef.current);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel]);

  const keepModalAligned = (input: HTMLInputElement) => {
    const modal = input.closest(".add-routine-modal");
    window.requestAnimationFrame(() => {
      if (modal instanceof HTMLElement) modal.scrollLeft = 0;
    });
  };

  const steps = [
    { title: "The basics", note: "Name it and choose when it happens." },
    { title: "How to track it", note: "Choose the check-off style that fits." },
    { title: "Plan by day", note: "Choose when it repeats and what each day tracks." },
    { title: "Make it yours", note: "Pick the icon and color that feel right." },
  ];

  const moveToStep = (nextStep: number) => {
    if (stepLockRef.current) return;
    if (nextStep > step && step === 0) {
      const nameInput = formRef.current?.elements.namedItem("name");
      if (nameInput instanceof HTMLInputElement && !nameInput.reportValidity()) return;
    }
    if (nextStep > step && step === 1) {
      const invalidTrackingInput = formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(".tracking-block input:invalid, .tracking-block textarea:invalid");
      if (invalidTrackingInput && !invalidTrackingInput.reportValidity()) return;
    }
    stepLockRef.current = true;
    setStepSettling(true);
    setStep(Math.min(steps.length - 1, Math.max(0, nextStep)));
    window.requestAnimationFrame(() => formRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    stepTimerRef.current = window.setTimeout(() => {
      stepLockRef.current = false;
      setStepSettling(false);
    }, 260);
  };

  const submitWizard = (event: FormEvent<HTMLFormElement>) => {
    if (stepLockRef.current) {
      event.preventDefault();
      return;
    }
    if (step < steps.length - 1) {
      event.preventDefault();
      moveToStep(step + 1);
      return;
    }
    onSubmit(event);
  };

  return createPortal(<div className="add-modal-backdrop routine-builder-page">
  <BlobCorners className="creation-background-blobs" />
  <div className="add-modal-stack">
  <div className={`add-form-shell step-tone-${step + 1}`}>
  <form ref={formRef} className="add-card add-routine-modal" onSubmit={submitWizard} role="dialog" aria-modal="true" aria-label="Add a routine">
    <header className="routine-wizard-header">
      <button type="button" className="app-page-back routine-builder-back" onClick={() => step === 0 ? onCancel() : moveToStep(step - 1)} aria-label={step === 0 ? "Close routine builder" : "Go back to previous step"}><ChevronLeft aria-hidden="true" /></button>
      <div className="routine-wizard-header-content">
        <div key={step} className="wizard-heading" aria-live="polite"><span>Step {step + 1} of {steps.length}</span><h2>{steps[step].title}</h2><p>{steps[step].note}</p></div>
        <div className="wizard-progress" role="progressbar" aria-label="Add routine progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
          {steps.map((item, index) => <i key={item.title} className={index <= step ? "active" : ""} />)}
        </div>
      </div>
    </header>
    <div className="form-grid">
      <section className="wizard-step" hidden={step !== 0} aria-label="Routine details">
        <label className="field wide"><span>Routine name</span><input name="name" value={previewName} onChange={(event) => setPreviewName(event.target.value)} placeholder="e.g. Take vitamins" required maxLength={40} autoFocus /></label>
        <TimeField defaultValue={template?.time ?? ""} />
        <DateRangeSettings startDate={template?.startDate} endDate={template?.endDate} />
      </section>
      <section className="wizard-step" hidden={step !== 1} aria-label="Tracking style">
        <TrackingBuilder lists={previewLists} amounts={previewAmounts} onListsChange={setPreviewLists} onAmountsChange={setPreviewAmounts} />
      </section>
      <section className="wizard-step" hidden={step !== 2} aria-label="Day-specific tracking">
        <DayPlanSettings scheduledDays={selectedDays} onScheduledDaysChange={setSelectedDays} lists={previewLists} amounts={previewAmounts} variants={template?.dayVariants} />
      </section>
      <section className="wizard-step" hidden={step !== 3} aria-label="Appearance">
        <UniqueChoiceToggles hideUsedEmojis={hideUsedEmojis} hideUsedColors={hideUsedColors} onEmojisChange={toggleUsedEmojis} onColorsChange={toggleUsedColors} />
        <IconPicker availableEmojis={availableEmojis} selectedEmoji={previewEmoji} onSelect={(emoji, input) => { setPreviewEmoji(emoji); keepModalAligned(input); }} />
        <fieldset className="color-picker"><legend>Color</legend><ScrollablePicker label="Color" wrap>{availableColors.map((color) => <label key={color}><input type="radio" name="color" value={color} checked={previewColor.toLowerCase() === color.toLowerCase()} onChange={(event) => { setPreviewColor(color); keepModalAligned(event.currentTarget); }} /><span style={{ background: color }} /></label>)}</ScrollablePicker></fieldset>
      </section>
    </div>
    <div className="form-actions wizard-actions">
      {step < steps.length - 1 ? <button type="button" className="primary-button premium-action" onClick={() => moveToStep(step + 1)} aria-disabled={stepSettling}>Next</button> : <button className="primary-button premium-action" disabled={saving} aria-disabled={saving || stepSettling}>{saving ? "Saving…" : template?.id.startsWith("duplicate-") ? "Save duplicate" : "Add routine"}</button>}
    </div>
  </form>
  <VerticalScrollIndicator scrollerRef={formRef} label="Add routine form" />
  </div>
  </div>
  </div>, document.body);
}

function UniqueChoiceToggles({ hideUsedEmojis, hideUsedColors, onEmojisChange, onColorsChange }: { hideUsedEmojis: boolean; hideUsedColors: boolean; onEmojisChange: (checked: boolean) => void; onColorsChange: (checked: boolean) => void }) {
  return <section className="choice-uniqueness" aria-label="Keep choices unique">
    <header><strong>Keep choices unique</strong><small>Optional</small></header>
    <div className="choice-uniqueness-grid">
      <label className="choice-toggle">
        <input type="checkbox" checked={hideUsedEmojis} onChange={(event) => onEmojisChange(event.target.checked)} />
        <span className="toggle-track"><i /></span>
        <span><strong>Don’t reuse icons</strong><small>Hide icons already in use</small></span>
      </label>
      <label className="choice-toggle">
        <input type="checkbox" checked={hideUsedColors} onChange={(event) => onColorsChange(event.target.checked)} />
        <span className="toggle-track"><i /></span>
        <span><strong>Don’t reuse colors</strong><small>Hide colors already in use</small></span>
      </label>
    </div>
  </section>;
}

function IconPicker({ availableEmojis, selectedEmoji, onSelect }: { availableEmojis: string[]; selectedEmoji: string; onSelect: (emoji: string, input: HTMLInputElement) => void }) {
  const [category, setCategory] = useState<IconCategoryId>("all");
  const [showAllIcons, setShowAllIcons] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const previewEndRef = useRef<HTMLLabelElement>(null);
  const [gridHeights, setGridHeights] = useState({ collapsed: 0, expanded: 0 });
  const availableSet = useMemo(() => new Set(availableEmojis), [availableEmojis]);
  const categoryEmojis = category === "all"
    ? availableEmojis
    : (ICON_CATEGORIES.find((item) => item.id === category)?.icons ?? []).filter((emoji) => availableSet.has(emoji));
  const displayEmojis = categoryEmojis;
  useLayoutEffect(() => {
    if (category !== "all") return;
    const grid = gridRef.current;
    const previewEnd = previewEndRef.current;
    if (!grid || !previewEnd) return;
    const measure = () => {
      const gridTop = grid.getBoundingClientRect().top;
      const previewBottom = previewEnd.getBoundingClientRect().bottom;
      const gridBottomBuffer = 8;
      const next = {
        collapsed: Math.ceil(previewBottom - gridTop) + gridBottomBuffer,
        expanded: grid.scrollHeight + gridBottomBuffer,
      };
      setGridHeights((current) => current.collapsed === next.collapsed && current.expanded === next.expanded ? current : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [category, displayEmojis.length, selectedEmoji]);
  const chooseCategory = (nextCategory: IconCategoryId) => {
    setCategory(nextCategory);
    setShowAllIcons(false);
  };
  const animatedGridHeight = category === "all" && gridHeights.collapsed
    ? `${showAllIcons ? gridHeights.expanded : gridHeights.collapsed}px`
    : undefined;

  return <fieldset className="emoji-picker">
    <legend>Icon</legend>
    <input type="hidden" name="emoji" value={selectedEmoji} />
    <div className="icon-category-tabs" role="tablist" aria-label="Icon categories">
      <button type="button" role="tab" aria-selected={category === "all"} className={`all-category${category === "all" ? " active" : ""}`} onClick={() => chooseCategory("all")}><span aria-hidden="true">✦</span>All</button>
      {ICON_CATEGORIES.map((item, index) => <button type="button" role="tab" aria-selected={category === item.id} className={category === item.id ? "active" : ""} style={{ "--category-color": EASY_CATEGORY_COLORS[index % EASY_CATEGORY_COLORS.length], "--category-active-ink": index % EASY_CATEGORY_COLORS.length === 2 ? "#624900" : "#fff" } as React.CSSProperties} onClick={() => chooseCategory(item.id)} key={item.id}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
    </div>
    <div className={`emoji-grid-expander${category === "all" ? " is-all" : ""}${showAllIcons ? " expanded" : ""}`} style={{ height: animatedGridHeight }} role="tabpanel" aria-label={`${category === "all" ? "All" : ICON_CATEGORIES.find((item) => item.id === category)?.label} icons`}>
    <div ref={gridRef} className="emoji-category-grid">
      {displayEmojis.map((emoji, index) => {
        const hiddenByCollapse = category === "all" && !showAllIcons && index >= ALL_ICON_PREVIEW_COUNT;
        return <label ref={category === "all" && index === ALL_ICON_PREVIEW_COUNT - 1 ? previewEndRef : undefined} aria-hidden={hiddenByCollapse || undefined} inert={hiddenByCollapse || undefined} key={emoji}><input type="radio" name="emoji-option" value={emoji} checked={selectedEmoji === emoji} onChange={(event) => onSelect(emoji, event.currentTarget)} /><span>{emoji}</span></label>;
      })}
      {!displayEmojis.length && <p className="icon-category-empty">All icons in this category are already in use.</p>}
    </div>
    </div>
    {category === "all" && categoryEmojis.length > ALL_ICON_PREVIEW_COUNT && <button type="button" className="icon-view-more" aria-expanded={showAllIcons} onClick={() => setShowAllIcons((visible) => !visible)}>{showAllIcons ? "Show less" : `View more icons (${categoryEmojis.length - ALL_ICON_PREVIEW_COUNT})`}</button>}
  </fieldset>;
}

function RoutineOptionsEditor({ routine, onSubmit, onCancel, saving, usedEmojis, usedColors }: { routine: Routine; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; saving: boolean; usedEmojis: string[]; usedColors: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const stepLockRef = useRef(false);
  const stepTimerRef = useRef<number | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [stepSettling, setStepSettling] = useState(false);
  const [selectedDays, setSelectedDays] = useState(() => [...routine.days]);
  const [lists, setLists] = useState<RoutineListDraft[]>(() => routine.lists.map((list) => ({ ...list, items: routine.items.filter((item) => item.listKey === list.key).map((item) => item.title).join("\n") })));
  const [amounts, setAmounts] = useState<RoutineAmount[]>(() => routine.amounts);
  const [selectedEmoji, setSelectedEmoji] = useState(routine.emoji);
  const [selectedColor, setSelectedColor] = useState(routine.color);
  const [hideUsedEmojis, setHideUsedEmojis] = useState(false);
  const [hideUsedColors, setHideUsedColors] = useState(false);
  const usedColorKeys = useMemo(() => new Set(usedColors.map((color) => color.toLowerCase())), [usedColors]);
  const availableEmojis = hideUsedEmojis ? EMOJIS.filter((emoji) => !usedEmojis.includes(emoji)) : EMOJIS;
  const availableColors = hideUsedColors ? COLORS.filter((color) => !usedColorKeys.has(color.toLowerCase())) : COLORS;
  const toggleUsedEmojis = (checked: boolean) => {
    setHideUsedEmojis(checked);
    if (checked && usedEmojis.includes(selectedEmoji)) setSelectedEmoji(EMOJIS.find((emoji) => !usedEmojis.includes(emoji)) ?? selectedEmoji);
  };
  const toggleUsedColors = (checked: boolean) => {
    setHideUsedColors(checked);
    if (checked && usedColorKeys.has(selectedColor.toLowerCase())) setSelectedColor(COLORS.find((color) => !usedColorKeys.has(color.toLowerCase())) ?? selectedColor);
  };
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      if (stepTimerRef.current) window.clearTimeout(stepTimerRef.current);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel]);

  const keepModalAligned = (input: HTMLInputElement) => {
    const modal = input.closest(".add-routine-modal");
    window.requestAnimationFrame(() => {
      if (modal instanceof HTMLElement) modal.scrollLeft = 0;
    });
  };

  const steps = [
    { title: "The basics", note: "Update its name and when it happens." },
    { title: "How to track it", note: "Adjust its tracking styles." },
    { title: "Plan by day", note: "Choose when it repeats and what each day tracks." },
    { title: "Make it yours", note: "Change its icon and color." },
  ];

  const moveToStep = (nextStep: number) => {
    if (stepLockRef.current) return;
    if (nextStep > step && step === 0) {
      const nameInput = formRef.current?.elements.namedItem("name");
      if (nameInput instanceof HTMLInputElement && !nameInput.reportValidity()) return;
    }
    if (nextStep > step && step === 1) {
      const invalidTrackingInput = formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(".tracking-block input:invalid, .tracking-block textarea:invalid");
      if (invalidTrackingInput && !invalidTrackingInput.reportValidity()) return;
    }
    stepLockRef.current = true;
    setStepSettling(true);
    setStep(Math.min(steps.length - 1, Math.max(0, nextStep)));
    window.requestAnimationFrame(() => formRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    stepTimerRef.current = window.setTimeout(() => {
      stepLockRef.current = false;
      setStepSettling(false);
    }, 260);
  };

  const submitWizard = (event: FormEvent<HTMLFormElement>) => {
    if (stepLockRef.current) {
      event.preventDefault();
      return;
    }
    if (step < steps.length - 1) {
      event.preventDefault();
      moveToStep(step + 1);
      return;
    }
    onSubmit(event);
  };

  return createPortal(<div className="add-modal-backdrop routine-builder-page edit-routine-page">
  <BlobCorners className="creation-background-blobs" />
  <div className="add-modal-stack">
  <div className={`add-form-shell step-tone-${step + 1}`}>
  <form ref={formRef} className="add-card add-routine-modal edit-routine-wizard" onSubmit={submitWizard} role="dialog" aria-modal="true" aria-label={`Edit ${routine.name}`}>
    <header className="routine-wizard-header">
      <button type="button" className="app-page-back routine-builder-back" onClick={() => step === 0 ? onCancel() : moveToStep(step - 1)} aria-label={step === 0 ? "Close routine editor" : "Go back to previous step"}><ChevronLeft aria-hidden="true" /></button>
      <div className="routine-wizard-header-content">
        <div key={step} className="wizard-heading" aria-live="polite"><span>Step {step + 1} of {steps.length}</span><h2>{steps[step].title}</h2><p>{steps[step].note}</p></div>
        <div className="wizard-progress" role="progressbar" aria-label="Edit routine progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>{steps.map((item, index) => <i key={item.title} className={index <= step ? "active" : ""} />)}</div>
      </div>
    </header>
    <div className="form-grid">
      <section className="wizard-step" hidden={step !== 0} aria-label="Routine details">
        <label className="field wide"><span>Routine name</span><input name="name" defaultValue={routine.name} placeholder="e.g. Take vitamins" required maxLength={40} autoFocus /></label>
        <TimeField defaultValue={routine.time} />
        <DateRangeSettings startDate={routine.startDate} endDate={routine.endDate} />
      </section>
      <section className="wizard-step" hidden={step !== 1} aria-label="Tracking style">
        <TrackingBuilder lists={lists} amounts={amounts} onListsChange={setLists} onAmountsChange={setAmounts} />
      </section>
      <section className="wizard-step" hidden={step !== 2} aria-label="Day-specific tracking">
        <DayPlanSettings scheduledDays={selectedDays} onScheduledDaysChange={setSelectedDays} lists={lists} amounts={amounts} variants={routine.dayVariants} />
      </section>
      <section className="wizard-step" hidden={step !== 3} aria-label="Appearance">
        <UniqueChoiceToggles hideUsedEmojis={hideUsedEmojis} hideUsedColors={hideUsedColors} onEmojisChange={toggleUsedEmojis} onColorsChange={toggleUsedColors} />
        <IconPicker availableEmojis={availableEmojis} selectedEmoji={selectedEmoji} onSelect={(emoji, input) => { setSelectedEmoji(emoji); keepModalAligned(input); }} />
        <fieldset className="color-picker"><legend>Color</legend><ScrollablePicker label="Color" wrap>{availableColors.map((color) => <label key={color}><input type="radio" name="color" value={color} checked={selectedColor.toLowerCase() === color.toLowerCase()} onChange={(event) => { setSelectedColor(color); keepModalAligned(event.currentTarget); }} /><span style={{ background: color }} /></label>)}</ScrollablePicker></fieldset>
      </section>
    </div>
    <div className="form-actions wizard-actions">{step < steps.length - 1 ? <button type="button" className="primary-button premium-action" onClick={() => moveToStep(step + 1)} aria-disabled={stepSettling}>Next</button> : <button className="primary-button premium-action" disabled={saving} aria-disabled={saving || stepSettling}>{saving ? "Saving…" : "Save routine"}</button>}</div>
  </form>
  <VerticalScrollIndicator scrollerRef={formRef} label="Edit routine form" />
  </div>
  </div>
  </div>, document.body);
}

function ScrollablePicker({ label, children, className = "", scrollClassName = "", wrap = false }: { label: string; children: ReactNode; className?: string; scrollClassName?: string; wrap?: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const dragOffsetRef = useRef(0);
  const [thumb, setThumb] = useState({ left: 0, width: 100 });
  const [dragging, setDragging] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  const updateIndicator = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    setScrollable(maxScroll > 1);
    const boundedScroll = Math.min(maxScroll, Math.max(0, scroller.scrollLeft));
    const width = Math.max(22, Math.min(100, (scroller.clientWidth / scroller.scrollWidth) * 100));
    const left = maxScroll ? (boundedScroll / maxScroll) * (100 - width) : 0;
    setThumb({ left, width });
  };

  const scrollFromThumb = (clientX: number) => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    const thumbButton = thumbRef.current;
    if (!scroller || !track || !thumbButton) return;
    const trackRect = track.getBoundingClientRect();
    const maxThumbLeft = Math.max(0, track.clientWidth - thumbButton.offsetWidth);
    const nextThumbLeft = Math.min(maxThumbLeft, Math.max(0, clientX - trackRect.left - dragOffsetRef.current));
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollLeft = maxThumbLeft ? (nextThumbLeft / maxThumbLeft) * maxScroll : 0;
  };

  const beginThumbDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragOffsetRef.current = event.clientX - event.currentTarget.getBoundingClientRect().left;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const moveThumb = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) scrollFromThumb(event.clientX);
  };

  const endThumbDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  const moveThumbWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const direction = event.key === "ArrowRight" ? 1 : -1;
    scroller.scrollTo({ left: scroller.scrollLeft + direction * Math.max(48, scroller.clientWidth * .45), behavior: "smooth" });
  };

  useEffect(() => {
    if (wrap) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const frame = window.requestAnimationFrame(updateIndicator);
    const observer = new ResizeObserver(updateIndicator);
    const mutationObserver = new MutationObserver(() => window.requestAnimationFrame(updateIndicator));
    observer.observe(scroller);
    mutationObserver.observe(scroller, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [wrap]);

  return <div className={`picker-shell${className ? ` ${className}` : ""}`}>
    <div ref={scrollerRef} className={`picker-scroll${wrap ? " picker-wrap" : ""}${scrollClassName ? ` ${scrollClassName}` : ""}`} onScroll={wrap ? undefined : updateIndicator} tabIndex={0} role="group" aria-label={wrap ? `${label} choices.` : `${label} choices. Scroll horizontally for more.`}>{children}</div>
    {!wrap && scrollable && <div ref={trackRef} className="picker-scrollbar">
      <button ref={thumbRef} type="button" className={`picker-thumb${dragging ? " dragging" : ""}`} style={{ left: `calc(${thumb.left}% + 1px)`, width: `calc(${thumb.width}% - 2px)` }} aria-label={`Scroll ${label} choices`} onPointerDown={beginThumbDrag} onPointerMove={moveThumb} onPointerUp={endThumbDrag} onPointerCancel={endThumbDrag} onLostPointerCapture={() => setDragging(false)} onKeyDown={moveThumbWithKeyboard} />
    </div>}
  </div>;
}

function VerticalScrollIndicator<T extends HTMLElement>({ scrollerRef, label, className = "", headerSelector = ".routine-wizard-header" }: { scrollerRef: RefObject<T | null>; label: string; className?: string; headerSelector?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const dragOffsetRef = useRef(0);
  const [thumb, setThumb] = useState({ top: 0, height: 100 });
  const [trackTop, setTrackTop] = useState(12);
  const [dragging, setDragging] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  const updateIndicator = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const stickyHeader = scroller.querySelector<HTMLElement>(headerSelector);
    setTrackTop(stickyHeader ? Math.ceil(stickyHeader.getBoundingClientRect().height) + 6 : 12);
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    setScrollable(maxScroll > 1);
    const boundedScroll = Math.min(maxScroll, Math.max(0, scroller.scrollTop));
    const height = Math.max(12, Math.min(100, (scroller.clientHeight / scroller.scrollHeight) * 100));
    const top = maxScroll ? (boundedScroll / maxScroll) * (100 - height) : 0;
    setThumb({ top, height });
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const frame = window.requestAnimationFrame(updateIndicator);
    const resizeObserver = new ResizeObserver(updateIndicator);
    const mutationObserver = new MutationObserver(updateIndicator);
    resizeObserver.observe(scroller);
    mutationObserver.observe(scroller, { childList: true, subtree: true, attributes: true });
    scroller.addEventListener("scroll", updateIndicator, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      scroller.removeEventListener("scroll", updateIndicator);
    };
  }, [scrollerRef, headerSelector]);

  const scrollFromThumb = (clientY: number) => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    const thumbButton = thumbRef.current;
    if (!scroller || !track || !thumbButton) return;
    const trackRect = track.getBoundingClientRect();
    const maxThumbTop = Math.max(0, track.clientHeight - thumbButton.offsetHeight);
    const nextThumbTop = Math.min(maxThumbTop, Math.max(0, clientY - trackRect.top - dragOffsetRef.current));
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = maxThumbTop ? (nextThumbTop / maxThumbTop) * maxScroll : 0;
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragOffsetRef.current = event.clientY - event.currentTarget.getBoundingClientRect().top;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const amounts: Record<string, number> = { ArrowUp: -48, ArrowDown: 48, PageUp: -scroller.clientHeight * .8, PageDown: scroller.clientHeight * .8 };
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      scroller.scrollTo({ top: event.key === "Home" ? 0 : scroller.scrollHeight, behavior: "smooth" });
    } else if (event.key in amounts) {
      event.preventDefault();
      scroller.scrollTo({ top: scroller.scrollTop + amounts[event.key], behavior: "smooth" });
    }
  };

  if (!scrollable) return null;

  return <div ref={trackRef} className={`modal-scrollbar${className ? ` ${className}` : ""}`} style={{ top: `${trackTop}px` }}>
    <button ref={thumbRef} type="button" className={`modal-scroll-thumb${dragging ? " dragging" : ""}`} style={{ top: `calc(${thumb.top}% + 1px)`, height: `calc(${thumb.height}% - 2px)` }} aria-label={`Scroll ${label}`} onPointerDown={beginDrag} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) scrollFromThumb(event.clientY); }} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => setDragging(false)} onKeyDown={handleKeyDown} />
  </div>;
}

function TrackingBuilder({ lists, amounts, onListsChange, onAmountsChange }: { lists: RoutineListDraft[]; amounts: RoutineAmount[]; onListsChange: (lists: RoutineListDraft[]) => void; onAmountsChange: (amounts: RoutineAmount[]) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const trackingMode = trackingModeFor(lists, amounts);
  const makeKey = (type: string, count: number) => `${type}-${Date.now().toString(36)}-${count + 1}`;
  const addList = () => {
    if (lists.length >= 6) return;
    onListsChange([...lists, { key: makeKey("list", lists.length), name: "", items: "" }]);
    setMenuOpen(false);
  };
  const addTracker = (kind: TrackerKind) => {
    if (amounts.length >= 10) return;
    const targetCount = kind === "amount" ? 4 : kind === "duration" || kind === "timer" ? 30 : 1;
    const unit = kind === "duration" || kind === "timer" ? "min" : kind === "rating" ? "stars" : "";
    onAmountsChange([...amounts, { key: makeKey(kind, amounts.length), name: "", targetCount, kind, unit }]);
    setMenuOpen(false);
  };
  const options: Array<{ kind: TrackerKind; symbol: string; label: string; note: string }> = [
    { kind: "amount", symbol: "▥", label: "Daily amount", note: "Count pills, glasses, or repetitions" },
    { kind: "timer", symbol: "▶", label: "Timer", note: "Pause and resume one running total" },
    { kind: "rating", symbol: "★", label: "Rating", note: "Rate the day from one to five" },
    { kind: "number", symbol: "#", label: "Number entry", note: "Save a daily measurement" },
    { kind: "note", symbol: "✎", label: "Note", note: "Write a short daily entry" },
    { kind: "photo", symbol: "▣", label: "Photo", note: "Attach a daily progress image" },
    { kind: "avoidance", symbol: "⊘", label: "Avoided habit", note: "Check off something you avoided today" },
  ];
  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuWrapRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);
  return <fieldset className={`tracking-builder${menuOpen ? " menu-open" : ""}`} aria-label="Tracking options">
    <input type="hidden" name="trackingMode" value={trackingMode} />
    <input type="hidden" name="lists" value={JSON.stringify(lists)} />
    <input type="hidden" name="amounts" value={JSON.stringify(amounts)} />
    <div ref={menuWrapRef} className="tracking-add-wrap">
      <button type="button" className="tracking-add-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-haspopup="menu" aria-controls="tracking-add-menu">+ Add tracking</button>
      {menuOpen && <div id="tracking-add-menu" className="tracking-add-menu" role="menu">
        <button type="button" role="menuitem" onClick={addList} disabled={lists.length >= 6}><span aria-hidden="true">☷</span><div><strong>List</strong><small>Named steps to check off</small></div></button>
        {options.map((option) => <button type="button" role="menuitem" key={option.kind} onClick={() => addTracker(option.kind)} disabled={amounts.length >= 10}><span aria-hidden="true">{option.symbol}</span><div><strong>{option.label}</strong><small>{option.note}</small></div></button>)}
      </div>}
    </div>
    {!lists.length && !amounts.length && <p className="tracking-empty-hint">Choose what you want to check off, count, time, or record.</p>}
    <div className="tracking-blocks">
      {lists.map((list, index) => <section className="tracking-block tracking-list-block" key={list.key}>
        <header><span aria-hidden="true">☷</span><strong>List</strong><button type="button" onClick={() => onListsChange(lists.filter((item) => item.key !== list.key))} aria-label={`Remove ${list.name || `list ${index + 1}`}`}><Trash2 aria-hidden="true" /></button></header>
        <label className="field"><span>List name</span><input value={list.name} onChange={(event) => onListsChange(lists.map((item) => item.key === list.key ? { ...item, name: event.target.value } : item))} placeholder="e.g. Morning checklist" maxLength={24} required /></label>
        <label className="field"><span>Items <small>One per line</small></span><textarea value={list.items} onChange={(event) => onListsChange(lists.map((item) => item.key === list.key ? { ...item, items: event.target.value } : item))} placeholder={"First step\nSecond step\nThird step"} maxLength={1000} required /></label>
      </section>)}
      {amounts.map((amount, index) => {
        const kind = trackerKind(amount);
        const symbols: Record<TrackerKind, string> = { amount: "▥", duration: "◴", timer: "▶", rating: "★", number: "#", note: "✎", photo: "▣", avoidance: "⊘" };
        const placeholders: Record<TrackerKind, string> = { amount: "e.g. Vitamin C", duration: "e.g. Meditation", timer: "e.g. Focus session", rating: "e.g. Energy", number: "e.g. Pages read", note: "e.g. Daily reflection", photo: "e.g. Progress photo", avoidance: "e.g. Drinking soda" };
        const update = (next: Partial<RoutineAmount>) => onAmountsChange(amounts.map((item) => item.key === amount.key ? { ...item, ...next } : item));
        return <section className={`tracking-block tracking-amount-block tracking-kind-${kind}`} key={amount.key}>
          <header><span aria-hidden="true">{symbols[kind]}</span><strong>{trackerKindLabel(amount)}</strong><button type="button" onClick={() => onAmountsChange(amounts.filter((item) => item.key !== amount.key))} aria-label={`Remove ${amount.name || `tracker ${index + 1}`}`}><Trash2 aria-hidden="true" /></button></header>
          <div className={`tracking-amount-fields${kind === "rating" || kind === "note" || kind === "photo" || kind === "avoidance" ? " single" : ""}`}><label className="field"><span>Name</span><input value={amount.name} onChange={(event) => update({ name: event.target.value })} placeholder={placeholders[kind]} maxLength={24} required /></label>
          {kind === "amount" && <label className="field"><span>Amount</span><input type="number" min="2" max="12" value={amount.targetCount} onChange={(event) => update({ targetCount: Math.min(12, Math.max(2, Number(event.target.value) || 2)) })} required /></label>}
          {(kind === "duration" || kind === "timer") && <label className="field"><span>Goal minutes</span><input type="number" min="1" max="1440" value={amount.targetCount} onChange={(event) => update({ targetCount: Math.min(1440, Math.max(1, Number(event.target.value) || 1)), unit: "min" })} required /></label>}
          {kind === "number" && <label className="field tracking-unit-field"><span>Unit <small>Optional</small></span><input value={amount.unit ?? ""} onChange={(event) => update({ unit: event.target.value })} placeholder="pages" maxLength={16} /></label>}
          </div>
          {kind === "rating" && <p className="tracking-type-note">A rating is complete after choosing 1–5 stars.</p>}
          {kind === "number" && <p className="tracking-type-note">Enter any amount for the day—there is no goal to reach.</p>}
          {kind === "note" && <p className="tracking-type-note">A saved note completes this tracker for the day.</p>}
          {kind === "photo" && <p className="tracking-type-note">Images are stored privately with the routine.</p>}
          {kind === "avoidance" && <p className="tracking-type-note">Check “I avoided this today” when you did not do the habit.</p>}
        </section>;
      })}
    </div>
  </fieldset>;
}

function DateRangeSettings({ startDate = "", endDate = "" }: { startDate?: string; endDate?: string }) {
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  const [expanded, setExpanded] = useState(Boolean(startDate || endDate));
  return <section className="date-range-settings">
    <button type="button" className="date-range-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
      <span><strong>Active dates</strong><small>{start || end ? `${start ? formatShortDate(start) : "Anytime"} – ${end ? formatShortDate(end) : "Ongoing"}` : "Optional · add a start or stop date"}</small></span>
      <i aria-hidden="true" />
    </button>
    {!expanded && <><input type="hidden" name="startDate" value={start} /><input type="hidden" name="endDate" value={end} /></>}
    {expanded && <div className="date-range-fields">
      <label className="field"><span>Start date</span><span className="date-input-wrap"><input name="startDate" type="date" value={start} max={end || undefined} onChange={(event) => setStart(event.target.value)} /><button type="button" onClick={() => setStart("")} disabled={!start}>Clear</button></span></label>
      <label className="field"><span>Stop date</span><span className="date-input-wrap"><input name="endDate" type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} /><button type="button" onClick={() => setEnd("")} disabled={!end}>Clear</button></span></label>
    </div>}
  </section>;
}

function TimeField({ defaultValue = "", onValueChange }: { defaultValue?: string; onValueChange?: (value: string) => void }) {
  const [time, setTime] = useState(defaultValue);
  const updateTime = (value: string) => {
    setTime(value);
    onValueChange?.(value);
  };
  return <label className="field"><span>Time <small>Optional</small></span><span className="date-input-wrap time-input-wrap"><input name="time" type="time" value={time} onChange={(event) => updateTime(event.target.value)} /><button type="button" onClick={() => updateTime("")} disabled={!time}>Clear</button></span></label>;
}

function DayPlanSettings({ scheduledDays, onScheduledDaysChange, lists, amounts, variants = {} }: { scheduledDays: number[]; onScheduledDaysChange: (days: number[]) => void; lists: RoutineListDraft[]; amounts: RoutineAmount[]; variants?: Partial<Record<number, DayVariant>> }) {
  const [activeDay, setActiveDay] = useState(scheduledDays[0] ?? 0);
  const [plans, setPlans] = useState<Record<number, string[]>>(() => Object.fromEntries(DAY_NAMES.map((_, day) => {
    const variant = variants[day];
    if (!scheduledDays.includes(day)) return [day, []];
    return [day, typeof variant === "object" && variant?.tracking.length ? variant.tracking : ["all"]];
  })));
  const legacyLabels = useMemo(() => Object.fromEntries(Object.entries(variants).flatMap(([day, value]) => {
    const label = typeof value === "string" ? value : value?.label;
    return label ? [[day, label]] : [];
  })), [variants]);

  const trackingOptions = [
    ...lists.map((list, index) => ({ ref: `list:${list.key}`, symbol: "☷", label: list.name || `List ${index + 1}`, note: "Checklist" })),
    ...amounts.map((amount, index) => ({ ref: `amount:${amount.key}`, symbol: ({ amount: "▥", duration: "◴", timer: "▶", rating: "★", number: "#", note: "✎", photo: "▣", avoidance: "⊘" } as Record<TrackerKind, string>)[trackerKind(amount)], label: amount.name || `${trackerKindLabel(amount)} ${index + 1}`, note: trackerKindLabel(amount) })),
  ];
  const validTrackingRefs = new Set(trackingOptions.map((option) => option.ref));
  const storedTracking = plans[activeDay] ?? [];
  const activeTracking = storedTracking.includes("all") ? trackingOptions.map((option) => option.ref) : storedTracking.filter((ref) => validTrackingRefs.has(ref));
  const allTrackingSelected = trackingOptions.length ? trackingOptions.every((option) => activeTracking.includes(option.ref)) : scheduledDays.includes(activeDay);
  const dayColors = ["var(--purple)", "var(--sky)", "var(--gold)", "var(--coral)", "var(--purple)", "var(--sky)", "var(--gold)"];
  const saveTracking = (next: string[]) => {
    setPlans((current) => ({ ...current, [activeDay]: next }));
    const nextScheduledDays = DAY_NAMES.map((_, day) => day).filter((day) => day === activeDay ? next.length > 0 : (plans[day] ?? []).length > 0);
    onScheduledDaysChange(nextScheduledDays);
  };
  const updateTracking = (ref: string) => {
    const next = activeTracking.includes(ref) ? activeTracking.filter((item) => item !== ref) : [...activeTracking, ref];
    saveTracking(next);
  };
  const toggleAllTracking = () => saveTracking(allTrackingSelected ? [] : trackingOptions.length ? trackingOptions.map((option) => option.ref) : ["simple"]);
  const serializedPlans = Object.fromEntries(scheduledDays.map((day) => [String(day), {
    tracking: (plans[day] ?? []).includes("all") ? ["all"] : plans[day].filter((ref) => ref === "simple" || validTrackingRefs.has(ref)),
    ...(legacyLabels[String(day)] ? { label: legacyLabels[String(day)] } : {}),
  }]));

  return <section className="day-plan-settings">
    <input type="hidden" name="dayVariants" value={JSON.stringify(serializedPlans)} />
    {scheduledDays.map((day) => <input type="hidden" name={`day-${day}`} value="1" key={day} />)}
    <div className="day-plan-schedule">
      <header><span><strong>Choose a day</strong><small>Select its trackers below. A day with no trackers is not used.</small></span></header>
      <div className="day-plan-days choosing" role="tablist" aria-label="Choose a day to customize">
        {DAY_NAMES.map((dayName, day) => {
          const scheduled = scheduledDays.includes(day);
          const active = activeDay === day;
          return <button type="button" role="tab" aria-selected={active} aria-label={`${dayName}${scheduled ? ", used" : ", not used"}${active ? ", selected" : ""}`} className={`${scheduled ? "scheduled" : ""}${active ? " active" : ""}`} style={{ "--day-color": dayColors[day] } as React.CSSProperties} key={dayName} onClick={() => setActiveDay(day)}><span>{dayName.slice(0, 1)}</span><small>{dayName}</small></button>;
        })}
      </div>
    </div>
    <div className="day-plan-editor">
        <div className="day-plan-tracking" role="tabpanel" aria-label={`${DAY_FULL_NAMES[activeDay]} tracking`}>
          <header>
            <span className="day-plan-tracking-copy"><span>Tracking for</span><strong>{DAY_FULL_NAMES[activeDay]}</strong><small>{trackingOptions.length ? "Select any combination. Uncheck everything to leave this day unused." : "The default check is used for this day."}</small></span>
            <button type="button" className="day-plan-select-all" aria-pressed={allTrackingSelected} onClick={toggleAllTracking}>{allTrackingSelected ? (trackingOptions.length ? "Clear all" : "Remove day") : (trackingOptions.length ? "Select all" : "Use day")}</button>
          </header>
          {trackingOptions.length > 0 && <div className="day-plan-options">{trackingOptions.map((option) => {
            const selected = activeTracking.includes(option.ref);
            return <button type="button" key={option.ref} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => updateTracking(option.ref)}><span aria-hidden="true">{option.symbol}</span><span><strong>{option.label}</strong><small>{option.note}</small></span><i aria-hidden="true">✓</i></button>;
          })}</div>}
        </div>
    </div>
  </section>;
}

function LoadingRows() {
  return <div className="loading-list" aria-label="Loading routines"><i /><i /><i /></div>;
}

function EmptyToday({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><span className="empty-state-icon" aria-hidden="true"><CalendarPlus2 /></span><h3>Your day is wide open</h3><p>Add a routine and it’ll appear here on the right days.</p><button className="primary-button premium-action" onClick={onAdd}>Add your first routine</button></div>;
}
