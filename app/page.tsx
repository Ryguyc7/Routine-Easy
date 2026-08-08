"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Routine = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  time: string;
  days: number[];
};

type Completion = { routineId: number; date: string };
type Tab = "today" | "calendar" | "routines";
type OnboardingState = "checking" | "show" | "done";

const COLORS = ["#6C5CE7", "#FF8A65", "#F4B942", "#49A078", "#4D96FF", "#EC6F91"];
const EMOJIS = ["✨", "💊", "🏋️", "🥣", "🥗", "🍲", "🧘", "💧"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export default function Home() {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>("checking");
  const [tab, setTab] = useState<Tab>("today");
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoutine, setSelectedRoutine] = useState<number | "all">("all");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKey(today);

  async function loadData() {
    try {
      const response = await fetch("/api/routines", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load your routines.");
      const data = await response.json();
      setRoutines(data.routines);
      setCompletions(data.completions);
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
  }, []);

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

  const todayRoutines = routines.filter((routine) => routine.days.includes(today.getDay()));
  const completedToday = new Set(
    completions.filter((item) => item.date === todayKey).map((item) => item.routineId),
  );
  const doneCount = todayRoutines.filter((routine) => completedToday.has(routine.id)).length;
  const progress = todayRoutines.length ? Math.round((doneCount / todayRoutines.length) * 100) : 0;

  async function toggleRoutine(routineId: number, date = todayKey) {
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

  async function addRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
    setRoutines((items) => items.filter((routine) => routine.id !== id));
    setCompletions((items) => items.filter((item) => item.routineId !== id));
    await fetch(`/api/routines?id=${id}`, { method: "DELETE" });
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
          <NavButton active={tab === "today"} onClick={() => setTab("today")} icon="◉" label="Today" />
          <NavButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon="▦" label="Calendar" />
          <NavButton active={tab === "routines"} onClick={() => setTab("routines")} icon="☷" label="Routines" />
        </nav>
        <div className="sidebar-note">
          <span className="spark">✦</span>
          <strong>Small steps add up.</strong>
          <p>Keep showing up, one routine at a time.</p>
        </div>
      </aside>

      <section className="content">
        <header className="mobile-header">
          <div className="brand"><span className="brand-mark"><i /><i /><i /></span><span>RoutineEZ</span></div>
          <button className="mobile-add" onClick={() => { setTab("routines"); setShowAdd(true); }} aria-label="Add routine"><span aria-hidden="true">+</span></button>
        </header>

        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}

        {tab === "today" && (
          <div className="page today-page">
            <div className="page-heading split-heading">
              <div>
                <p className="eyebrow">{formatLongDate(today)}</p>
                <h1>Good {today.getHours() < 12 ? "morning" : today.getHours() < 18 ? "afternoon" : "evening"}<span className="accent-dot">.</span></h1>
                <p>{doneCount === todayRoutines.length && todayRoutines.length ? "Everything is done — enjoy the feeling." : "Here’s your rhythm for today."}</p>
              </div>
              <div className="date-tile" aria-hidden="true"><span>{today.toLocaleDateString("en-US", { month: "short" })}</span><strong>{today.getDate()}</strong></div>
            </div>

            <section className="progress-card">
              <div className="progress-copy">
                <span className="progress-icon">✦</span>
                <div><strong>{progress === 100 ? "Beautiful work!" : progress > 50 ? "You’re on a roll!" : "Let’s make a start"}</strong><p>{doneCount} of {todayRoutines.length} routines complete</p></div>
              </div>
              <div className="progress-number">{progress}%</div>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            </section>

            <section className="routine-section">
              <div className="section-title"><h2>Today’s routines</h2><span>{todayRoutines.length} items</span></div>
              <div className="routine-list">
                {loading ? <LoadingRows /> : todayRoutines.length ? todayRoutines.map((routine) => (
                  <RoutineRow key={routine.id} routine={routine} completed={completedToday.has(routine.id)} onToggle={() => toggleRoutine(routine.id)} />
                )) : <EmptyToday onAdd={() => { setTab("routines"); setShowAdd(true); }} />}
              </div>
            </section>
          </div>
        )}

        {tab === "calendar" && (
          <div className="page calendar-page">
            <div className="page-heading"><p className="eyebrow">Your rhythm at a glance</p><h1>Calendar<span className="accent-dot">.</span></h1><p>Select a routine to see its days across the month.</p></div>
            <div className="filter-pills" role="list" aria-label="Filter calendar by routine">
              <button className={selectedRoutine === "all" ? "active" : ""} onClick={() => setSelectedRoutine("all")}>All routines</button>
              {routines.map((routine) => <button key={routine.id} className={selectedRoutine === routine.id ? "active" : ""} style={{ "--pill": routine.color } as React.CSSProperties} onClick={() => setSelectedRoutine(routine.id)}><span>{routine.emoji}</span>{routine.name}</button>)}
            </div>
            <section className="calendar-card">
              <div className="calendar-toolbar">
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
                <h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button>
              </div>
              <div className="weekday-row">{DAY_NAMES.map((day) => <span key={day}>{day}</span>)}</div>
              <div className="calendar-grid">
                {monthDays.map((date, index) => {
                  if (!date) return <div className="day-cell empty" key={`blank-${index}`} />;
                  const key = localDateKey(date);
                  const matches = routines.filter((routine) => routine.days.includes(date.getDay()) && (selectedRoutine === "all" || selectedRoutine === routine.id));
                  const isToday = key === todayKey;
                  return <div className={`day-cell ${isToday ? "is-today" : ""}`} key={key}>
                    <span className="day-number">{date.getDate()}</span>
                    <div className="day-dots">{matches.slice(0, 5).map((routine) => <i key={routine.id} style={{ background: routine.color }} title={routine.name} />)}</div>
                  </div>;
                })}
              </div>
            </section>
            <div className="calendar-legend">Colored dots show when each routine is scheduled.</div>
          </div>
        )}

        {tab === "routines" && (
          <div className="page routines-page">
            <div className="page-heading split-heading">
              <div><p className="eyebrow">Make it yours</p><h1>Routines<span className="accent-dot">.</span></h1><p>Create a simple rhythm that works for you.</p></div>
              <button className="primary-button" onClick={() => setShowAdd(true)}>＋ Add routine</button>
            </div>
            {showAdd && <AddRoutineForm onSubmit={addRoutine} onCancel={() => setShowAdd(false)} saving={saving} />}
            <section className="routine-library">
              <div className="section-title"><h2>Your routines</h2><span>{routines.length} total</span></div>
              <div className="routine-grid">
                {loading ? <LoadingRows /> : routines.map((routine) => <RoutineCard key={routine.id} routine={routine} onDelete={() => deleteRoutine(routine.id)} />)}
              </div>
            </section>
          </div>
        )}
      </section>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavButton active={tab === "today"} onClick={() => setTab("today")} icon="◉" label="Today" />
        <NavButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon="▦" label="Calendar" />
        <NavButton active={tab === "routines"} onClick={() => setTab("routines")} icon="☷" label="Routines" />
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
          <button className="onboarding-cta" onClick={() => onComplete(true)}><span>Build my first routine</span><i aria-hidden="true">→</i></button>
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

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return <button className={active ? "active" : ""} onClick={onClick} aria-current={active ? "page" : undefined}><span>{icon}</span>{label}</button>;
}

function RoutineRow({ routine, completed, onToggle }: { routine: Routine; completed: boolean; onToggle: () => void }) {
  return <button className={`routine-row ${completed ? "completed" : ""}`} onClick={onToggle} style={{ "--routine": routine.color } as React.CSSProperties}>
    <span className="routine-emoji">{routine.emoji}</span><span className="routine-info"><strong>{routine.name}</strong><small>{routine.time}</small></span><span className="check-circle">✓</span>
  </button>;
}

function RoutineCard({ routine, onDelete }: { routine: Routine; onDelete: () => void }) {
  const dayLabel = routine.days.length === 7 ? "Every day" : routine.days.map((day) => DAY_NAMES[day]).join(" · ");
  return <article className="routine-card" style={{ "--routine": routine.color } as React.CSSProperties}>
    <div className="card-color"><span>{routine.emoji}</span></div>
    <div className="card-body"><strong>{routine.name}</strong><p>{dayLabel}</p><small>{routine.time}</small></div>
    <button className="delete-button" onClick={onDelete} aria-label={`Delete ${routine.name}`}>×</button>
  </article>;
}

function AddRoutineForm({ onSubmit, onCancel, saving }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; saving: boolean }) {
  return <form className="add-card" onSubmit={onSubmit}>
    <div className="add-card-header"><div><span className="eyebrow">A new small promise</span><h2>Add a routine</h2></div><button type="button" onClick={onCancel} aria-label="Close">×</button></div>
    <div className="form-grid">
      <label className="field wide"><span>Routine name</span><input name="name" placeholder="e.g. Take vitamins" required maxLength={40} autoFocus /></label>
      <label className="field"><span>Time</span><input name="time" type="time" defaultValue="08:00" required /></label>
      <fieldset className="emoji-picker"><legend>Icon</legend>{EMOJIS.map((emoji, i) => <label key={emoji}><input type="radio" name="emoji" value={emoji} defaultChecked={i === 0} /><span>{emoji}</span></label>)}</fieldset>
      <fieldset className="color-picker"><legend>Color</legend>{COLORS.map((color, i) => <label key={color}><input type="radio" name="color" value={color} defaultChecked={i === 0} /><span style={{ background: color }} /></label>)}</fieldset>
      <fieldset className="day-picker"><legend>Repeat on</legend>{DAY_NAMES.map((day, i) => <label key={day}><input type="checkbox" name={`day-${i}`} defaultChecked /><span>{day.slice(0, 1)}</span></label>)}</fieldset>
    </div>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Adding…" : "Add routine"}</button></div>
  </form>;
}

function LoadingRows() {
  return <div className="loading-list" aria-label="Loading routines"><i /><i /><i /></div>;
}

function EmptyToday({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><span>☀️</span><h3>Your day is wide open</h3><p>Add a routine and it’ll appear here on the right days.</p><button className="primary-button" onClick={onAdd}>Add your first routine</button></div>;
}
