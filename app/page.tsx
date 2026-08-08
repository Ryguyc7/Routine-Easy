"use client";

import { FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CalendarPlus2, ChevronLeft, ChevronRight, CircleCheckBig, CircleUserRound, Clock3, ListChecks, Settings2, Sparkles, Trash2, type LucideIcon } from "lucide-react";

type RoutineItem = { id: number; routineId: number; title: string; position: number };
type TrackingMode = "simple" | "checklist" | "quantity";
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
  dayVariants: Partial<Record<number, string>>;
  startDate: string;
  endDate: string;
  items: RoutineItem[];
};

type Completion = { routineId: number; date: string };
type ItemCompletion = { itemId: number; date: string };
type QuantityCompletion = { routineId: number; date: string; count: number };
type Tab = "today" | "calendar" | "routines" | "settings";
type OnboardingState = "checking" | "show" | "done";
type TimeFormat = "12-hour" | "24-hour";
type WeekStart = "sunday" | "monday";
type MotionPreference = "full" | "reduced";
type AppPreferences = { timeFormat: TimeFormat; weekStartsOn: WeekStart; motion: MotionPreference };

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
  const [quantityCompletions, setQuantityCompletions] = useState<QuantityCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoutine, setSelectedRoutine] = useState<number | "all">("all");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [showAdd, setShowAdd] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [routineToDelete, setRoutineToDelete] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const addTimerRef = useRef<number | null>(null);
  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKey(today);

  async function loadData() {
    try {
      const response = await fetch("/api/routines", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load your routines.");
      const data = await response.json();
      setRoutines(data.routines);
      setCompletions(data.completions);
      setItemCompletions(data.itemCompletions ?? []);
      setQuantityCompletions(data.quantityCompletions ?? []);
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
      setShowAdd(true);
      return;
    }
    setShowAdd(false);
    setTab("routines");
    addTimerRef.current = window.setTimeout(() => {
      setShowAdd(true);
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
      setShowAdd(true);
    }
    setOnboardingState("done");
  }

  const todayRoutines = routines.filter((routine) => routine.days.includes(today.getDay()) && routineActiveOnDate(routine, todayKey));
  const completedToday = new Set(
    completions.filter((item) => item.date === todayKey).map((item) => item.routineId),
  );
  const completedItemsToday = new Set(
    itemCompletions.filter((item) => item.date === todayKey).map((item) => item.itemId),
  );
  const quantityCount = (routineId: number, date = todayKey) => quantityCompletions.find((item) => item.routineId === routineId && item.date === date)?.count ?? 0;
  const isRoutineDone = (routine: Routine) => routine.trackingMode === "quantity"
    ? quantityCount(routine.id) >= routine.targetCount
    : routine.trackingMode === "checklist"
      ? routine.items.length > 0 && routine.items.every((item) => completedItemsToday.has(item.id))
      : completedToday.has(routine.id);
  const doneCount = todayRoutines.filter(isRoutineDone).length;
  const progress = todayRoutines.length ? Math.round((doneCount / todayRoutines.length) * 100) : 0;
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
    if (routine?.trackingMode === "quantity") {
      const current = quantityCount(routineId, date);
      await setQuantity(routineId, current >= routine.targetCount ? 0 : routine.targetCount, date);
      return;
    }
    if (routine?.trackingMode === "checklist" && routine.items.length) {
      const currentlyDone = routine.items.every((item) => itemCompletions.some((completion) => completion.itemId === item.id && completion.date === date));
      const routineItemIds = new Set(routine.items.map((item) => item.id));
      setItemCompletions((items) => currentlyDone
        ? items.filter((item) => item.date !== date || !routineItemIds.has(item.itemId))
        : [...items.filter((item) => item.date !== date || !routineItemIds.has(item.itemId)), ...routine.items.map((item) => ({ itemId: item.id, date }))],
      );
      const response = await fetch("/api/item-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routineId, date, completed: !currentlyDone }),
      });
      if (!response.ok) loadData();
      return;
    }
    const currentlyDone = completions.some((item) => item.routineId === routineId && item.date === date);
    setCompletions((items) =>
      currentlyDone
        ? items.filter((item) => !(item.routineId === routineId && item.date === date))
        : [...items, { routineId, date }],
    );
    const response = await fetch("/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routineId, date, completed: !currentlyDone }),
    });
    if (!response.ok) loadData();
  }

  async function setQuantity(routineId: number, count: number, date = todayKey) {
    const routine = routines.find((item) => item.id === routineId);
    if (!routine || routine.trackingMode !== "quantity") return;
    const safeCount = Math.min(routine.targetCount, Math.max(0, Math.round(count)));
    setQuantityCompletions((items) => safeCount === 0
      ? items.filter((item) => !(item.routineId === routineId && item.date === date))
      : [...items.filter((item) => !(item.routineId === routineId && item.date === date)), { routineId, date, count: safeCount }],
    );
    const response = await fetch("/api/quantity-completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routineId, date, count: safeCount }),
    });
    if (!response.ok) loadData();
  }

  async function toggleItem(itemId: number, date = todayKey) {
    const currentlyDone = itemCompletions.some((item) => item.itemId === itemId && item.date === date);
    setItemCompletions((items) => currentlyDone
      ? items.filter((item) => !(item.itemId === itemId && item.date === date))
      : [...items, { itemId, date }],
    );
    const response = await fetch("/api/item-completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, date, completed: !currentlyDone }),
    });
    if (!response.ok) loadData();
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
        targetCount: Number(form.get("targetCount") ?? 4),
        unit: form.get("unit"),
        dayVariants: readDayVariants(form),
        startDate: form.get("startDate"),
        endDate: form.get("endDate"),
        items: trackingMode === "checklist" ? String(form.get("checklist") ?? "").split("\n").map((item) => item.trim()).filter(Boolean) : [],
      }),
    });
    if (response.ok) {
      const data = await response.json();
      setRoutines((items) => [...items, data.routine]);
      setShowAdd(false);
      setError("");
    } else {
      setError("That routine could not be added. Please try again.");
    }
    setSaving(false);
  }

  async function deleteRoutine(id: number) {
    setDeleting(true);
    const itemIds = new Set(routines.find((routine) => routine.id === id)?.items.map((item) => item.id) ?? []);
    setRoutines((items) => items.filter((routine) => routine.id !== id));
    setCompletions((items) => items.filter((item) => item.routineId !== id));
    setItemCompletions((items) => items.filter((item) => !itemIds.has(item.itemId)));
    setQuantityCompletions((items) => items.filter((item) => item.routineId !== id));
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
    setSavingList(true);
    const form = new FormData(event.currentTarget);
    const trackingMode = String(form.get("trackingMode") ?? "simple") as TrackingMode;
    const items = trackingMode === "checklist" ? String(form.get("checklist") ?? "").split("\n").map((item) => item.trim()).filter(Boolean) : [];
    const response = await fetch("/api/routines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: routine.id,
        time: form.get("time"),
        trackingMode,
        targetCount: Number(form.get("targetCount") ?? 4),
        unit: form.get("unit"),
        dayVariants: readDayVariants(form),
        startDate: form.get("startDate"),
        endDate: form.get("endDate"),
        items,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      const previousIds = new Set(routine.items.map((item) => item.id));
      setRoutines((all) => all.map((item) => item.id === routine.id ? data.routine : item));
      setItemCompletions((all) => all.filter((item) => !previousIds.has(item.itemId)));
      setQuantityCompletions((all) => all.filter((item) => item.routineId !== routine.id));
      setEditingRoutineId(null);
      setError("");
    } else {
      setError("Those routine options could not be saved. Please try again.");
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
        <div className="brand" aria-label="RoutineEZ home">
          <img className="brand-logo" src="/routineez-mark.png" alt="" />
          <span>RoutineEZ</span>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          <NavButton active={tab === "today"} onClick={() => setTab("today")} icon={CircleCheckBig} label="Today" />
          <NavButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={CalendarDays} label="Calendar" />
          <NavButton active={tab === "routines"} onClick={() => setTab("routines")} icon={ListChecks} label="Routines" />
          <NavButton active={tab === "settings"} onClick={openSettings} icon={Settings2} label="Settings" />
        </nav>
        <div className="sidebar-note">
          <span className="spark">✦</span>
          <strong>Small steps add up.</strong>
          <p>Keep showing up, one routine at a time.</p>
        </div>
      </aside>

      <section className="content">
        <header className="mobile-header">
          <button className={`mobile-profile${showProfile ? " active" : ""}`} onClick={() => setShowProfile((visible) => !visible)} aria-label="Open profile" aria-expanded={showProfile}><CircleUserRound aria-hidden="true" /></button>
          <div className="mobile-wordmark" aria-label="RoutineEZ">
            <img src="/routineez-mark.png" alt="" />
            <span className="mobile-wordmark-name">Routine<span className="mobile-wordmark-ez">EZ</span></span>
          </div>
          <button className="mobile-add premium-action" onClick={openAddFromHeader} aria-label="Add routine"><span aria-hidden="true">+</span></button>
        </header>

        {showProfile && <div className="profile-popover-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowProfile(false); }}>
          <section className="profile-card" role="dialog" aria-label="Your RoutineEZ profile">
            <button className="profile-close" onClick={() => setShowProfile(false)} aria-label="Close profile">×</button>
            <div className="profile-avatar"><CircleUserRound aria-hidden="true" /></div>
            <div className="profile-copy"><small>Your profile</small><h2>My RoutineEZ</h2><p>Small routines. Easier days.</p></div>
            <div className="profile-stats"><div><strong>{routines.length}</strong><span>Routines</span></div><div><strong>{doneCount}/{todayRoutines.length}</strong><span>Done today</span></div></div>
            <div className="profile-actions">
              <button className="profile-settings-button" onClick={openSettings}><Settings2 aria-hidden="true" />Settings</button>
              <button className="profile-routines-button" onClick={() => { setTab("routines"); setShowProfile(false); }}>Manage routines</button>
            </div>
          </section>
        </div>}

        {routineToDelete && <DeleteRoutineDialog routine={routineToDelete} deleting={deleting} onCancel={() => setRoutineToDelete(null)} onConfirm={() => deleteRoutine(routineToDelete.id)} />}

        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}

        {tab === "today" && (
          <div className="page today-page">
            <div className="desktop-today-date"><DateTile date={today} /></div>

            <section className="progress-card">
              <div className="progress-copy">
                <span className="progress-icon">✦</span>
                <div><strong>{progress === 100 ? "Beautiful work!" : progress > 50 ? "You’re on a roll!" : "Let’s make a start"}</strong><p>{doneCount} of {todayRoutines.length} routines complete</p></div>
              </div>
              <div className="progress-number" aria-label={`${progress}% complete`}><span aria-hidden="true">{animatedProgress}%</span></div>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            </section>

            <section className="routine-section">
              <div className="section-title"><h2>Today’s routines</h2><span>{todayRoutines.length} items</span></div>
              <div className="routine-list">
                {loading ? <LoadingRows /> : todayRoutines.length ? todayRoutines.map((routine) => (
                  <RoutineRow
                    key={routine.id}
                    routine={routine}
                    completed={isRoutineDone(routine)}
                    completedItemIds={completedItemsToday}
                    quantityCount={quantityCount(routine.id)}
                    onToggle={() => toggleRoutine(routine.id)}
                    onToggleItem={toggleItem}
                    onSetQuantity={(count) => setQuantity(routine.id, count)}
                    timeFormat={preferences.timeFormat}
                  />
                )) : <EmptyToday onAdd={() => { setTab("routines"); setShowAdd(true); }} />}
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
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft aria-hidden="true" /></button>
                <div className="calendar-month-heading"><h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>{!viewingCurrentMonth && <button className="calendar-today-button" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>}</div>
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight aria-hidden="true" /></button>
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
            </section>
            <div className="calendar-legend">Colored bars show the routines scheduled for each day.</div>
          </div>
        )}

        {tab === "routines" && (
          <div className="page routines-page">
            {showAdd && <AddRoutineForm onSubmit={addRoutine} onCancel={() => setShowAdd(false)} saving={saving} timeFormat={preferences.timeFormat} />}
            {editingRoutineId !== null && (() => {
              const routine = routines.find((item) => item.id === editingRoutineId);
              return routine ? <RoutineOptionsEditor routine={routine} onSubmit={(event) => saveRoutineOptions(event, routine)} onCancel={() => setEditingRoutineId(null)} saving={savingList} /> : null;
            })()}
            <section className="routine-library">
              <div className="section-title"><h2>Your routines</h2><div className="section-title-actions"><span>{routines.length} total</span><button className="desktop-routine-add premium-action" onClick={() => { setEditingRoutineId(null); setShowAdd(true); }}>+ Add routine</button></div></div>
              <div className="routine-grid">
                {loading ? <LoadingRows /> : routines.map((routine) => <RoutineCard key={routine.id} routine={routine} timeFormat={preferences.timeFormat} onEditOptions={() => { setShowAdd(false); setEditingRoutineId(routine.id); }} onDelete={() => setRoutineToDelete(routine)} />)}
              </div>
            </section>
          </div>
        )}

        {tab === "settings" && <SettingsPage preferences={preferences} onChange={updatePreferences} />}
      </section>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavButton active={tab === "today"} onClick={() => setTab("today")} icon={CircleCheckBig} label="Today" />
        <CalendarNavButton active={tab === "calendar"} onClick={() => setTab("calendar")} date={today} />
        <NavButton active={tab === "routines"} onClick={() => setTab("routines")} icon={ListChecks} label="Routines" />
      </nav>
    </main>
  );
}

function SettingsPage({ preferences, onChange }: { preferences: AppPreferences; onChange: (next: Partial<AppPreferences>) => void }) {
  return <div className="page settings-page">
    <header className="settings-heading"><span>Make it yours</span><h1>Settings</h1><p>Choose how RoutineEZ looks and feels. Changes save automatically on this device.</p></header>
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
        <div className="brand" aria-label="RoutineEZ"><img className="brand-logo" src="/routineez-mark.png" alt="" /><span>RoutineEZ</span></div>
        <button className="onboarding-skip" onClick={() => onComplete(false)}>Skip for now</button>
      </header>
      <div className="onboarding-layout">
        <div className="onboarding-copy">
          <p className="eyebrow">Welcome to your new rhythm</p>
          <h1 id="onboarding-title">Small routines.<br /><span>Easier days.</span></h1>
          <p className="onboarding-lead">Plan the little things that keep your day moving—from workouts and vitamins to breakfast, lunch, and dinner.</p>
          <div className="onboarding-benefits" aria-label="RoutineEZ features">
            <div><span className="benefit-icon purple">✓</span><p><strong>Simple check-offs</strong><small>See today and keep moving.</small></p></div>
            <div><span className="benefit-icon coral">●</span><p><strong>Color-coded plans</strong><small>Your routines at a glance.</small></p></div>
            <div><span className="benefit-icon green">↗</span><p><strong>Gentle progress</strong><small>Small wins that add up.</small></p></div>
          </div>
          <button className="onboarding-cta premium-action" onClick={() => onComplete(true)}><span>Build my first routine</span><i aria-hidden="true">→</i></button>
          <p className="onboarding-note">No pressure. Start with just one thing.</p>
        </div>
        <div className="onboarding-visual">
          <div className="onboarding-image-wrap">
            <img src="/og.png" alt="RoutineEZ color-coded routine checklist preview" />
          </div>
          <div className="onboarding-mini-card"><span>✦</span><div><strong>A calmer day starts small.</strong><small>One routine is enough.</small></div></div>
        </div>
      </div>
    </section>
  </main>;
}

function OnboardingSplash() {
  return <main className="onboarding-splash" aria-label="Loading RoutineEZ">
    <div className="splash-brand">
      <img className="splash-logo" src="/routineez-mark.png" alt="" />
      <div className="splash-wordmark" aria-hidden="true">
        <span className="splash-routine">Routine</span><span className="splash-ez">EZ</span>
      </div>
    </div>
  </main>;
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

function RoutineRow({ routine, completed, completedItemIds, quantityCount: count, onToggle, onToggleItem, onSetQuantity, timeFormat }: { routine: Routine; completed: boolean; completedItemIds: Set<number>; quantityCount: number; onToggle: () => void; onToggleItem: (itemId: number) => void; onSetQuantity: (count: number) => void; timeFormat: TimeFormat }) {
  const hasDetails = (routine.trackingMode === "checklist" && routine.items.length > 0) || (routine.trackingMode === "quantity" && routine.targetCount > 1);
  const [expanded, setExpanded] = useState(false);
  const completedCount = routine.items.filter((item) => completedItemIds.has(item.id)).length;
  const todayVariant = routine.dayVariants?.[new Date().getDay()] ?? "";
  const progressValue = routine.trackingMode === "quantity"
    ? Math.min(100, Math.round((count / routine.targetCount) * 100))
    : routine.trackingMode === "checklist" && routine.items.length
      ? Math.round((completedCount / routine.items.length) * 100)
      : completed ? 100 : 0;
  const detail = routine.trackingMode === "quantity"
    ? `${count}/${routine.targetCount} ${routine.unit}`
    : routine.trackingMode === "checklist"
      ? `${completedCount}/${routine.items.length} items`
      : "";
  const handleMainClick = () => {
    if (hasDetails) setExpanded((value) => !value);
    else onToggle();
  };
  return <article className={`routine-row mode-${routine.trackingMode} ${completed ? "completed" : ""} ${expanded ? "expanded" : ""}`} style={{ "--routine": routine.color } as React.CSSProperties}>
    <button className="routine-main" onClick={handleMainClick} aria-expanded={hasDetails ? expanded : undefined}>
      <span className="routine-emoji">{routine.emoji}</span>
      <span className="routine-info"><strong>{routine.name}</strong><small>{todayVariant && <b className="today-variant">{todayVariant}</b>}{todayVariant && " · "}{formatRoutineTime(routine.time, timeFormat)}{detail ? ` · ${detail}` : ""}</small></span>
      {hasDetails && <span className="expand-chevron" aria-hidden="true" />}
    </button>
    <button className="check-circle" onClick={onToggle} aria-label={completed ? `Mark ${routine.name} incomplete` : `Complete ${routine.name}`}>✓</button>
    {routine.trackingMode === "quantity" && expanded && <QuantityTracker routine={routine} count={count} onChange={onSetQuantity} />}
    {routine.trackingMode === "checklist" && routine.items.length > 0 && expanded && <div className="routine-checklist">
      {routine.items.map((item) => {
        const checked = completedItemIds.has(item.id);
        return <button key={item.id} className={checked ? "checked" : ""} onClick={() => onToggleItem(item.id)}>
          <span className="item-check">✓</span><span>{item.title}</span>
        </button>;
      })}
    </div>}
    {!expanded && <div className="collapsed-progress" role="progressbar" aria-label={`${routine.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}>
      <span style={{ width: `${progressValue}%` }} />
    </div>}
  </article>;
}

function QuantityTracker({ routine, count, onChange }: { routine: Routine; count: number; onChange: (count: number) => void }) {
  return <div className="quantity-tracker">
    <div className="quantity-caption"><span>Daily amount</span><strong>{count} of {routine.targetCount} {routine.unit}</strong></div>
    <div className="quantity-pill" style={{ "--segments": routine.targetCount } as React.CSSProperties} role="group" aria-label={`${routine.name}: ${count} of ${routine.targetCount} ${routine.unit}`}>
      {Array.from({ length: routine.targetCount }, (_, index) => {
        const amount = index + 1;
        const filled = amount <= count;
        return <button key={amount} type="button" className={filled ? "filled" : ""} onClick={() => onChange(filled ? amount - 1 : amount)} aria-label={`${filled ? "Remove" : "Record"} ${routine.unit} ${amount}`} aria-pressed={filled}>
          <span>{filled ? "✓" : amount}</span>
        </button>;
      })}
    </div>
  </div>;
}

function RoutineCard({ routine, timeFormat, onEditOptions, onDelete }: { routine: Routine; timeFormat: TimeFormat; onEditOptions: () => void; onDelete: () => void }) {
  const dayLabel = routine.days.length === 7 ? "Every day" : routine.days.map((day) => DAY_NAMES[day]).join(" · ");
  const trackingLabel = routine.trackingMode === "quantity"
    ? `${routine.targetCount} ${routine.unit} daily`
    : routine.trackingMode === "checklist"
      ? `${routine.items.length} list items`
      : "Single check";
  return <article className="routine-card" style={{ "--routine": routine.color } as React.CSSProperties}>
    <div className="card-color"><span>{routine.emoji}</span></div>
    <div className="card-body"><strong>{routine.name}</strong><p>{dayLabel}</p><small>{formatRoutineTime(routine.time, timeFormat)} · {trackingLabel}</small><small className="date-range-label">{formatDateRange(routine)}</small></div>
    <button className="list-button" onClick={onEditOptions}>Options</button>
    <button className="delete-button" onClick={onDelete} aria-label={`Delete ${routine.name}`}>×</button>
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

function RoutineLivePreview({ name, time, emoji, color, trackingMode, checklist, targetCount, unit, timeFormat }: { name: string; time: string; emoji: string; color: string; trackingMode: TrackingMode; checklist: string; targetCount: number; unit: string; timeFormat: TimeFormat }) {
  const items = useMemo(() => checklist.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), [checklist]);
  const [expanded, setExpanded] = useState(false);
  const [simpleDone, setSimpleDone] = useState(false);
  const [checkedItems, setCheckedItems] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(0);
  const hasDetails = trackingMode !== "simple";
  const completed = trackingMode === "simple"
    ? simpleDone
    : trackingMode === "checklist"
      ? items.length > 0 && checkedItems.length === items.length
      : quantity >= targetCount;
  const detail = trackingMode === "simple"
    ? "Single check"
    : trackingMode === "checklist"
      ? items.length ? `${checkedItems.length}/${items.length} items` : "List · Add items below"
      : `${quantity}/${targetCount} ${unit || "times"}`;

  useEffect(() => {
    setExpanded(trackingMode !== "simple");
    setSimpleDone(false);
    setCheckedItems([]);
    setQuantity(0);
  }, [trackingMode]);

  useEffect(() => {
    setCheckedItems((checked) => checked.filter((index) => index < items.length));
  }, [items.length]);

  useEffect(() => {
    setQuantity((count) => Math.min(count, targetCount));
  }, [targetCount]);

  const toggleAll = () => {
    if (trackingMode === "simple") setSimpleDone((done) => !done);
    else if (trackingMode === "checklist") setCheckedItems(completed ? [] : items.map((_, index) => index));
    else setQuantity(completed ? 0 : targetCount);
  };

  return <section className={`routine-live-preview${expanded ? " expanded" : ""}${completed ? " completed" : ""}`} style={{ "--preview": color } as React.CSSProperties} aria-label="Interactive routine preview">
    <div className="preview-summary">
      <button type="button" className="preview-main" onClick={() => hasDetails ? setExpanded((value) => !value) : toggleAll()} aria-expanded={hasDetails ? expanded : undefined}>
        <span className="preview-icon" aria-hidden="true">{emoji}</span>
        <span className="preview-copy"><small>Live preview</small><strong>{name.trim() || "Your new routine"}</strong><span>{formatRoutineTime(time, timeFormat)} · {detail}</span></span>
        {hasDetails && <span className="preview-chevron" aria-hidden="true" />}
      </button>
      <button type="button" className={`preview-check${completed ? " checked" : ""}`} onClick={toggleAll} aria-label={completed ? "Reset preview completion" : "Complete preview routine"}>{completed ? "✓" : ""}</button>
    </div>
    {expanded && trackingMode === "checklist" && <div className="preview-details preview-list">
      {items.length ? items.map((item, index) => {
        const checked = checkedItems.includes(index);
        return <button type="button" key={`${item}-${index}`} className={checked ? "checked" : ""} onClick={() => setCheckedItems((current) => checked ? current.filter((value) => value !== index) : [...current, index].sort((a, b) => a - b))}><span>{checked ? "✓" : ""}</span>{item}</button>;
      }) : <p>Type checklist items below to try them here.</p>}
    </div>}
    {expanded && trackingMode === "quantity" && <div className="preview-details">
      <div className="preview-quantity" style={{ "--preview-segments": targetCount } as React.CSSProperties}>
        {Array.from({ length: targetCount }, (_, index) => {
          const amount = index + 1;
          const filled = amount <= quantity;
          return <button type="button" key={amount} className={filled ? "filled" : ""} onClick={() => setQuantity(filled ? amount - 1 : amount)} aria-label={`${filled ? "Remove" : "Record"} ${unit || "amount"} ${amount}`}>{filled ? "✓" : amount}</button>;
        })}
      </div>
    </div>}
  </section>;
}

function AddRoutineForm({ onSubmit, onCancel, saving, timeFormat }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; saving: boolean; timeFormat: TimeFormat }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("simple");
  const [selectedDays, setSelectedDays] = useState(() => DAY_NAMES.map((_, day) => day));
  const [previewName, setPreviewName] = useState("");
  const [previewTime, setPreviewTime] = useState("");
  const [previewEmoji, setPreviewEmoji] = useState(EMOJIS[0]);
  const [previewColor, setPreviewColor] = useState(COLORS[0]);
  const [previewChecklist, setPreviewChecklist] = useState("");
  const [previewTargetCount, setPreviewTargetCount] = useState(4);
  const [previewUnit, setPreviewUnit] = useState("pills");
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
    const modal = input.closest(".add-routine-modal");
    window.requestAnimationFrame(() => {
      if (modal instanceof HTMLElement) modal.scrollLeft = 0;
    });
  };

  return <div className="add-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
  <div className="add-modal-stack">
  <RoutineLivePreview name={previewName} time={previewTime} emoji={previewEmoji} color={previewColor} trackingMode={trackingMode} checklist={previewChecklist} targetCount={previewTargetCount} unit={previewUnit} timeFormat={timeFormat} />
  <div className="add-form-shell">
  <form ref={formRef} className="add-card add-routine-modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-label="Add a routine">
    <div className="form-grid">
      <label className="field wide"><span>Routine name</span><input name="name" value={previewName} onChange={(event) => setPreviewName(event.target.value)} placeholder="e.g. Take vitamins" required maxLength={40} autoFocus /></label>
      <TimeField onValueChange={setPreviewTime} />
      <DateRangeSettings />
      <TrackingModePicker value={trackingMode} onChange={setTrackingMode} />
      {trackingMode === "checklist" && <label className="field checklist-field"><span>Checklist items <small>One per line</small></span><textarea name="checklist" value={previewChecklist} onChange={(event) => setPreviewChecklist(event.target.value)} placeholder={"Warm up\nMain workout\nCool down"} maxLength={1000} /></label>}
      {trackingMode === "quantity" && <QuantitySettings onValueChange={(targetCount, unit) => { setPreviewTargetCount(targetCount); setPreviewUnit(unit); }} />}
      <fieldset className="emoji-picker"><legend>Icon</legend><ScrollablePicker label="Icon">{EMOJIS.map((emoji, i) => <label key={emoji}><input type="radio" name="emoji" value={emoji} defaultChecked={i === 0} onChange={(event) => { setPreviewEmoji(emoji); keepModalAligned(event.currentTarget); }} /><span>{emoji}</span></label>)}</ScrollablePicker></fieldset>
      <fieldset className="color-picker"><legend>Color</legend><ScrollablePicker label="Color">{COLORS.map((color, i) => <label key={color}><input type="radio" name="color" value={color} defaultChecked={i === 0} onChange={(event) => { setPreviewColor(color); keepModalAligned(event.currentTarget); }} /><span style={{ background: color }} /></label>)}</ScrollablePicker></fieldset>
      <fieldset className="day-picker"><legend>Repeat on</legend>{DAY_NAMES.map((day, i) => <label key={day}><input type="checkbox" name={`day-${i}`} checked={selectedDays.includes(i)} onChange={() => setSelectedDays((days) => days.includes(i) ? days.filter((item) => item !== i) : [...days, i].sort())} /><span>{day.slice(0, 1)}</span></label>)}</fieldset>
      <DayPlanSettings scheduledDays={selectedDays} />
    </div>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button premium-action" disabled={saving}>{saving ? "Adding…" : "Add routine"}</button></div>
  </form>
  <VerticalScrollIndicator scrollerRef={formRef} label="Add routine form" />
  </div>
  </div>
  </div>;
}

function RoutineOptionsEditor({ routine, onSubmit, onCancel, saving }: { routine: Routine; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; saving: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(routine.trackingMode);
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

  return <div className="edit-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
  <div className="edit-form-shell">
  <form ref={formRef} className="add-card checklist-editor edit-routine-modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-label={`Edit ${routine.name}`}>
    <div className="add-card-header"><div><span className="eyebrow">How {routine.name} works</span><h2>Routine options</h2><p>Choose the check-off style that fits this routine.</p></div><button type="button" onClick={onCancel} aria-label="Close">×</button></div>
    <div className="form-grid options-grid">
      <TimeField defaultValue={routine.time} />
      <DateRangeSettings startDate={routine.startDate} endDate={routine.endDate} />
      <TrackingModePicker value={trackingMode} onChange={setTrackingMode} />
      {trackingMode === "checklist" && <label className="field checklist-field"><span>List items <small>One item per line</small></span><textarea name="checklist" defaultValue={routine.items.map((item) => item.title).join("\n")} placeholder={"First step\nSecond step\nThird step"} maxLength={1000} autoFocus /></label>}
      {trackingMode === "quantity" && <QuantitySettings targetCount={routine.targetCount} unit={routine.unit} />}
      <DayPlanSettings scheduledDays={routine.days} variants={routine.dayVariants} />
    </div>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button premium-action" disabled={saving}>{saving ? "Saving…" : "Save options"}</button></div>
  </form>
  <VerticalScrollIndicator scrollerRef={formRef} label="Routine options form" />
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
    observer.observe(scroller);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
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

  const updateIndicator = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
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

  return <div ref={trackRef} className="modal-scrollbar">
    <button ref={thumbRef} type="button" className={`modal-scroll-thumb${dragging ? " dragging" : ""}`} style={{ top: `calc(${thumb.top}% + 1px)`, height: `calc(${thumb.height}% - 2px)` }} aria-label={`Scroll ${label}`} onPointerDown={beginDrag} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) scrollFromThumb(event.clientY); }} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => setDragging(false)} onKeyDown={handleKeyDown} />
  </div>;
}

function TrackingModePicker({ value, onChange }: { value: TrackingMode; onChange: (mode: TrackingMode) => void }) {
  const choices: Array<{ mode: TrackingMode; title: string; note: string; icon: string }> = [
    { mode: "simple", title: "One check", note: "Done or not done", icon: "✓" },
    { mode: "checklist", title: "List", note: "Check off steps", icon: "☷" },
    { mode: "quantity", title: "Daily amount", note: "Track pills or servings", icon: "▥" },
  ];
  return <fieldset className="tracking-picker">
    <legend>How do you want to track it?</legend>
    <div className="tracking-options">
      {choices.map((choice) => <label key={choice.mode} className={value === choice.mode ? "selected" : ""}>
        <input type="radio" name="trackingMode" value={choice.mode} checked={value === choice.mode} onChange={() => onChange(choice.mode)} />
        <span className="tracking-icon" aria-hidden="true">{choice.icon}</span>
        <span><strong>{choice.title}</strong><small>{choice.note}</small></span>
      </label>)}
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

function QuantitySettings({ targetCount = 4, unit = "pills", onValueChange }: { targetCount?: number; unit?: string; onValueChange?: (targetCount: number, unit: string) => void }) {
  const [count, setCount] = useState(Math.max(2, targetCount));
  const [unitValue, setUnitValue] = useState(unit === "times" ? "pills" : unit);
  const updateCount = (value: number) => {
    const next = Math.min(12, Math.max(2, value || 2));
    setCount(next);
    onValueChange?.(next, unitValue);
  };
  const updateUnit = (value: string) => {
    setUnitValue(value);
    onValueChange?.(count, value);
  };
  return <div className="quantity-settings">
    <label className="field"><span>Daily amount</span><input name="targetCount" type="number" min="2" max="12" value={count} onChange={(event) => updateCount(Number(event.target.value))} required /></label>
    <label className="field"><span>What are you counting?</span><input name="unit" value={unitValue} onChange={(event) => updateUnit(event.target.value)} placeholder="pills" maxLength={24} required /></label>
    <p>Each amount becomes one tappable section in the horizontal tracker.</p>
  </div>;
}

function LoadingRows() {
  return <div className="loading-list" aria-label="Loading routines"><i /><i /><i /></div>;
}

function EmptyToday({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><span className="empty-state-icon" aria-hidden="true"><CalendarPlus2 /></span><h3>Your day is wide open</h3><p>Add a routine and it’ll appear here on the right days.</p><button className="primary-button premium-action" onClick={onAdd}>Add your first routine</button></div>;
}
