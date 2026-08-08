import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the RoutineEZ product instead of starter content", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Today’s routines/);
  assert.match(page, /Calendar/);
  assert.match(page, /Add a routine/);
  assert.match(page, /Build my first routine/);
  assert.match(page, /routineez-onboarding-complete/);
  assert.match(page, /Routine options/);
  assert.match(page, /Daily amount/);
  assert.match(page, /quantity-completions/);
  assert.match(page, /collapsed-progress/);
  assert.match(page, /add-modal-backdrop/);
  assert.match(page, /aria-modal="true" aria-label="Add a routine"/);
  assert.doesNotMatch(page, /A new small promise/);
  assert.match(page, /openAddFromHeader/);
  assert.match(page, /function useAnimatedNumber/);
  assert.match(page, /requestAnimationFrame\(animate\)/);
  assert.match(page, /setTimeout\(\(\) =>/);
  assert.match(page, /Different plan by day/);
  assert.match(page, /dayVariant-/);
  assert.doesNotMatch(page, /Your rhythm at a glance/);
  assert.match(page, /edit-modal-backdrop/);
  assert.match(page, /Active dates/);
  assert.match(page, /name="startDate"/);
  assert.match(page, /name="endDate"/);
  assert.match(page, /function TimeField/);
  assert.match(page, /onClick=\{\(\) => setTime\(""\)\}/);
  assert.match(page, /picker-scroll/);
  assert.match(page, /🪥/);
  assert.match(page, /#00A896/);
  assert.match(await readFile(new URL("../app/globals.css", import.meta.url), "utf8"), /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(await readFile(new URL("../app/globals.css", import.meta.url), "utf8"), /routines-page \{ scrollbar-width: none/);
  assert.match(await readFile(new URL("../app/globals.css", import.meta.url), "utf8"), /radial-gradient\(circle at -36px 145px/);
  assert.match(await readFile(new URL("../app/globals.css", import.meta.url), "utf8"), /routine-row\.completed \{ opacity: 1/);
  assert.match(await readFile(new URL("../app/globals.css", import.meta.url), "utf8"), /routine-row:hover, \.routine-row:active \{ transform: none/);
  assert.match(page, /function DateTile/);
  assert.match(page, /function CalendarNavButton/);
  assert.match(page, /date-nav-icon/);
  assert.match(page, /month: "short"/);
  assert.match(await readFile(new URL("../app/globals.css", import.meta.url), "utf8"), /calendar-nav-button\.active \{ position: relative;[\s\S]*background: transparent; border: 0/);
  assert.match(await readFile(new URL("../app/globals.css", import.meta.url), "utf8"), /bottom-nav \{[\s\S]*overflow: hidden;[\s\S]*border-radius: 22px/);
  assert.doesNotMatch(await readFile(new URL("../app/globals.css", import.meta.url), "utf8"), /bottom-nav::before, \.bottom-nav::after/);
  assert.match(page, /LiquidButton/);
  assert.match(await readFile(new URL("../components/ui/liquid-glass-button.tsx", import.meta.url), "utf8"), /feDisplacementMap/);
  assert.match(await readFile(new URL("../app/globals.css", import.meta.url), "utf8"), /Exact liquid-glass surface used by the integrated 21st\.dev component/);
  assert.match(page, /CalendarPlus2/);
  assert.match(page, /ChevronLeft/);
  assert.match(page, /day-fill/);
  assert.match(page, /selected-routine-day/);
  assert.doesNotMatch(page, /day-dots/);
  assert.doesNotMatch(page, /☀️/);
  assert.match(page, /mobile-wordmark/);
  assert.match(page, /mobile-header-spacer/);
  assert.doesNotMatch(page, /today-date-copy|date-balance/);
  assert.match(page, /item-completions/);
  assert.match(layout, /RoutineEZ — Simple Routine Tracker/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
