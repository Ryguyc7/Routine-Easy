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
  assert.match(page, /item-completions/);
  assert.match(layout, /RoutineEZ — Simple Routine Tracker/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
