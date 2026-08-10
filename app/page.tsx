"use client";

import { FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CalendarPlus2, ChevronLeft, ChevronRight, CircleCheckBig, CircleUserRound, Clock3, Copy, History, ListChecks, SkipForward, Settings2, Sparkles, Trash2, X, type LucideIcon } from "lucide-react";

type RoutineItem = { id: number; routineId: number; title: string; listKey: string; position: number };
type RoutineAmount = { key: string; name: string; targetCount: number };
type RoutineList = { key: string; name: string };
type RoutineListDraft = RoutineList & { items: string };
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
  dayVariants: Partial<Record<number, string>>;
  startDate: string;
  endDate: string;
  items: RoutineItem[];
};

type Completion = { routineId: number; date: string; status: "completed" | "skipped" };
type ItemCompletion = { itemId: number; date: string };
type AmountCompletion = { routineId: number; amountKey: string; date: string; count: number };
type Tab = "today" | "calendar" | "routines" | "history" | "settings";
type OnboardingState = "checking" | "show" | "done";
type TimeFormat = "12-hour" | "24-hour";
type WeekStart = "sunday" | "monday";
type MotionPreference = "full" | "reduced";
type AppPreferences = { timeFormat: TimeFormat; weekStartsOn: WeekStart; motion: MotionPreference };
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
  dayVariants?: Partial<Record<number, string>>;
  startDate?: string;
  endDate?: string;
};

const DEFAULT_PREFERENCES: AppPreferences = { timeFormat: "12-hour", weekStartsOn: "sunday", motion: "full" };
const SPLASH_DURATION_MS = 2100;

const COLORS = [
  "#6C5CE7", "#845EF7", "#8338EC", "#9C36B5", "#CC5DE8", "#8E7DBE", "#5F3DC4", "#6741D9",
  "#4D96FF", "#3A86FF", "#4263EB", "#364FC7", "#339AF0", "#1C7ED6", "#22B8CF", "#0C8599",
  "#00A896", "#2A9D8F", "#20C997", "#099268", "#49A078", "#2F9E44", "#51CF66", "#6A994E",
  "#94D82D", "#74B816", "#F4B942", "#FFBE0B", "#FCC419", "#F08C00", "#FF922B", "#E67700",
  "#FF8A65", "#FF6B35", "#E76F51", "#E8590C", "#FF6B6B", "#EF476F", "#EC6F91", "#F06595",
  "#D9485F", "#C2255C", "#C92A2A", "#8D6E63", "#A66A4C", "#6B7280", "#495057", "#212529",
];
const EMOJIS = [
  "✨", "✅", "⭐", "🎯", "⏰", "📅", "📝", "💡", "🧠", "❤️", "🙏", "🌈",
  "💊", "💉", "🩺", "🩹", "🧪", "🌡️", "🦷", "🪥", "🧴", "🧼", "🚿", "🛁",
  "💧", "😴", "🛏️", "🌙", "☀️", "🌅", "🧘", "🌬️", "💆", "🧖", "💅", "🪞",
  "🏋️", "🏃", "🚶", "🚴", "🏊", "🧗", "🤸", "⛹️", "⚽", "🏀", "🎾", "🥊",
  "🥣", "🍳", "🥑", "🥗", "🍲", "🥪", "🍝", "🍚", "🍜", "🍣", "🍞", "🥐",
  "🥞", "🥕", "🥦", "🍎", "🍊", "🍌", "🍓", "🫐", "🥜", "🥛", "☕", "🍵",
  "🥤", "🍽️", "🧹", "🧽", "🧺", "👕", "🗑️", "🪴", "🌿", "🌻", "🐕", "🐈",
  "🐾", "📚", "✍️", "💻", "📧", "📞", "💼", "💰", "🛒", "🎨", "🎵", "🎸",
  "🎮", "🧩", "📸", "🌍", "🚗", "✈️", "🎁", "👨‍👩‍👧‍👦", "🤝", "💬", "📵", "🔔",
];
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
  const variants: Record<string, string> = {};
  DAY_NAMES.forEach((_, day) => {
    const value = String(form.get(`dayVariant-${day}`) ?? "").trim();
    if (value) variants[String(day)] = value;
  });
  return variants;
}

function trackingModeFor(lists: RoutineListDraft[], amounts: RoutineAmount[]): TrackingMode {
  return lists.length && amounts.length ? "hybrid" : lists.length ? "checklist" : amounts.length ? "quantity" : "simple";
}

function readTrackingLists(form: FormData) {
  try {
    const lists = JSON.parse(String(form.get("lists") ?? "[]")) as RoutineListDraft[];
    return lists.map((list) => ({ ...list, items: list.items.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) }));
  } catch {
    return [];
  }
}

function routineActiveOnDate(routine: Routine, date: string) {
  return (!routine.startDate || date >= routine.startDate) && (!routine.endDate || date <= routine.endDate);
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
  const [onboardingState, setOnboardingState] = useState<OnboardingState>("checking");
  const [tab, setTab] = useState<Tab>("today");
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [itemCompletions, setItemCompletions] = useState<ItemCompletion[]>([]);
  const [amountCompletions, setAmountCompletions] = useState<AmountCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoutine, setSelectedRoutine] = useState<number | "all">("all");
  const [selectedHistoryRoutine, setSelectedHistoryRoutine] = useState<number | "all">("all");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [showAdd, setShowAdd] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RoutineTemplate | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [routineToDelete, setRoutineToDelete] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const addTimerRef = useRef<number | null>(null);
  const completionsRef = useRef<Completion[]>([]);
  const itemCompletionsRef = useRef<ItemCompletion[]>([]);
  const amountCompletionsRef = useRef<AmountCompletion[]>([]);
  const routineMutationQueuesRef = useRef(new Map<number, Promise<void>>());
  const today = useMemo(() => new Date(), []);
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

  function queueRoutineMutation(routineId: number, request: () => Promise<Response>) {
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
      const response = await fetch("/api/routines", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load your routines.");
      const data = await response.json();
      setRoutines(data.routines);
      completionsRef.current = data.completions;
      itemCompletionsRef.current = data.itemCompletions ?? [];
      amountCompletionsRef.current = data.amountCompletions ?? [];
      setCompletions(completionsRef.current);
      setItemCompletions(itemCompletionsRef.current);
      setAmountCompletions(amountCompletionsRef.current);
      setError("");
    } catch {
      setError("Your routines could not be loaded. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const forceOnboarding = new URLSearchParams(window.location.search).get("onboarding") === "1";
    const completed = window.localStorage.getItem("routineez-onboarding-complete") === "true";
    try {
      const savedPreferences = JSON.parse(window.localStorage.getItem("routineez-preferences") ?? "{}");
      setPreferences({ ...DEFAULT_PREFERENCES, ...savedPreferences });
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    }
    const splashTimer = window.setTimeout(() => {
      setOnboardingState(forceOnboarding || !completed ? "show" : "done");
    }, SPLASH_DURATION_MS);
    loadData();
    return () => {
      window.clearTimeout(splashTimer);
      if (addTimerRef.current !== null) window.clearTimeout(addTimerRef.current);
    };
  }, []);

  function openAddFromHeader() {
    if (addTimerRef.current !== null) window.clearTimeout(addTimerRef.current);
    setEditingRoutineId(null);
    if (tab === "routines") {
      setShowTemplatePicker(true);
      return;
    }
    setShowAdd(false);
    setTab("routines");
    addTimerRef.current = window.setTimeout(() => {
      setShowTemplatePicker(true);
      addTimerRef.current = null;
    }, 200);
  }

  function openSettings() {
    setShowProfile(false);
    setTab("settings");
  }

  function updatePreferences(next: Partial<AppPreferences>) {
    setPreferences((current) => {
      const updated = { ...current, ...next };
      window.localStorage.setItem("routineez-preferences", JSON.stringify(updated));
      return updated;
    });
  }

  function completeOnboarding(addRoutine = false) {
    window.localStorage.setItem("routineez-onboarding-complete", "true");
    if (new URLSearchParams(window.location.search).has("onboarding")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (addRoutine) {
      setTab("routines");
      setShowTemplatePicker(true);
    }
    setOnboardingState("done");
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
    const checklistDone = !usesChecklist(routine.trackingMode) || (routine.items.length > 0 && routine.items.every((item) => completedItemsToday.has(item.id)));
    const quantityDone = !usesQuantity(routine.trackingMode) || (routine.amounts.length > 0 && routine.amounts.every((amount) => amountCount(routine.id, amount.key) >= amount.targetCount));
    return routine.trackingMode === "simple" ? completedToday.has(routine.id) : checklistDone && quantityDone;
  };
  const eligibleTodayRoutines = todayRoutines.filter((routine) => !skippedToday.has(routine.id));
  const doneCount = eligibleTodayRoutines.filter(isRoutineDone).length;
  const progress = eligibleTodayRoutines.length ? Math.round((doneCount / eligibleTodayRoutines.length) * 100) : 0;
  const animatedProgress = useAnimatedNumber(progress, preferences.motion === "reduced" ? 0 : 600);

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
    if (wasSkipped) void setRoutineSkip(routineId, false, date);
    if (routine && routine.trackingMode !== "simple") {
      const checklistDone = !usesChecklist(routine.trackingMode) || (routine.items.length > 0 && routine.items.every((item) => itemCompletionsRef.current.some((completion) => completion.itemId === item.id && completion.date === date)));
      const quantityDone = !usesQuantity(routine.trackingMode) || (routine.amounts.length > 0 && routine.amounts.every((amount) => (amountCompletionsRef.current.find((item) => item.routineId === routineId && item.amountKey === amount.key && item.date === date)?.count ?? 0) >= amount.targetCount));
      const completeEverything = wasSkipped || !(checklistDone && quantityDone);
      await Promise.all([
        usesChecklist(routine.trackingMode) && routine.items.length ? setChecklistCompletion(routine, completeEverything, date) : Promise.resolve(),
        ...(usesQuantity(routine.trackingMode) ? routine.amounts.map((amount) => setAmount(routineId, amount, completeEverything ? amount.targetCount : 0, date)) : []),
      ]);
      return;
    }
    const currentlyDone = completionsRef.current.some((item) => item.routineId === routineId && item.date === date && item.status === "completed");
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
    updateCompletions((items) => skipped
      ? [...items.filter((item) => !(item.routineId === routineId && item.date === date)), { routineId, date, status: "skipped" }]
      : items.filter((item) => !(item.routineId === routineId && item.date === date && item.status === "skipped")),
    );
    await queueRoutineMutation(routineId, () => fetch("/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routineId, date, status: skipped ? "skipped" : null }),
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

  async function setAmount(routineId: number, amount: RoutineAmount, count: number, date = todayKey, clearSkipped = true) {
    const routine = routines.find((item) => item.id === routineId);
    if (!routine || !usesQuantity(routine.trackingMode)) return;
    if (clearSkipped && completionsRef.current.some((item) => item.routineId === routineId && item.date === date && item.status === "skipped")) void setRoutineSkip(routineId, false, date);
    const safeCount = Math.min(amount.targetCount, Math.max(0, Math.round(count)));
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

  async function undoRoutineSkip(routine: Routine, date = todayKey) {
    await Promise.all([
      setRoutineSkip(routine.id, false, date),
      usesChecklist(routine.trackingMode) && routine.items.length ? setChecklistCompletion(routine, false, date) : Promise.resolve(),
      ...(usesQuantity(routine.trackingMode) ? routine.amounts.map((amount) => setAmount(routine.id, amount, 0, date, false)) : []),
    ]);
  }

  async function toggleItem(itemId: number, date = todayKey) {
    const routine = routines.find((candidate) => candidate.items.some((item) => item.id === itemId));
    if (routine && completionsRef.current.some((item) => item.routineId === routine.id && item.date === date && item.status === "skipped")) void setRoutineSkip(routine.id, false, date);
    const currentlyDone = itemCompletionsRef.current.some((item) => item.itemId === itemId && item.date === date);
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
      setError("");
    } else {
      setError("That routine could not be added. Please try again.");
    }
    setSaving(false);
  }

  function duplicateRoutine(routine: Routine) {
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
    setRoutines((items) => items.filter((routine) => routine.id !== id));
    updateCompletions((items) => items.filter((item) => item.routineId !== id));
    updateItemCompletions((items) => items.filter((item) => !itemIds.has(item.itemId)));
    updateAmountCompletions((items) => items.filter((item) => item.routineId !== id));
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

  if (onboardingState === "checking") return <OnboardingSplash />;
  if (onboardingState === "show") return <OnboardingPage onComplete={completeOnboarding} />;

  return (
    <main className={`app-shell${preferences.motion === "reduced" ? " reduce-motion" : ""}`}>
      <aside className="sidebar">
        <div className="brand" aria-label="Routine EASY home">
          <img className="brand-logo" src="/routineez-checklist.png" alt="" />
          <span>Routine<EasyWord className="brand-easy" /></span>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          <NavButton active={tab === "today"} onClick={() => setTab("today")} icon={CircleCheckBig} label="Today" />
          <NavButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={CalendarDays} label="Calendar" />
          <NavButton active={tab === "routines"} onClick={() => setTab("routines")} icon={ListChecks} label="Routines" />
          <NavButton active={tab === "history"} onClick={() => setTab("history")} icon={History} label="History" />
          <NavButton active={tab === "settings"} onClick={openSettings} icon={Settings2} label="Settings" />
        </nav>
        <div className="sidebar-note">
          <span className="spark">✦</span>
          <strong>Small steps add up.</strong>
          <p>Keep showing up, one routine at a time.</p>
        </div>
      </aside>

      <section className="content">
        <div className="app-background-blobs" aria-hidden="true">
          <i className="app-background-blob app-blob-purple" />
          <i className="app-background-blob app-blob-coral" />
          <i className="app-background-blob app-blob-gold" />
          <i className="app-background-blob app-blob-sky" />
        </div>
        <header className="mobile-header">
          <button className={`mobile-profile${showProfile ? " active" : ""}`} onClick={() => setShowProfile((visible) => !visible)} aria-label="Open profile" aria-expanded={showProfile}><CircleUserRound aria-hidden="true" /></button>
          <div className="mobile-wordmark" aria-label="Routine EASY">
            <img src="/routineez-checklist.png" alt="" />
            <span className="mobile-wordmark-name">Routine<EasyWord className="mobile-wordmark-easy" /></span>
          </div>
          <button className="mobile-add premium-action" onClick={openAddFromHeader} aria-label="Add routine"><span aria-hidden="true">+</span></button>
        </header>

        {showProfile && <div className="profile-popover-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowProfile(false); }}>
          <section className="profile-card" role="dialog" aria-label="Your Routine EASY profile">
            <button className="profile-close" onClick={() => setShowProfile(false)} aria-label="Close profile">×</button>
            <div className="profile-avatar"><CircleUserRound aria-hidden="true" /></div>
            <div className="profile-copy"><small>Your profile</small><h2>My Routine<EasyWord className="brand-easy" /></h2><p>Small routines. Easier days.</p></div>
            <div className="profile-stats"><div><strong>{routines.length}</strong><span>Routines</span></div><div><strong>{doneCount}/{eligibleTodayRoutines.length}</strong><span>Done today</span></div></div>
            <div className="profile-actions">
              <button className="profile-settings-button" onClick={openSettings}><Settings2 aria-hidden="true" />Settings</button>
              <button className="profile-routines-button" onClick={() => { setTab("routines"); setShowProfile(false); }}>Manage routines</button>
            </div>
          </section>
        </div>}

        {routineToDelete && <DeleteRoutineDialog routine={routineToDelete} deleting={deleting} onCancel={() => setRoutineToDelete(null)} onConfirm={() => deleteRoutine(routineToDelete.id)} />}
        {showTemplatePicker && <TemplateChooser onCancel={() => setShowTemplatePicker(false)} onChoose={(template) => { setSelectedTemplate(template); setShowTemplatePicker(false); setShowAdd(true); }} />}

        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}

        {tab === "today" && (
          <div className="page today-page">
            <div className="desktop-today-date"><DateTile date={today} /></div>

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
                {loading ? <LoadingRows /> : todayRoutines.length ? todayRoutines.map((routine) => (
                  <RoutineRow
                    key={routine.id}
                    routine={routine}
                    completed={!skippedToday.has(routine.id) && isRoutineDone(routine)}
                    skipped={skippedToday.has(routine.id)}
                    completedItemIds={completedItemsToday}
                    amountCounts={Object.fromEntries(routine.amounts.map((amount) => [amount.key, amountCount(routine.id, amount.key)]))}
                    onToggle={() => toggleRoutine(routine.id)}
                    onToggleItem={toggleItem}
                    onSetAmount={(amount, count) => setAmount(routine.id, amount, count)}
                    onSkip={(nextSkipped) => nextSkipped ? setRoutineSkip(routine.id, true) : undoRoutineSkip(routine)}
                    timeFormat={preferences.timeFormat}
                  />
                )) : <EmptyToday onAdd={() => { setTab("routines"); setShowTemplatePicker(true); }} />}
              </div>
            </section>
          </div>
        )}

        {tab === "calendar" && (
          <div className="page calendar-page">
            <ScrollablePicker label="Calendar routine filters" className="calendar-filter-picker" scrollClassName="filter-pills">
              <button className={selectedRoutine === "all" ? "active" : ""} onClick={() => setSelectedRoutine("all")}>All routines</button>
              {routines.map((routine) => <button key={routine.id} className={selectedRoutine === routine.id ? "active" : ""} style={{ "--pill": routine.color } as React.CSSProperties} onClick={() => setSelectedRoutine(routine.id)}><span>{routine.emoji}</span>{routine.name}</button>)}
            </ScrollablePicker>
            <section className="calendar-card">
              <div className="calendar-toolbar">
                <button className="calendar-month-nav calendar-prev" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft aria-hidden="true" /></button>
                <h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
                <button className="calendar-month-nav calendar-next" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight aria-hidden="true" /></button>
              </div>
              <div className="weekday-row">{calendarDayNames.map((day) => <span key={day}>{day}</span>)}</div>
              <div className="calendar-grid">
                {monthDays.map((date, index) => {
                  if (!date) return <div className="day-cell empty" key={`blank-${index}`} />;
                  const key = localDateKey(date);
                  const matches = routines.filter((routine) => routine.days.includes(date.getDay()) && routineActiveOnDate(routine, key) && (selectedRoutine === "all" || selectedRoutine === routine.id));
                  const isToday = key === todayKey;
                  const isSelectedRoutineDay = selectedRoutine !== "all" && matches.length > 0;
                  return <div className={`day-cell ${isToday ? "is-today" : ""} ${matches.length ? "has-routines" : ""} ${isSelectedRoutineDay ? "selected-routine-day" : ""}`} style={isSelectedRoutineDay ? { "--selected-day": matches[0].color } as React.CSSProperties : undefined} key={key} aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${matches.length ? `: ${matches.map((routine) => routine.name).join(", ")}` : ""}`}>
                    {matches.length > 0 && <div className="day-fill" style={{ gridTemplateColumns: `repeat(${matches.length}, minmax(0, 1fr))` }} aria-hidden="true">{matches.map((routine) => <span key={routine.id} style={{ background: routine.color }} />)}</div>}
                    <span className="day-number">{date.getDate()}</span>
                  </div>;
                })}
              </div>
              {!viewingCurrentMonth && <div className="calendar-today-row"><button className="calendar-today-button" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button></div>}
            </section>
            <div className="calendar-legend">Colored bars show the routines scheduled for each day.</div>
          </div>
        )}

        {tab === "routines" && (
          <div className="page routines-page">
            {showAdd && <AddRoutineForm key={selectedTemplate?.id ?? "blank"} template={selectedTemplate} onSubmit={addRoutine} onCancel={() => { setShowAdd(false); setSelectedTemplate(null); }} saving={saving} usedEmojis={routines.map((routine) => routine.emoji)} usedColors={routines.map((routine) => routine.color)} />}
            {editingRoutineId !== null && (() => {
              const routine = routines.find((item) => item.id === editingRoutineId);
              return routine ? <RoutineOptionsEditor routine={routine} onSubmit={(event) => saveRoutineOptions(event, routine)} onCancel={() => setEditingRoutineId(null)} saving={savingList} usedEmojis={routines.filter((item) => item.id !== routine.id).map((item) => item.emoji)} usedColors={routines.filter((item) => item.id !== routine.id).map((item) => item.color)} /> : null;
            })()}
            <section className="routine-library">
              <div className="section-title"><h2>Your routines</h2><div className="section-title-actions"><span>{routines.length} total</span><button className="desktop-routine-add premium-action" onClick={() => { setEditingRoutineId(null); setShowTemplatePicker(true); }}>+ Add routine</button></div></div>
              <div className="routine-grid">
                {loading ? <LoadingRows /> : routines.map((routine) => <RoutineCard key={routine.id} routine={routine} timeFormat={preferences.timeFormat} onEditOptions={() => { setShowAdd(false); setEditingRoutineId(routine.id); }} onDuplicate={() => duplicateRoutine(routine)} onHistory={() => { setSelectedHistoryRoutine(routine.id); setTab("history"); }} onDelete={() => setRoutineToDelete(routine)} />)}
              </div>
            </section>
          </div>
        )}

        {tab === "history" && <HistoryPage routines={routines} selectedRoutine={selectedHistoryRoutine} onSelectRoutine={setSelectedHistoryRoutine} completions={completions} itemCompletions={itemCompletions} amountCompletions={amountCompletions} todayKey={todayKey} weekStartsOn={preferences.weekStartsOn} loading={loading} />}

        {tab === "settings" && <SettingsPage preferences={preferences} onChange={updatePreferences} />}
      </section>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavButton active={tab === "today"} onClick={() => setTab("today")} icon={CircleCheckBig} label="Today" />
        <CalendarNavButton active={tab === "calendar"} onClick={() => setTab("calendar")} date={today} />
        <NavButton active={tab === "routines"} onClick={() => setTab("routines")} icon={ListChecks} label="Routines" />
        <NavButton active={tab === "history"} onClick={() => setTab("history")} icon={History} label="History" />
      </nav>
    </main>
  );
}

type HistoryDayState = { date: Date; key: string; status: "completed" | "partial" | "skipped" | "missed" | "scheduled" | "off" };

function buildRoutineHistory(routine: Routine, completions: Completion[], itemCompletions: ItemCompletion[], amountCompletions: AmountCompletion[], todayKey: string, month: Date): HistoryDayState[] {
  const itemIds = new Set(routine.items.map((item) => item.id));
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth(), index + 1, 12);
    const key = localDateKey(date);
    const saved = completions.find((item) => item.routineId === routine.id && item.date === key)?.status;
    if (saved === "skipped") return { date, key, status: "skipped" };
    const scheduled = routine.days.includes(date.getDay()) && routineActiveOnDate(routine, key);
    if (!scheduled) return { date, key, status: "off" };
    const checkedItems = itemCompletions.filter((item) => item.date === key && itemIds.has(item.itemId)).length;
    const amounts = amountCompletions.filter((item) => item.routineId === routine.id && item.date === key);
    const checklistDone = !usesChecklist(routine.trackingMode) || (routine.items.length > 0 && checkedItems === routine.items.length);
    const amountDone = !usesQuantity(routine.trackingMode) || (routine.amounts.length > 0 && routine.amounts.every((amount) => (amounts.find((item) => item.amountKey === amount.key)?.count ?? 0) >= amount.targetCount));
    const completed = routine.trackingMode === "simple" ? saved === "completed" : checklistDone && amountDone;
    if (completed) return { date, key, status: "completed" };
    if (checkedItems > 0 || amounts.some((item) => item.count > 0)) return { date, key, status: "partial" };
    return { date, key, status: key < todayKey ? "missed" : "scheduled" };
  });
}

function historyRate(states: HistoryDayState[], count: number) {
  const eligible = states.slice(-count).filter((day) => day.status !== "off" && day.status !== "skipped" && day.status !== "scheduled");
  return eligible.length ? Math.round((eligible.filter((day) => day.status === "completed").length / eligible.length) * 100) : 0;
}

function HistoryPage({ routines, selectedRoutine, onSelectRoutine, completions, itemCompletions, amountCompletions, todayKey, weekStartsOn, loading }: { routines: Routine[]; selectedRoutine: number | "all"; onSelectRoutine: (routine: number | "all") => void; completions: Completion[]; itemCompletions: ItemCompletion[]; amountCompletions: AmountCompletion[]; todayKey: string; weekStartsOn: WeekStart; loading: boolean }) {
  const selected = selectedRoutine === "all" ? undefined : routines.find((routine) => routine.id === selectedRoutine);
  const effectiveSelection = selected ? selected.id : "all";
  const todayDate = new Date(`${todayKey}T12:00:00`);
  const [historyMonth, setHistoryMonth] = useState(() => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const currentMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const viewingCurrentMonth = historyMonth.getFullYear() === currentMonth.getFullYear() && historyMonth.getMonth() === currentMonth.getMonth();
  const historyMonthLabel = historyMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const historyDayNames = weekStartsOn === "monday" ? [...DAY_NAMES.slice(1), DAY_NAMES[0]] : DAY_NAMES;
  const firstWeekday = (historyMonth.getDay() - (weekStartsOn === "monday" ? 1 : 0) + 7) % 7;
  const historyByRoutine = useMemo(() => new Map(routines.map((routine) => [routine.id, buildRoutineHistory(routine, completions, itemCompletions, amountCompletions, todayKey, historyMonth)])), [routines, completions, itemCompletions, amountCompletions, todayKey, historyMonth]);

  return <div className={`page history-page${selected ? " history-page-detail" : ""}`}>
    <ScrollablePicker label="History routine filters" className="history-filter-picker" scrollClassName="filter-pills">
      <button className={effectiveSelection === "all" ? "active" : ""} onClick={() => { onSelectRoutine("all"); setHistoryMonth(currentMonth); }}>All routines</button>
      {routines.map((routine) => <button key={routine.id} className={effectiveSelection === routine.id ? "active" : ""} style={{ "--pill": routine.color } as React.CSSProperties} onClick={() => onSelectRoutine(routine.id)}><span>{routine.emoji}</span>{routine.name}</button>)}
    </ScrollablePicker>
    {loading ? <LoadingRows /> : !routines.length ? <section className="history-empty"><History aria-hidden="true" /><h2>No history yet</h2><p>Add a routine and your progress will appear here.</p></section> : selected ? (() => {
      const states = historyByRoutine.get(selected.id) ?? [];
      const eligibleStates = states.filter((day) => day.status !== "off" && day.status !== "skipped" && day.status !== "scheduled");
      const completedDays = eligibleStates.filter((day) => day.status === "completed").length;
      return <section className="history-detail-card" style={{ "--history-color": selected.color } as React.CSSProperties}>
        <header><div className="history-title-row"><span className="history-emoji">{selected.emoji}</span><h2>{selected.name}</h2></div></header>
        <div className="history-month-toolbar"><button onClick={() => setHistoryMonth(new Date(historyMonth.getFullYear(), historyMonth.getMonth() - 1, 1))} aria-label="Previous history month"><ChevronLeft aria-hidden="true" /></button><h3>{historyMonthLabel}</h3><button onClick={() => setHistoryMonth(new Date(historyMonth.getFullYear(), historyMonth.getMonth() + 1, 1))} aria-label="Next history month" disabled={viewingCurrentMonth}><ChevronRight aria-hidden="true" /></button></div>
        <div className="history-stats"><div><strong>{historyRate(states, states.length)}%</strong><span>Monthly completion</span></div><div><strong>{completedDays}/{eligibleStates.length}</strong><span>Days completed</span></div></div>
        <div className="history-month-calendar"><div className="history-weekday-row">{historyDayNames.map((day) => <span key={day}>{day}</span>)}</div><div className="history-grid">{Array.from({ length: firstWeekday }, (_, index) => <i className="history-day-spacer" key={`spacer-${index}`} />)}{states.map((day) => <div key={day.key} className={`history-day ${day.status}`} title={`${day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${day.status}`}><small>{day.date.toLocaleDateString("en-US", { weekday: "narrow" })}</small><strong>{day.date.getDate()}</strong></div>)}</div></div>
        {!viewingCurrentMonth && <button className="history-current-month-button" onClick={() => setHistoryMonth(currentMonth)}>This month</button>}
        <div className="history-legend"><span className="completed">Completed</span><span className="partial">Partial</span><span className="skipped">Skipped</span><span className="missed">Missed</span></div>
      </section>;
    })() : <section className="history-overview">
      <header><div><span>This month</span><h2>Your progress</h2></div><p>Select a routine for the full monthly view.</p></header>
      <div className="history-overview-grid">{routines.map((routine) => {
        const states = historyByRoutine.get(routine.id) ?? [];
        return <button key={routine.id} className="history-overview-card" style={{ "--history-color": routine.color } as React.CSSProperties} onClick={() => onSelectRoutine(routine.id)}>
          <span className="history-overview-emoji">{routine.emoji}</span><span className="history-overview-copy"><strong>{routine.name}</strong><small>This month</small></span><b>{historyRate(states, states.length)}%</b>
          <span className="history-mini-days" aria-hidden="true">{states.slice(-14).map((day) => <i key={day.key} className={day.status} />)}</span>
        </button>;
      })}</div>
    </section>}
  </div>;
}

function SettingsPage({ preferences, onChange }: { preferences: AppPreferences; onChange: (next: Partial<AppPreferences>) => void }) {
  return <div className="page settings-page">
    <header className="settings-heading"><span>Make it yours</span><h1>Settings</h1><p>Choose how Routine EASY looks and feels. Changes save automatically on this device.</p></header>
    <div className="settings-list">
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
    </div>
    <p className="settings-saved"><CircleCheckBig aria-hidden="true" />Preferences save automatically</p>
  </div>;
}

function OnboardingPage({ onComplete }: { onComplete: (addRoutine?: boolean) => void }) {
  return <main className="onboarding-shell">
    <div className="onboarding-glow glow-one" aria-hidden="true" />
    <div className="onboarding-glow glow-two" aria-hidden="true" />
    <section className="onboarding-card" aria-labelledby="onboarding-title">
      <header className="onboarding-top">
        <div className="brand" aria-label="Routine EASY"><img className="brand-logo" src="/routineez-checklist.png" alt="" /><span>Routine<EasyWord className="brand-easy" /></span></div>
        <button className="onboarding-skip" onClick={() => onComplete(false)}>Skip for now</button>
      </header>
      <div className="onboarding-layout">
        <div className="onboarding-copy">
          <p className="eyebrow">Welcome to your new rhythm</p>
          <h1 id="onboarding-title">Small routines.<br /><span>Easier days.</span></h1>
          <p className="onboarding-lead">Plan the little things that keep your day moving—from workouts and vitamins to breakfast, lunch, and dinner.</p>
          <div className="onboarding-benefits" aria-label="Routine EASY features">
            <div><span className="benefit-icon purple">✓</span><p><strong>Simple check-offs</strong><small>See today and keep moving.</small></p></div>
            <div><span className="benefit-icon coral">●</span><p><strong>Color-coded plans</strong><small>Your routines at a glance.</small></p></div>
            <div><span className="benefit-icon green">↗</span><p><strong>Gentle progress</strong><small>Small wins that add up.</small></p></div>
          </div>
          <button className="onboarding-cta premium-action" onClick={() => onComplete(true)}><span>Build my first routine</span><i aria-hidden="true">→</i></button>
          <p className="onboarding-note">No pressure. Start with just one thing.</p>
        </div>
        <div className="onboarding-visual">
          <div className="onboarding-image-wrap">
            <img src="/og.png" alt="Routine EASY color-coded routine checklist preview" />
          </div>
          <div className="onboarding-mini-card"><span>✦</span><div><strong>A calmer day starts small.</strong><small>One routine is enough.</small></div></div>
        </div>
      </div>
    </section>
  </main>;
}

function OnboardingSplash() {
  return <main className="onboarding-splash" aria-label="Loading Routine EASY">
    <div className="splash-blobs" aria-hidden="true">
      <span className="splash-blob splash-blob-purple"><i /></span>
      <span className="splash-blob splash-blob-coral"><i /></span>
      <span className="splash-blob splash-blob-gold"><i /></span>
      <span className="splash-blob splash-blob-sky"><i /></span>
    </div>
    <div className="splash-brand">
      <img className="splash-logo" src="/routineez-checklist.png" alt="" />
      <div className="splash-wordmark" aria-hidden="true">
        <span className="splash-routine">Routine</span><EasyWord className="splash-easy" />
      </div>
    </div>
  </main>;
}

function EasyWord({ className }: { className: string }) {
  return <span className={className} aria-hidden="true"><span className="easy-e">E</span><span className="easy-a">A</span><span className="easy-s">S</span><span className="easy-y">Y</span></span>;
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return <button className={active ? "active" : ""} onClick={onClick} aria-current={active ? "page" : undefined}><span className="nav-icon"><Icon aria-hidden="true" strokeWidth={active ? 2.4 : 2} /></span>{label}</button>;
}

function CalendarNavButton({ active, onClick, date }: { active: boolean; onClick: () => void; date: Date }) {
  return <button className={`calendar-nav-button ${active ? "active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}><span className="nav-icon date-nav-icon" aria-hidden="true"><i>{date.toLocaleDateString("en-US", { month: "short" })}</i><strong>{date.getDate()}</strong></span><span className="nav-label">Calendar</span></button>;
}

function DateTile({ date }: { date: Date }) {
  return <div className="date-tile" aria-label={date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}>
    <span>{date.toLocaleDateString("en-US", { month: "short" })}</span>
    <strong>{date.getDate()}</strong>
    <small>{date.toLocaleDateString("en-US", { weekday: "short" })}</small>
  </div>;
}

function RoutineRow({ routine, completed, skipped, completedItemIds, amountCounts, onToggle, onToggleItem, onSetAmount, onSkip, timeFormat }: { routine: Routine; completed: boolean; skipped: boolean; completedItemIds: Set<number>; amountCounts: Record<string, number>; onToggle: () => void; onToggleItem: (itemId: number) => void; onSetAmount: (amount: RoutineAmount, count: number) => void; onSkip: (skipped: boolean) => void; timeFormat: TimeFormat }) {
  const hasDetails = (usesChecklist(routine.trackingMode) && routine.items.length > 0) || (usesQuantity(routine.trackingMode) && routine.amounts.length > 0);
  const [expanded, setExpanded] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragXRef = useRef(0);
  const pointerActiveRef = useRef(false);
  const gestureAxisRef = useRef<"pending" | "horizontal" | "vertical">("pending");
  const checkPointerRef = useRef({ active: false, pointerId: -1, x: 0, y: 0 });
  const skippedRef = useRef(skipped);
  if (skippedRef.current !== skipped) skippedRef.current = skipped;
  const completedCount = routine.items.filter((item) => completedItemIds.has(item.id)).length;
  const todayVariant = routine.dayVariants?.[new Date().getDay()] ?? "";
  const progressParts = [
    ...(usesChecklist(routine.trackingMode) && routine.items.length ? [Math.round((completedCount / routine.items.length) * 100)] : []),
    ...(usesQuantity(routine.trackingMode) ? routine.amounts.map((amount) => Math.min(100, Math.round(((amountCounts[amount.key] ?? 0) / amount.targetCount) * 100))) : []),
  ];
  const progressValue = progressParts.length ? Math.round(progressParts.reduce((sum, value) => sum + value, 0) / progressParts.length) : completed ? 100 : 0;
  const detail = [
    ...(usesChecklist(routine.trackingMode) ? [`${completedCount}/${routine.items.length} items`] : []),
    ...(usesQuantity(routine.trackingMode) ? [routine.amounts.length === 1 ? `${amountCounts[routine.amounts[0].key] ?? 0}/${routine.amounts[0].targetCount} ${routine.amounts[0].name}` : `${routine.amounts.filter((amount) => (amountCounts[amount.key] ?? 0) >= amount.targetCount).length}/${routine.amounts.length} amounts`] : []),
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
    if (!pointerActiveRef.current || expanded || gestureAxisRef.current === "vertical") return;
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
  return <article className={`routine-row mode-${routine.trackingMode} ${completed ? "completed" : ""} ${skipped ? "skipped" : ""} ${expanded ? "expanded" : ""} ${swiping ? "swiping" : ""} ${swipeDirection}`} style={{ "--routine": routine.color } as React.CSSProperties}>
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
    {usesQuantity(routine.trackingMode) && expanded && <div className="quantity-trackers">{routine.amounts.map((amount) => <QuantityTracker key={amount.key} routineName={routine.name} amount={amount} count={amountCounts[amount.key] ?? 0} onChange={(count) => onSetAmount(amount, count)} />)}</div>}
    {usesChecklist(routine.trackingMode) && routine.items.length > 0 && expanded && <div className="routine-checklist">{routine.lists.map((list) => <section className="routine-list-group" key={list.key}>
      <strong className="routine-list-name">{list.name}</strong>
      {routine.items.filter((item) => item.listKey === list.key).map((item) => {
        const checked = completedItemIds.has(item.id);
        return <button key={item.id} className={checked ? "checked" : ""} onClick={() => onToggleItem(item.id)}>
          <span className="item-check">✓</span><span>{item.title}</span>
        </button>;
      })}
    </section>)}</div>}
    {!expanded && <div className="collapsed-progress" role="progressbar" aria-label={`${routine.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}>
      <span style={{ width: `${progressValue}%` }} />
    </div>}
  </article>;
}

function QuantityTracker({ routineName, amount, count, onChange }: { routineName: string; amount: RoutineAmount; count: number; onChange: (count: number) => void }) {
  return <div className="quantity-tracker">
    <strong className="quantity-name">{amount.name}</strong>
    <div className="quantity-pill" style={{ "--segments": amount.targetCount } as React.CSSProperties} role="group" aria-label={`${routineName}: ${count} of ${amount.targetCount} ${amount.name}`}>
      {Array.from({ length: amount.targetCount }, (_, index) => {
        const value = index + 1;
        const filled = value <= count;
        return <button key={value} type="button" className={filled ? "filled" : ""} onClick={() => onChange(filled ? value - 1 : value)} aria-label={`${filled ? "Remove" : "Record"} ${amount.name} ${value}`} aria-pressed={filled}>
          <span>{filled ? "✓" : value}</span>
        </button>;
      })}
    </div>
  </div>;
}

function RoutineCard({ routine, timeFormat, onEditOptions, onDuplicate, onHistory, onDelete }: { routine: Routine; timeFormat: TimeFormat; onEditOptions: () => void; onDuplicate: () => void; onHistory: () => void; onDelete: () => void }) {
  const dayLabel = routine.days.length === 7 ? "Every day" : routine.days.map((day) => DAY_NAMES[day]).join(" · ");
  const trackingLabel = routine.trackingMode === "simple" ? "Single check" : [
    ...(usesChecklist(routine.trackingMode) ? [`${routine.lists.length} ${routine.lists.length === 1 ? "list" : "lists"}`] : []),
    ...(usesQuantity(routine.trackingMode) ? [routine.amounts.map((amount) => `${amount.targetCount} ${amount.name}`).join(" + ")] : []),
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

  return <div className="feature-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="template-dialog" role="dialog" aria-modal="true" aria-labelledby="template-title">
      <header><div><span>Quick start</span><h2 id="template-title">Choose a starting point</h2><p>Everything can be changed before you save.</p></div><button onClick={onCancel} aria-label="Close templates"><X /></button></header>
      <button className="blank-template" onClick={() => onChoose(null)}><span className="template-symbol">+</span><span><strong>Start from scratch</strong><small>Build exactly what you need</small></span><ChevronRight aria-hidden="true" /></button>
      <div className="template-grid">{ROUTINE_TEMPLATES.map((template) => <button key={template.id} onClick={() => onChoose(template)} style={{ "--template-color": template.color } as React.CSSProperties}>
        <span className="template-emoji">{template.emoji}</span><span><strong>{template.name}</strong><small>{template.description}</small></span><ChevronRight aria-hidden="true" />
      </button>)}</div>
    </section>
  </div>;
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
  const itemIds = new Set(routine.items.map((item) => item.id));
  const statusFor = (date: string) => {
    const saved = completions.find((item) => item.routineId === routine.id && item.date === date)?.status;
    if (saved === "skipped") return "skipped" as const;
    const scheduled = routine.days.includes(new Date(`${date}T12:00:00`).getDay()) && routineActiveOnDate(routine, date);
    if (!scheduled) return "off" as const;
    const checkedItems = itemCompletions.filter((item) => item.date === date && itemIds.has(item.itemId)).length;
    const amounts = amountCompletions.filter((item) => item.routineId === routine.id && item.date === date);
    const checklistDone = !usesChecklist(routine.trackingMode) || (routine.items.length > 0 && checkedItems === routine.items.length);
    const amountDone = !usesQuantity(routine.trackingMode) || (routine.amounts.length > 0 && routine.amounts.every((amount) => (amounts.find((item) => item.amountKey === amount.key)?.count ?? 0) >= amount.targetCount));
    const completed = routine.trackingMode === "simple" ? saved === "completed" : checklistDone && amountDone;
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
  const quantityDone = !usesQuantity(trackingMode) || (amounts.length > 0 && amounts.every((amount) => (amountCounts[amount.key] ?? 0) >= amount.targetCount));
  const completed = trackingMode === "simple" ? simpleDone : checklistDone && quantityDone;
  const detail = trackingMode === "simple" ? "Single check" : [
    ...(usesChecklist(trackingMode) ? [items.length ? `${checkedItems.length}/${items.length} items` : "List · Add items below"] : []),
    ...(usesQuantity(trackingMode) ? [amounts.length === 1 ? `${amountCounts[amounts[0].key] ?? 0}/${amounts[0].targetCount} ${amounts[0].name}` : `${amounts.filter((amount) => (amountCounts[amount.key] ?? 0) >= amount.targetCount).length}/${amounts.length} amounts`] : []),
  ].join(" · ");
  const progressParts = [
    ...(usesChecklist(trackingMode) ? [items.length ? Math.round((checkedItems.length / items.length) * 100) : 0] : []),
    ...(usesQuantity(trackingMode) ? amounts.map((amount) => Math.round(((amountCounts[amount.key] ?? 0) / amount.targetCount) * 100)) : []),
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
    setAmountCounts((counts) => Object.fromEntries(amounts.map((amount) => [amount.key, Math.min(counts[amount.key] ?? 0, amount.targetCount)])));
  }, [amounts]);

  const toggleAll = () => {
    if (trackingMode === "simple") setSimpleDone((done) => !done);
    else {
      if (usesChecklist(trackingMode)) setCheckedItems(completed ? [] : items.map((_, index) => index));
      if (usesQuantity(trackingMode)) setAmountCounts(Object.fromEntries(amounts.map((amount) => [amount.key, completed ? 0 : amount.targetCount])));
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
    {expanded && usesQuantity(trackingMode) && <div className="preview-details preview-amount">{amounts.map((amount) => <div className="preview-amount-row" key={amount.key}>
      <strong>{amount.name}</strong>
      <div className="preview-quantity" style={{ "--preview-segments": amount.targetCount } as React.CSSProperties}>
        {Array.from({ length: amount.targetCount }, (_, index) => {
          const value = index + 1;
          const filled = value <= (amountCounts[amount.key] ?? 0);
          return <button type="button" key={value} className={filled ? "filled" : ""} onClick={() => setAmountCounts((counts) => ({ ...counts, [amount.key]: filled ? value - 1 : value }))} aria-label={`${filled ? "Remove" : "Record"} ${amount.name} ${value}`}>{filled ? "✓" : value}</button>;
        })}
      </div>
    </div>)}</div>}
    {expanded && usesChecklist(trackingMode) && <div className="preview-details preview-list">
      {items.length ? lists.map((list) => <section className="preview-list-group" key={list.key}><strong>{list.name || "New list"}</strong>{items.map((item, index) => ({ item, index })).filter(({ item }) => item.listKey === list.key).map(({ item, index }) => {
        const checked = checkedItems.includes(index);
        return <button type="button" key={`${item.listKey}-${item.title}-${index}`} className={checked ? "checked" : ""} onClick={() => setCheckedItems((current) => checked ? current.filter((value) => value !== index) : [...current, index].sort((a, b) => a - b))}><span>{checked ? "✓" : ""}</span>{item.title}</button>;
      })}</section>) : <p>Add items to a list below to try them here.</p>}
    </div>}
    {!expanded && <div className="preview-progress" role="progressbar" aria-label="Preview progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}><span style={{ width: `${progressValue}%` }} /></div>}
  </section>;
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
    { title: "Make it yours", note: "Pick its look and weekly schedule." },
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

  return <div className="add-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
  <div className="add-modal-stack">
  <div className={`add-form-shell step-tone-${step + 1}`}>
  <form ref={formRef} className="add-card add-routine-modal" onSubmit={submitWizard} role="dialog" aria-modal="true" aria-label="Add a routine">
    <header className="routine-wizard-header">
      <div className="wizard-heading" aria-live="polite"><span>Step {step + 1} of {steps.length}</span><h2>{steps[step].title}</h2><p>{steps[step].note}</p></div>
      <div className="wizard-progress" role="progressbar" aria-label="Add routine progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
        {steps.map((item, index) => <i key={item.title} className={index <= step ? "active" : ""} />)}
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
      <section className="wizard-step" hidden={step !== 2} aria-label="Appearance and schedule">
        <fieldset className="emoji-picker"><legend>Icon</legend><ScrollablePicker label="Icon">{availableEmojis.map((emoji) => <label key={emoji}><input type="radio" name="emoji" value={emoji} checked={previewEmoji === emoji} onChange={(event) => { setPreviewEmoji(emoji); keepModalAligned(event.currentTarget); }} /><span>{emoji}</span></label>)}</ScrollablePicker></fieldset>
        <fieldset className="color-picker"><legend>Color</legend><ScrollablePicker label="Color">{availableColors.map((color) => <label key={color}><input type="radio" name="color" value={color} checked={previewColor.toLowerCase() === color.toLowerCase()} onChange={(event) => { setPreviewColor(color); keepModalAligned(event.currentTarget); }} /><span style={{ background: color }} /></label>)}</ScrollablePicker></fieldset>
        <UniqueChoiceToggles hideUsedEmojis={hideUsedEmojis} hideUsedColors={hideUsedColors} onEmojisChange={toggleUsedEmojis} onColorsChange={toggleUsedColors} />
        <fieldset className="day-picker"><legend>Repeat on</legend>{DAY_NAMES.map((day, i) => <label key={day}><input type="checkbox" name={`day-${i}`} checked={selectedDays.includes(i)} onChange={() => setSelectedDays((days) => days.includes(i) ? days.filter((item) => item !== i) : [...days, i].sort())} /><span>{day.slice(0, 1)}</span></label>)}</fieldset>
        <DayPlanSettings scheduledDays={selectedDays} variants={template?.dayVariants} />
      </section>
    </div>
    <div className="form-actions wizard-actions">
      <button type="button" className="secondary-button" onClick={() => step === 0 ? onCancel() : moveToStep(step - 1)}>{step === 0 ? "Cancel" : "Back"}</button>
      {step < steps.length - 1 ? <button type="button" className="primary-button premium-action" onClick={() => moveToStep(step + 1)} disabled={stepSettling}>Next</button> : <button className="primary-button premium-action" disabled={saving || stepSettling}>{saving ? "Saving…" : template?.id.startsWith("duplicate-") ? "Save duplicate" : "Add routine"}</button>}
    </div>
  </form>
  <VerticalScrollIndicator scrollerRef={formRef} label="Add routine form" />
  </div>
  </div>
  </div>;
}

function UniqueChoiceToggles({ hideUsedEmojis, hideUsedColors, onEmojisChange, onColorsChange }: { hideUsedEmojis: boolean; hideUsedColors: boolean; onEmojisChange: (checked: boolean) => void; onColorsChange: (checked: boolean) => void }) {
  return <fieldset className="choice-uniqueness">
    <legend>Keep choices unique <small>Optional</small></legend>
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
  </fieldset>;
}

function RoutineOptionsEditor({ routine, onSubmit, onCancel, saving, usedEmojis, usedColors }: { routine: Routine; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; saving: boolean; usedEmojis: string[]; usedColors: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
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
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel]);

  const keepModalAligned = (input: HTMLInputElement) => {
    const modal = input.closest(".edit-routine-modal");
    window.requestAnimationFrame(() => {
      if (modal instanceof HTMLElement) modal.scrollLeft = 0;
    });
  };

  return <div className="edit-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
  <div className="edit-form-shell">
  <form ref={formRef} className="add-card checklist-editor edit-routine-modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-label={`Edit ${routine.name}`}>
    <div className="add-card-header"><div><span className="eyebrow">Make it yours</span><h2>Edit routine</h2><p>Change any part of this routine.</p></div><button type="button" onClick={onCancel} aria-label="Close">×</button></div>
    <div className="form-grid options-grid">
      <label className="field wide"><span>Routine name</span><input name="name" defaultValue={routine.name} placeholder="e.g. Take vitamins" required maxLength={40} autoFocus /></label>
      <TimeField defaultValue={routine.time} />
      <DateRangeSettings startDate={routine.startDate} endDate={routine.endDate} />
      <TrackingBuilder lists={lists} amounts={amounts} onListsChange={setLists} onAmountsChange={setAmounts} />
      <fieldset className="emoji-picker"><legend>Icon</legend><ScrollablePicker label="Icon">{availableEmojis.map((emoji) => <label key={emoji}><input type="radio" name="emoji" value={emoji} checked={selectedEmoji === emoji} onChange={(event) => { setSelectedEmoji(emoji); keepModalAligned(event.currentTarget); }} /><span>{emoji}</span></label>)}</ScrollablePicker></fieldset>
      <fieldset className="color-picker"><legend>Color</legend><ScrollablePicker label="Color">{availableColors.map((color) => <label key={color}><input type="radio" name="color" value={color} checked={selectedColor.toLowerCase() === color.toLowerCase()} onChange={(event) => { setSelectedColor(color); keepModalAligned(event.currentTarget); }} /><span style={{ background: color }} /></label>)}</ScrollablePicker></fieldset>
      <UniqueChoiceToggles hideUsedEmojis={hideUsedEmojis} hideUsedColors={hideUsedColors} onEmojisChange={toggleUsedEmojis} onColorsChange={toggleUsedColors} />
      <fieldset className="day-picker"><legend>Repeat on</legend>{DAY_NAMES.map((day, i) => <label key={day}><input type="checkbox" name={`day-${i}`} checked={selectedDays.includes(i)} onChange={() => setSelectedDays((days) => days.includes(i) ? days.filter((item) => item !== i) : [...days, i].sort())} /><span>{day.slice(0, 1)}</span></label>)}</fieldset>
      <DayPlanSettings scheduledDays={selectedDays} variants={routine.dayVariants} />
    </div>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button premium-action" disabled={saving}>{saving ? "Saving…" : "Save routine"}</button></div>
  </form>
  <VerticalScrollIndicator scrollerRef={formRef} label="Edit routine form" />
  </div>
  </div>;
}

function ScrollablePicker({ label, children, className = "", scrollClassName = "" }: { label: string; children: ReactNode; className?: string; scrollClassName?: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const dragOffsetRef = useRef(0);
  const [thumb, setThumb] = useState({ left: 0, width: 100 });
  const [dragging, setDragging] = useState(false);

  const updateIndicator = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
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
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const frame = window.requestAnimationFrame(updateIndicator);
    const observer = new ResizeObserver(updateIndicator);
    const mutationObserver = new MutationObserver(() => window.requestAnimationFrame(updateIndicator));
    observer.observe(scroller);
    mutationObserver.observe(scroller, { childList: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return <div className={`picker-shell${className ? ` ${className}` : ""}`}>
    <div ref={scrollerRef} className={`picker-scroll${scrollClassName ? ` ${scrollClassName}` : ""}`} onScroll={updateIndicator} tabIndex={0} role="group" aria-label={`${label} choices. Scroll horizontally for more.`}>{children}</div>
    <div ref={trackRef} className="picker-scrollbar">
      <button ref={thumbRef} type="button" className={`picker-thumb${dragging ? " dragging" : ""}`} style={{ left: `calc(${thumb.left}% + 1px)`, width: `calc(${thumb.width}% - 2px)` }} aria-label={`Scroll ${label} choices`} onPointerDown={beginThumbDrag} onPointerMove={moveThumb} onPointerUp={endThumbDrag} onPointerCancel={endThumbDrag} onLostPointerCapture={() => setDragging(false)} onKeyDown={moveThumbWithKeyboard} />
    </div>
  </div>;
}

function VerticalScrollIndicator({ scrollerRef, label }: { scrollerRef: RefObject<HTMLFormElement | null>; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const dragOffsetRef = useRef(0);
  const [thumb, setThumb] = useState({ top: 0, height: 100 });
  const [dragging, setDragging] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  const updateIndicator = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
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
  }, [scrollerRef]);

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

  return <div ref={trackRef} className="modal-scrollbar">
    <button ref={thumbRef} type="button" className={`modal-scroll-thumb${dragging ? " dragging" : ""}`} style={{ top: `calc(${thumb.top}% + 1px)`, height: `calc(${thumb.height}% - 2px)` }} aria-label={`Scroll ${label}`} onPointerDown={beginDrag} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) scrollFromThumb(event.clientY); }} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => setDragging(false)} onKeyDown={handleKeyDown} />
  </div>;
}

function TrackingBuilder({ lists, amounts, onListsChange, onAmountsChange }: { lists: RoutineListDraft[]; amounts: RoutineAmount[]; onListsChange: (lists: RoutineListDraft[]) => void; onAmountsChange: (amounts: RoutineAmount[]) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const trackingMode = trackingModeFor(lists, amounts);
  const makeKey = (type: "list" | "amount", count: number) => `${type}-${Date.now().toString(36)}-${count + 1}`;
  const addList = () => {
    if (lists.length >= 6) return;
    onListsChange([...lists, { key: makeKey("list", lists.length), name: "", items: "" }]);
    setMenuOpen(false);
  };
  const addAmount = () => {
    if (amounts.length >= 6) return;
    onAmountsChange([...amounts, { key: makeKey("amount", amounts.length), name: "", targetCount: 4 }]);
    setMenuOpen(false);
  };
  return <fieldset className="tracking-builder">
    <legend>Tracking</legend>
    <input type="hidden" name="trackingMode" value={trackingMode} />
    <input type="hidden" name="lists" value={JSON.stringify(lists)} />
    <input type="hidden" name="amounts" value={JSON.stringify(amounts)} />
    <div className="tracking-add-wrap">
      <button type="button" className="tracking-add-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>+ Add tracking</button>
      {menuOpen && <div className="tracking-add-menu">
        <button type="button" onClick={addList} disabled={lists.length >= 6}><span aria-hidden="true">☷</span><div><strong>List</strong><small>Named steps to check off</small></div></button>
        <button type="button" onClick={addAmount} disabled={amounts.length >= 6}><span aria-hidden="true">▥</span><div><strong>Daily amount</strong><small>A named numbered tracker</small></div></button>
      </div>}
    </div>
    {!lists.length && !amounts.length && <p className="tracking-empty-note">No extras yet · this will save as one check.</p>}
    <div className="tracking-blocks">
      {lists.map((list, index) => <section className="tracking-block tracking-list-block" key={list.key}>
        <header><span aria-hidden="true">☷</span><strong>List</strong><button type="button" onClick={() => onListsChange(lists.filter((item) => item.key !== list.key))} aria-label={`Remove ${list.name || `list ${index + 1}`}`}><Trash2 aria-hidden="true" /></button></header>
        <label className="field"><span>List name</span><input value={list.name} onChange={(event) => onListsChange(lists.map((item) => item.key === list.key ? { ...item, name: event.target.value } : item))} placeholder="e.g. Morning checklist" maxLength={24} required /></label>
        <label className="field"><span>Items <small>One per line</small></span><textarea value={list.items} onChange={(event) => onListsChange(lists.map((item) => item.key === list.key ? { ...item, items: event.target.value } : item))} placeholder={"First step\nSecond step\nThird step"} maxLength={1000} required /></label>
      </section>)}
      {amounts.map((amount, index) => <section className="tracking-block tracking-amount-block" key={amount.key}>
        <header><span aria-hidden="true">▥</span><strong>Daily amount</strong><button type="button" onClick={() => onAmountsChange(amounts.filter((item) => item.key !== amount.key))} aria-label={`Remove ${amount.name || `amount ${index + 1}`}`}><Trash2 aria-hidden="true" /></button></header>
        <div className="tracking-amount-fields"><label className="field"><span>Name</span><input value={amount.name} onChange={(event) => onAmountsChange(amounts.map((item) => item.key === amount.key ? { ...item, name: event.target.value } : item))} placeholder="e.g. Vitamin C" maxLength={24} required /></label>
        <label className="field"><span>Amount</span><input type="number" min="2" max="12" value={amount.targetCount} onChange={(event) => onAmountsChange(amounts.map((item) => item.key === amount.key ? { ...item, targetCount: Math.min(12, Math.max(2, Number(event.target.value) || 2)) } : item))} required /></label></div>
      </section>)}
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

function DayPlanSettings({ scheduledDays, variants = {} }: { scheduledDays: number[]; variants?: Partial<Record<number, string>> }) {
  const hasPlans = scheduledDays.some((day) => Boolean(variants[day]));
  const [enabled, setEnabled] = useState(hasPlans);
  return <section className="day-plan-settings">
    <label className="day-plan-toggle">
      <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
      <span className="toggle-track"><i /></span>
      <span><strong>Different plan by day</strong><small>Give each day its own meal, workout, or variation.</small></span>
    </label>
    {enabled && <div className="day-plan-grid">
      {scheduledDays.length ? scheduledDays.map((day) => <label className="field" key={day}>
        <span>{DAY_FULL_NAMES[day]}</span>
        <input name={`dayVariant-${day}`} defaultValue={variants[day] ?? ""} placeholder={day === 1 ? "e.g. Oatmeal" : day === 2 ? "e.g. Eggs and toast" : "What’s the plan?"} maxLength={80} />
      </label>) : <p>Choose at least one repeat day first.</p>}
    </div>}
  </section>;
}

function LoadingRows() {
  return <div className="loading-list" aria-label="Loading routines"><i /><i /><i /></div>;
}

function EmptyToday({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><span className="empty-state-icon" aria-hidden="true"><CalendarPlus2 /></span><h3>Your day is wide open</h3><p>Add a routine and it’ll appear here on the right days.</p><button className="primary-button premium-action" onClick={onAdd}>Add your first routine</button></div>;
}
