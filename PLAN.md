# Forge · Temper — Visual Flow Modeller — Project Plan & Agent Handoff

> A node-graph app (ComfyUI/n8n-style) that automates **math/economics paper prototyping
> and proof verification** by orchestrating **local Claude Code** (and other models) per node.
> This document is the source of truth for continuing the build. Read §6 (gotchas) before
> touching execution code — several hard-won fixes are non-obvious.

Last updated: 2026-06-19. Status: **Phases 0–3 + provider layer DONE and proven end-to-end.**

---

## 1. Vision

The UX is borrowed from visual AI-flow tools, but the **domain is academic theory papers**, not
media. You wire nodes into a graph and run them; each node executes by invoking an AI agent/model.

Two core node primitives wrap the user's existing Claude Code **skills**
(`github.com/ostupak-ut/forge-temper-skills`):

- **Forge** — turns a rough **idea** (or draft files) into a lean 2–4pp LaTeX→PDF **prototype**:
  a collectible "card" cover, a results spine (theorems/lemmas), per-result **confidence discs**
  `[v]erified / [p]lausible / [h]euristic / [c]onjectured`, a dependency skeleton, sympy symbolic
  checks, and a `verification.md` handoff. Output lives in a `proto/` directory.
- **Temper** — reads `proto/verification.md`, builds & runs `verify.py` (numpy/scipy numeric
  checks + counterexample hunts), updates the discs in place, writes `temper-report.md`.

The product **automates the previously-manual forge→temper→revise loop** with conditional
iteration (Phase 4), plus Body/Literature prose nodes and an Assemble→full-paper step (Phase 5).

The unifying idea: **the shared state between nodes is the paper's working directory on disk**
(`workspace/papers/<id>/{inputs,proto}`). Nodes orchestrate *which skill/model runs against which
dir with what prompt*; the loop's stop signal is **computed** from the deterministic disc tokens.

---

## 2. Current status

| Phase | What | Status |
|---|---|---|
| 0 | Scaffold (Vite+React+TS front, Fastify back), shared Zod contracts | ✅ done |
| 1 | Editor core: registry nodes, store, Inspector, prompt editor, file manager, save/load, animated edges | ✅ done |
| 2 | Single-node execution via Agent SDK `query()` + SSE streaming + SQLite run store | ✅ done |
| — | Provider layer: pluggable per-node executor (Claude Code + OpenRouter), key mgmt, provider/model picker | ✅ done |
| 3 | Forge/Temper runners over shared `proto/` dir + verifier (disc-tally verdict, proof/evidence tiers) | ✅ **proven**: real PDF generated, verdict computed |
| 4 | **Conditional loop engine** (count + smart, hard cap, feedback accumulation) + convergence dashboard + A/B compare | ⏳ next |
| 5 | Prose nodes (olehwrites) + Assemble→`main.tex`→PDF + human-in-loop gate + card gallery + resume | ⬜ pending |
| 6 | Optional Lean 4 deep-verify module (feature-flagged) | ⬜ pending |

**Proven:** running a Forge node generated `workspace/papers/forge-1/proto/forge-002-pollinator-blotto.pdf`
(471 KB) with a 6-result spine; the verifier computed `🟢3 🔵2 🔴1, allCorrect:false` straight from
the `.tex` disc tokens.

**Deferred / backlog** (see §11): ranking/rarity calibration (toward publishable), run-state
persistence across refresh, extra providers (OpenAI/Codex/Anthropic-direct), and an agent harness
so skills run on *any* tool-calling provider (not just Claude Code).

---

## 3. Architecture

Local two-process app sharing one TypeScript+Zod contract layer.

```
Browser (Vite :5173) ──/api proxy──> Fastify backend (:8787)
  React + @xyflow/react canvas             │
  Zustand store, Inspector, FileManager    ├─ getProvider(cfg.provider).run(...)
  SSE (EventSource) for live run events     │     ├─ claude-code: @anthropic-ai/claude-agent-sdk query()
                                            │     │      └─ spawns local `claude` binary (headless child proc, stdio JSON)
                                            │     └─ openrouter: fetch() chat completions (SSE)
                                            ├─ verifier: parse proto/ disc tokens → verdict
                                            ├─ SQLite run store (.forge-temper/runs.db)
                                            └─ fs routes (sandboxed to workspace/) + flows + settings
```

- **Execution model (current = single node):** `POST /api/runs {mode:'single', nodeId, graph}` →
  backend resolves the node, stages wired File inputs, builds the prompt (resolving `{{vars}}` and,
  for skill nodes, prepending a "read `.skill-<name>.md`" instruction), dispatches to the provider,
  streams events over SSE, and after forge/temper extracts the verdict.
- **Providers** are pluggable behind `server/providers/types.ts::Provider`. `claude-code` is the
  default and the only one that runs skills agentically.
- **The shared contracts** (`shared/contracts/*`) are authored once and used by both the Inspector
  (form rendering) and the backend.

---

## 4. Repo layout (key files)

```
shared/contracts/            # Zod schemas + TS types (InfoCard, ForgeOutput, TemperVerdict, ProseOutput, RunEvent, common)
src/
  registry/nodeSpecs.ts      # SINGLE SOURCE OF TRUTH for node kinds (ports, config fields, defaults)
  registry/{types,portTypes}.ts
  store/graphStore.ts        # Zustand: nodes/edges + runState map (run-state NOT in node.data)
  nodes/{GenericNode,GroupNode,nodeTypes}.tsx   # 2 RF components: ftNode (all) + ftGroup (Loop)
  edges/{FeedbackEdge,edgeTypes}.tsx            # dashed rose Temper→Forge feedback arc
  canvas/FlowCanvas.tsx      # <ReactFlow>, isValidConnection (port-type + cycle reject), animated edges, palette drop
  panels/{Inspector,Palette,Toolbar,FileManager,Settings}.tsx
  components/DiscBar.tsx      # 🟢🔵🟠🔴 tally
  run/{runController,providerModels}.ts          # POST /api/runs + EventSource → store; model list fetch
  io/{serialize,sampleGraph,flowsApi}.ts
server/
  index.ts                   # Fastify bootstrap, registers routes, octet-stream parser, health
  config.ts                  # PORT 8787, WORKSPACE_DIR, DATA_DIR (.forge-temper)
  api/{runs,fs,flows,settings}.ts
  run/{claudeRunner,openrouterRunner,resolvePrompt,runEvents}.ts
  providers/{types,registry,claudeCode,openrouter}.ts
  skills/skillLoader.ts      # reads ~/.claude/skills/<name>/SKILL.md
  verify/discParser.ts       # verifyProtoDir() → disc tally + allCorrect
  persistence/{runStore,settingsStore}.ts        # better-sqlite3 runs.db; gitignored settings.json (API keys)
PLAN.md (this file)
```

Stack: Vite 8 / React 19 / TS 6 / `@xyflow/react` 12 / Zustand 5 / Zod 4 / Tailwind 3 / CodeMirror 6
/ Fastify 5 / better-sqlite3 / `@anthropic-ai/claude-agent-sdk` 0.3.x.

---

## 5. Conventions

- **Registry-driven nodes.** Add a node kind = one descriptor in `src/registry/nodeSpecs.ts`
  (ports, config `fields`, defaults) + (for executable kinds) a backend runner. Never hardcode
  node kinds in the canvas/inspector. Kinds: `idea, infocard, file, forge, temper, loop, body,
  literature, assemble`.
- **Only two React Flow node components**: `ftNode` (GenericNode, all standard kinds) and
  `ftGroup` (GroupNode, the Loop container). `node.data.kind` selects the spec. `nodeTypes`/
  `edgeTypes` are **module-level constants** (RF requirement).
- **Loops by CONTAINMENT, not back-edges.** A Loop is a `type:'group'` container; Forge+Temper are
  children. The outer graph stays a strict DAG; `isValidConnection` rejects raw cycles. The visible
  Temper→Forge "feedback" edge is decorative (a custom `feedback` edge into Forge's `loopInternal`
  port); the loop *driver* (Phase 4) carries the real feedback.
- **Run-state lives in the store's `runState` map, NOT in `node.data`** → saved graphs stay
  execution-independent. (Consequence: run output is lost on refresh; see backlog "run-state persistence".)
- **Shared dir is the contract.** `effectiveWorkingDir`: forge → `papers/<nodeId>`; temper inherits
  its upstream forge node's dir. Verdict/output derive `proto/` from the node id.
- **Verdict is COMPUTED, not asserted.** `verifyProtoDir` counts `\begin{<env>}[v|p|h|c]` tokens in
  the main `.tex` → tally; `allCorrect = (h==0 && c==0)`.

---

## 6. Critical gotchas & hard-won fixes (READ BEFORE EDITING EXECUTION CODE)

1. **NO `includePartialMessages` (token streaming) for the Claude runner.** It floods the
   subprocess stdout pipe and **deadlocks on Windows during long tool loops** (forge hung after a
   few tool calls; simple no-tool replies worked). We removed it and instead emit one `token` event
   per **assistant turn** (from `msg.type==='assistant'` text blocks). Trade-off: chunkier streaming,
   but reliable. *If you re-enable per-token streaming, you will reintroduce the hang.*
2. **Skills are delivered as a FILE the agent reads, not via the Skill tool.**
   - The **Skill tool hangs** in headless `query()`.
   - Injecting the skill as `--append-system-prompt` **busts the Windows ~32 KB command-line limit**
     (forge's `SKILL.md` is **68 KB**) → silent spawn failure, no output.
   - Fix: write the skill text to `<cwd>/.skill-<name>.md`, prepend "read this file and follow it,
     autonomously" to the prompt, and set `disallowedTools: ['Skill']`. For CHAT providers
     (OpenRouter) the skill text is inlined as a system message instead (HTTP body, no arg limit).
3. **`permissionMode: 'bypassPermissions'` requires `allowDangerouslySkipPermissions: true`.** Both
   are set so headless runs don't stall on a permission prompt.
4. **Auth = subscription OAuth, not API key.** No `ANTHROPIC_API_KEY`; uses `~/.claude/.credentials.json`.
   The SDK's `total_cost_usd` is an **API-rate estimate**, NOT a real charge on a subscription — the
   UI labels it `~$… est.`. The cost meter only reflects real money for OpenRouter (the user's key).
5. **`claude` is spawned as a headless child process** (found via PATH; here `~/.local/bin/claude`),
   communicating over stdio JSON. It is **not** attached to any terminal.
6. **Dev = two separate processes** (`vite` + `tsx watch server/index.ts`). `concurrently` was flaky
   on this Windows machine. **Machine sleep kills both** (and can wedge a Bash shell → `exit 107`);
   restart via PowerShell using `node` directly to dodge the PowerShell execution-policy block on
   `npm.ps1`/`npx.ps1`: `node --import tsx server/index.ts` and `node ./node_modules/vite/bin/vite.js`.
7. **Zod 4**: `.default({})` on an object whose fields have sub-defaults needs the FULL output object,
   not `{}`. **TS 6**: `baseUrl` is removed — paths resolve relative to the config.

---

## 7. How to run

Prereqs (verify with `claude --version`, `latexmk --version`, `python -c "import sympy,numpy"`):
- **Claude Code CLI** logged in (subscription), on PATH.
- **Skills installed** in `~/.claude/skills/`: `forge`, `temper`, `olehwrites`
  (`git clone https://github.com/ostupak-ut/forge-temper-skills && cp -R forge-temper-skills/{forge,temper} ~/.claude/skills/`).
- **LaTeX** (`latexmk`, `libertine`, `newtxmath`, `tcolorbox`) and **Python** (`sympy`, `numpy`, `scipy`).

```bash
npm install
npm run dev          # vite (5173) + tsx watch server (8787)
# If concurrently/PowerShell misbehave, run the two separately:
#   node --import tsx server/index.ts
#   node ./node_modules/vite/bin/vite.js
```
Open http://localhost:5173 (Vite binds IPv6 `localhost`, not `127.0.0.1`). Click **Starter**, type an
idea in the **Idea** node, select **Forge**, hit **▶ Run** (on the node header or in the Inspector).
The compiled PDF + disc tally appear inline in the Inspector's **Output** section.

---

## 8. HTTP API reference

- `GET /api/health` → `{ok, claude, providers:{claude-code, openrouter}, workspace}`
- `POST /api/runs` `{mode:'single', nodeId, graph:{nodes,edges}}` → `{runId}` (run is async)
- `GET /api/runs/:id/stream` → **SSE** of `RunEvent`s (`shared/contracts/run.ts`):
  `status | token | tool | verdict | result | error | run-done`
- `POST /api/runs/:id/stop` → aborts (AbortController)
- `GET /api/runs/:id` → persisted run row + node rows
- `GET /api/fs/list?path=` · `GET /api/fs/raw?path=` · `POST /api/fs/upload?name=` (octet-stream body)
- `GET/POST /api/settings` (presence-only / set keys) · `GET /api/providers/:id/models`
- `GET/PUT/DELETE /api/flows/:name` · `GET /api/flows`

---

## 9. Phase 4 — Conditional loop engine (NEXT — detailed design)

**Goal:** automate Forge↔Temper iteration using the computed `allCorrect` verdict.

**Backend (`server/engine/`):**
- `compile.ts` — lower the graph to an outer **DAG** + extract each Loop group's body subgraph.
- `scheduler.ts` — Kahn topo-sort with a ready-set; a node dispatches when all upstream outputs
  exist in a per-run **blackboard** (namespaced `nodeId` / `nodeId+iteration`). v1: run independent
  branches **sequentially** (avoid concurrent `claude` subprocesses / shared-dir conflicts).
- `loopDriver.ts` — on a Loop node: per iteration (1) build Forge input = idea + prior paper +
  prior `TemperVerdict` (constrain Forge to only re-touch failed/unverifiable result ids); (2) run
  Forge (resume its session so context compounds; inject temper feedback in the prompt); (3) run
  Temper → verdict; (4) predicate: `until-count` → `i < maxIterations`; `until-pass` →
  `!verdict.allCorrect` **AND** `i < maxIterations` (hard cap ALWAYS applies). Missing/invalid
  verdict = inconclusive = NOT correct (retry temper once, else stop & flag). Cap-hit is a
  first-class `converged:false` terminal state. Persist each iteration for resume.
- New run mode `POST /api/runs {mode:'graph'}` that walks the compiled plan; reuse the SSE bus +
  runStore; add `iteration` to events (already on `status`).

**Frontend:**
- **Run graph** button (toolbar) — real execution of the whole graph (replaces/ą beside Animate).
- **Convergence dashboard** — chart the disc tally across iterations (a panel or bottom-dock tab),
  reading per-iteration verdicts.
- **Guardrails** in the Loop config (already has mode + maxIterations; add max-cost / no-improvement).
- Loop node shows `iter N`; feedback edge animates while iterating (already wired for `activeEdges`).

**Watch out for:** the headless gotchas in §6 apply to every loop iteration; keep streaming
per-turn; one `claude` per iteration; abort cleanly on Stop.

## 10. Phase 5 / 6 (later)

- **Phase 5:** Body/Literature runners (use `olehwrites` skill, via the same file-delivery mechanism;
  prose nodes can run on any provider). **Assemble** node concatenates preamble+body+verified
  theorems+lit+bib → `main.tex` → `latexmk` → PDF, previewed inline. Human-in-the-loop **Discuss**
  gate on the Loop. **Card-deck gallery** of prototype covers (from `~/.claude/forge/index.md`).
- **Phase 6:** optional **Lean 4** deep-verify node behind the same verifier interface (feature-flagged,
  off the hot loop).

## 11. Backlog / known issues

- **Ranking/rarity calibration** — current prototypes read as "unpublishable"; tune the forge skill's
  rarity ladder + disc thresholds (forge-skill prompt work, not app code). User deferred this.
- **Run-state persistence** — runState is in-memory; output disappears on refresh (mitigated by
  deriving `proto/` from node id, but live status/verdict are lost). Consider loading the last run
  from `runs.db` on graph load.
- **More providers** — `openai` (Responses API), `codex` (`codex exec --json` spawn), `anthropic-direct`
  (`/v1/messages`). Stubs described in earlier research; add as `server/providers/*.ts` + register.
- **Cross-provider skills** — generalize the file-delivery + a tool-calling loop so forge/temper run
  on any tool-capable model, lifting the "forge/temper require Claude Code" gate in `runs.ts`.
- **Per-token streaming** — only if the Windows stdout-pipe deadlock (§6.1) is solved (e.g., drain on
  a worker, or a different transport).

---

## 12. Commit / contribution notes

- Secrets are gitignored: `.forge-temper/` (holds `settings.json` API keys, `runs.db`) and
  `workspace/` (generated papers). Never commit these.
- Typecheck before committing: `npx tsc --noEmit`. Build: `npm run build`.
