# Known Issues & Parked Fixes

Running list of bugs found + the fix to apply later. Nothing here is urgent; each
entry has a symptom, the root cause, how to recover right now, and the real fix.

---

## 1. `SyntaxError: JSON.parse: unexpected end of data` on the page — API server died mid-session

**Symptom.** After the app has been running a while (often after a run), the UI
starts throwing `JSON.parse: unexpected end of data at line 1 column 1`. The
canvas may load but settings/graph/run calls fail.

**What it actually means.** The frontend (Vite, port 5173) is fine, but the
**API server (port 8787) has crashed**. The page fetches `/api/...`, gets an
**empty response body**, and `JSON.parse("")` throws. It is *not* data
corruption and *not* a `start.bat` problem.

**Root cause (two compounding issues).**
1. `package.json` → `dev:server` is `tsx watch server/index.ts`. `tsx watch`
   restarts the server on **file edits**, but **NOT when the process crashes**.
   So once the API dies, it stays dead until a file changes or a manual restart.
2. `server/index.ts` has **no global error handlers**. Any unhandled
   exception / promise rejection in a run (a provider call, the engine, an
   aborted SSE stream, the OpenRouter/Qwen path, etc.) takes down the whole
   API process. Confirmed: `grep uncaughtException|unhandledRejection` → no matches.

   Most likely trigger this time: the slow **Qwen-over-OpenRouter** Extender run.

**Recover right now (no code change).**
- The API alone: from the repo root, `node --import tsx server/index.ts`
  (boots clean on 8787), then hard-refresh the browser (Ctrl+Shift+R).
- Or full clean restart: **close the "Forge-Temper (servers)" window first**,
  then run `start.bat`. (See gotcha in issue #2 — you MUST close the window.)

**Permanent fix (parked — ~5 min, safe).**
- In `server/index.ts`, add before/after server start:
  ```ts
  process.on('uncaughtException', (err) => {
    app.log.error({ err }, 'uncaughtException — keeping server alive')
  })
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, 'unhandledRejection — keeping server alive')
  })
  ```
  → one bad run logs an error instead of killing the backend.
- Better still: also harden the run/provider paths so per-run errors are caught
  at the route/engine level and returned as a 500 JSON body (so the frontend
  shows a real error instead of an empty body), rather than bubbling to process level.

---

## 2. `start.bat` only checks port 5173 — won't restart a dead API

**Symptom.** API (8787) is dead but Vite (5173) is alive. Re-running `start.bat`
just opens the browser and does **not** bring the API back, because the "already
running?" check only looks at `:5173`.

**Recover right now.** Close the "Forge-Temper (servers)" window (kills Vite +
strays), *then* run `start.bat` so both processes start fresh.

**Permanent fix (parked).** In `start.bat`, change the "already running" check to
also require port **8787** to be LISTENING. If 5173 is up but 8787 is down,
treat it as **not** running (or kill the stray Vite) so a clean restart happens.

---

## 3. OpenRouter models are text-only — can't read or write files (design boundary, not a bug)

**Symptom.** Put the **Extender** on Qwen (via OpenRouter); it streamed text but
**wrote no `extension.md`**, and was very slow. The downstream **Integrator**
(Opus) then reported "my inputs/ folder is empty… no extension.md exists on disk"
and had to hunt through sibling run folders.

**Root cause.** `claude-code` and `codex` are **local coding agents** with a
filesystem + shell (read your `.tex`, run Bash, write artifacts). **OpenRouter
(and openrouter-agent)** are **text-only API calls** — no filesystem. Their output
exists *only as text on the node's output arrow*, never as a file on disk. So an
OpenRouter node cannot fill a role whose job is to **produce a file** a later
agent reads (Extender / Verifier / Fixer / Integrator all need disk).

**Recover right now.** Put file-producing roles on **codex (GPT-5.x)** — still a
different model family from Claude (keeps the cross-model diversity), but it has
hands. Reserve OpenRouter models for **pure-text critic roles** (e.g. a second
Skeptic whose audit just flows into the Fixer's prompt as text).

**Permanent fix (parked — the good one).** Make the engine **persist every node's
text output to a file** (e.g. `<node>-output.md`) and **stage it into downstream
nodes' `inputs/`**. Then:
- OpenRouter "brains" become usable — the engine acts as their "hands."
- Downstream agents reliably find upstream artifacts instead of digging through
  sibling run folders (which is what the Integrator was forced to do).
- Confirmed gap: the Integrator said "upstream artifacts weren't staged into my
  run," so the engine does **not** currently auto-stage node outputs downstream.

---

## 4. No parallel sessions — single user, single workspace, one active run (design boundary)

**Symptom / question.** Can't run two workflows on two folders at once; two
browser tabs interfere; starting a second run hijacks the first.

**Root cause.** The app is single-session-local by design:
- The **workspace root is one server-wide global** (`config.ts` `setWorkspaceDir`
  sets a single `workspaceOverride`). Open Folder changes it for the whole server,
  so there's no per-session workspace.
- Tabs share one backend, one `workspace/`, one `.forge-temper/runs.db`, one
  `warehouse/`, and the same-origin `localStorage` autosave → tabs stomp on each
  other.
- The client tracks a **single `currentRunId`**; a second run resets the view to
  it and does NOT stop the first server-side. Concurrent whole-graph runs also
  share scratch dirs (`papers/<id>`) and the warehouse, so they collide.

**What DOES work.** Parallelism **within one run** — independent same-stage nodes
run concurrently (the `N×` cap) behind a per-working-dir lock. That's intended.

**Recover right now.** Run one workflow / one folder / one run at a time. For
breadth inside a single run, use Parallel mode + the concurrency control.

**Permanent fix (parked — a real chunk, not a flag).** Make the workspace
**per-session/per-run** instead of one global; isolate scratch + warehouse per
session; give the client a **run registry** instead of a single `currentRunId`;
key autosave per-tab. Changes the core single-user model, so only if multi-session
becomes a real need.

---

_Last updated from the 2026-06-23 session._
