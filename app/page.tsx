"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CalendarPlus2, ChevronLeft, ChevronRight, CircleCheckBig, ListChecks, type LucideIcon } from "lucide-react";

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
type Tab = "today" | "calendar" | "routines";
type OnboardingState = "checking" | "show" | "done";

const COLORS = ["#6C5CE7", "#FF8A65", "#F4B942", "#49A078", "#4D96FF", "#EC6F91", "#00A896", "#8E7DBE", "#E76F51", "#2A9D8F", "#8D6E63", "#EF476F", "#3A86FF", "#8338EC", "#6A994E", "#FFBE0B"];
const EMOJIS = ["✨", "💊", "🏋️", "🥣", "🥗", "🍲", "🧘", "💧", "🍳", "🥑", "☕", "🍎", "🥕", "🥪", "🍝", "🥤", "🏃", "🚶", "🚴", "📚", "🛏️", "🧹", "🐕", "🌿", "🧴", "🪥"];
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

function useAnimatedNumber(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
    setOnboardingState(forceOnboarding || !completed ? "show" : "done");
    loadData();
    return () => {
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
  const animatedProgress = useAnimatedNumber(progress);

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
    const itemIds = new Set(routines.find((routine) => routine.id === id)?.items.map((item) => item.id) ?? []);
    setRoutines((items) => items.filter((routine) => routine.id !== id));
    setCompletions((items) => items.filter((item) => item.routineId !== id));
    setItemCompletions((items) => items.filter((item) => !itemIds.has(item.itemId)));
    setQuantityCompletions((items) => items.filter((item) => item.routineId !== id));
    await fetch(`/api/routines?id=${id}`, { method: "DELETE" });
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
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells: Array<Date | null> = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, monthIndex, day));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [month]);

  if (onboardingState === "checking") return <OnboardingSplash />;
  if (onboardingState === "show") return <OnboardingPage onComplete={completeOnboarding} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="RoutineEZ home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>RoutineEZ</span>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          <NavButton active={tab === "today"} onClick={() => setTab("today")} icon={CircleCheckBig} label="Today" />
          <NavButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={CalendarDays} label="Calendar" />
          <NavButton active={tab === "routines"} onClick={() => setTab("routines")} icon={ListChecks} label="Routines" />
        </nav>
        <div className="sidebar-note">
          <span className="spark">✦</span>
          <strong>Small steps add up.</strong>
          <p>Keep showing up, one routine at a time.</p>
        </div>
      </aside>

      <section className="content">
        <header className="mobile-header">
          <span className="mobile-header-spacer" aria-hidden="true" />
          <div className="mobile-wordmark" aria-label="RoutineEZ">Routine<span>EZ</span></div>
          <button className="mobile-add premium-action" onClick={openAddFromHeader} aria-label="Add routine"><span aria-hidden="true">+</span></button>
        </header>

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
                  />
                )) : <EmptyToday onAdd={() => { setTab("routines"); setShowAdd(true); }} />}
              </div>
            </section>
          </div>
        )}

        {tab === "calendar" && (
          <div className="page calendar-page">
            <div className="filter-pills" role="list" aria-label="Filter calendar by routine">
              <button className={selectedRoutine === "all" ? "active" : ""} onClick={() => setSelectedRoutine("all")}>All routines</button>
              {routines.map((routine) => <button key={routine.id} className={selectedRoutine === routine.id ? "active" : ""} style={{ "--pill": routine.color } as React.CSSProperties} onClick={() => setSelectedRoutine(routine.id)}><span>{routine.emoji}</span>{routine.name}</button>)}
            </div>
            <section className="calendar-card">
              <div className="calendar-toolbar">
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft aria-hidden="true" /></button>
                <h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight aria-hidden="true" /></button>
              </div>
              <div className="weekday-row">{DAY_NAMES.map((day) => <span key={day}>{day}</span>)}</div>
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
            {showAdd && <AddRoutineForm onSubmit={addRoutine} onCancel={() => setShowAdd(false)} saving={saving} />}
            {editingRoutineId !== null && (() => {
              const routine = routines.find((item) => item.id === editingRoutineId);
              return routine ? <RoutineOptionsEditor routine={routine} onSubmit={(event) => saveRoutineOptions(event, routine)} onCancel={() => setEditingRoutineId(null)} saving={savingList} /> : null;
            })()}
            <section className="routine-library">
              <div className="section-title"><h2>Your routines</h2><div className="section-title-actions"><span>{routines.length} total</span><button className="desktop-routine-add premium-action" onClick={() => { setEditingRoutineId(null); setShowAdd(true); }}>+ Add routine</button></div></div>
              <div className="routine-grid">
                {loading ? <LoadingRows /> : routines.map((routine) => <RoutineCard key={routine.id} routine={routine} onEditOptions={() => { setShowAdd(false); setEditingRoutineId(routine.id); }} onDelete={() => deleteRoutine(routine.id)} />)}
              </div>
            </section>
          </div>
        )}
      </section>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavButton active={tab === "today"} onClick={() => setTab("today")} icon={CircleCheckBig} label="Today" />
        <CalendarNavButton active={tab === "calendar"} onClick={() => setTab("calendar")} date={today} />
        <NavButton active={tab === "routines"} onClick={() => setTab("routines")} icon={ListChecks} label="Routines" />
      </nav>
    </main>
  );
}

function OnboardingPage({ onComplete }: { onComplete: (addRoutine?: boolean) => void }) {
  return <main className="onboarding-shell">
    <div className="onboarding-glow glow-one" aria-hidden="true" />
    <div className="onboarding-glow glow-two" aria-hidden="true" />
    <section className="onboarding-card" aria-labelledby="onboarding-title">
      <header className="onboarding-top">
        <div className="brand" aria-label="RoutineEZ"><span className="brand-mark"><i /><i /><i /></span><span>RoutineEZ</span></div>
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
  return <main className="onboarding-splash" aria-label="Loading RoutineEZ"><div className="brand"><span className="brand-mark"><i /><i /><i /></span><span>RoutineEZ</span></div></main>;
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

function RoutineRow({ routine, completed, completedItemIds, quantityCount: count, onToggle, onToggleItem, onSetQuantity }: { routine: Routine; completed: boolean; completedItemIds: Set<number>; quantityCount: number; onToggle: () => void; onToggleItem: (itemId: number) => void; onSetQuantity: (count: number) => void }) {
  const hasDetails = (routine.trackingMode === "checklist" && routine.items.length > 0) || (routine.trackingMode === "quantity" && routine.targetCount > 1);
  const hasMultiple = (routine.trackingMode === "checklist" && routine.items.length > 1) || (routine.trackingMode === "quantity" && routine.targetCount > 1);
  const [expanded, setExpanded] = useState(false);
  const completedCount = routine.items.filter((item) => completedItemIds.has(item.id)).length;
  const todayVariant = routine.dayVariants?.[new Date().getDay()] ?? "";
  const progressValue = routine.trackingMode === "quantity"
    ? Math.min(100, Math.round((count / routine.targetCount) * 100))
    : routine.trackingMode === "checklist" && routine.items.length
      ? Math.round((completedCount / routine.items.length) * 100)
      : 0;
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
      <span className="routine-info"><strong>{routine.name}</strong><small>{todayVariant && <b className="today-variant">{todayVariant}</b>}{todayVariant && " · "}{routine.time || "Anytime"}{detail ? ` · ${detail}` : ""}</small></span>
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
    {hasMultiple && !expanded && <div className="collapsed-progress" role="progressbar" aria-label={`${routine.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}>
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

function RoutineCard({ routine, onEditOptions, onDelete }: { routine: Routine; onEditOptions: () => void; onDelete: () => void }) {
  const dayLabel = routine.days.length === 7 ? "Every day" : routine.days.map((day) => DAY_NAMES[day]).join(" · ");
  const trackingLabel = routine.trackingMode === "quantity"
    ? `${routine.targetCount} ${routine.unit} daily`
    : routine.trackingMode === "checklist"
      ? `${routine.items.length} list items`
      : "Single check";
  return <article className="routine-card" style={{ "--routine": routine.color } as React.CSSProperties}>
    <div className="card-color"><span>{routine.emoji}</span></div>
    <div className="card-body"><strong>{routine.name}</strong><p>{dayLabel}</p><small>{routine.time || "Anytime"} · {trackingLabel}</small><small className="date-range-label">{formatDateRange(routine)}</small></div>
    <button className="list-button" onClick={onEditOptions}>Options</button>
    <button className="delete-button" onClick={onDelete} aria-label={`Delete ${routine.name}`}>×</button>
  </article>;
}

function AddRoutineForm({ onSubmit, onCancel, saving }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; saving: boolean }) {
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("simple");
  const [selectedDays, setSelectedDays] = useState(() => DAY_NAMES.map((_, day) => day));
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
  <form className="add-card add-routine-modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-label="Add a routine">
    <div className="form-grid">
      <label className="field wide"><span>Routine name</span><input name="name" placeholder="e.g. Take vitamins" required maxLength={40} autoFocus /></label>
      <TimeField />
      <DateRangeSettings />
      <TrackingModePicker value={trackingMode} onChange={setTrackingMode} />
      {trackingMode === "checklist" && <label className="field checklist-field"><span>Checklist items <small>One per line</small></span><textarea name="checklist" placeholder={"Warm up\nMain workout\nCool down"} maxLength={1000} /></label>}
      {trackingMode === "quantity" && <QuantitySettings />}
      <fieldset className="emoji-picker"><legend>Icon</legend><ScrollablePicker label="Icon">{EMOJIS.map((emoji, i) => <label key={emoji}><input type="radio" name="emoji" value={emoji} defaultChecked={i === 0} onChange={(event) => keepModalAligned(event.currentTarget)} /><span>{emoji}</span></label>)}</ScrollablePicker></fieldset>
      <fieldset className="color-picker"><legend>Color</legend><ScrollablePicker label="Color">{COLORS.map((color, i) => <label key={color}><input type="radio" name="color" value={color} defaultChecked={i === 0} onChange={(event) => keepModalAligned(event.currentTarget)} /><span style={{ background: color }} /></label>)}</ScrollablePicker></fieldset>
      <fieldset className="day-picker"><legend>Repeat on</legend>{DAY_NAMES.map((day, i) => <label key={day}><input type="checkbox" name={`day-${i}`} checked={selectedDays.includes(i)} onChange={() => setSelectedDays((days) => days.includes(i) ? days.filter((item) => item !== i) : [...days, i].sort())} /><span>{day.slice(0, 1)}</span></label>)}</fieldset>
      <DayPlanSettings scheduledDays={selectedDays} />
    </div>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button premium-action" disabled={saving}>{saving ? "Adding…" : "Add routine"}</button></div>
  </form>
  </div>;
}

function RoutineOptionsEditor({ routine, onSubmit, onCancel, saving }: { routine: Routine; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; saving: boolean }) {
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
  <form className="add-card checklist-editor edit-routine-modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-label={`Edit ${routine.name}`}>
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
  </div>;
}

function ScrollablePicker({ label, children }: { label: string; children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 100 });

  const updateIndicator = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const boundedScroll = Math.min(maxScroll, Math.max(0, scroller.scrollLeft));
    const width = Math.max(22, Math.min(100, (scroller.clientWidth / scroller.scrollWidth) * 100));
    const left = maxScroll ? (boundedScroll / maxScroll) * (100 - width) : 0;
    setThumb({ left, width });
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

  return <div className="picker-shell">
    <div ref={scrollerRef} className="picker-scroll" onScroll={updateIndicator} tabIndex={0} role="group" aria-label={`${label} choices. Scroll horizontally for more.`}>{children}</div>
    <div className="picker-scrollbar" aria-hidden="true"><span style={{ left: `calc(${thumb.left}% + 1px)`, width: `calc(${thumb.width}% - 2px)` }} /></div>
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

function TimeField({ defaultValue = "" }: { defaultValue?: string }) {
  const [time, setTime] = useState(defaultValue);
  return <label className="field"><span>Time <small>Optional</small></span><span className="date-input-wrap time-input-wrap"><input name="time" type="time" value={time} onChange={(event) => setTime(event.target.value)} /><button type="button" onClick={() => setTime("")} disabled={!time}>Clear</button></span></label>;
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

function QuantitySettings({ targetCount = 4, unit = "pills" }: { targetCount?: number; unit?: string }) {
  return <div className="quantity-settings">
    <label className="field"><span>Daily amount</span><input name="targetCount" type="number" min="2" max="12" defaultValue={Math.max(2, targetCount)} required /></label>
    <label className="field"><span>What are you counting?</span><input name="unit" defaultValue={unit === "times" ? "pills" : unit} placeholder="pills" maxLength={24} required /></label>
    <p>Each amount becomes one tappable section in the horizontal tracker.</p>
  </div>;
}

function LoadingRows() {
  return <div className="loading-list" aria-label="Loading routines"><i /><i /><i /></div>;
}

function EmptyToday({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><span className="empty-state-icon" aria-hidden="true"><CalendarPlus2 /></span><h3>Your day is wide open</h3><p>Add a routine and it’ll appear here on the right days.</p><button className="primary-button premium-action" onClick={onAdd}>Add your first routine</button></div>;
}
