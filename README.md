# Forge — Visual Flow Modeller

A local **node-graph for building and running AI-agent workflows**. Wire agents
(Claude Code · Codex · OpenRouter · in-app Anthropic harness) into runnable,
**looping, self-aware pipelines** — drag nodes, connect ports, hit Run.

It's general-purpose, with a built-in toolkit for its original use: **prototyping
and numerically verifying theory-paper math** (the `Forge` → `Temper` loop turns a
rough idea into a LaTeX→PDF prototype whose results carry confidence discs that
get checked).

> Runs entirely on your machine. Each person uses **their own** provider key —
> nothing of yours is in the repo.

---

## Quick start

Needs **Node 20+**.

```bash
git clone https://github.com/ostupak-ut/forge-temper.git
cd forge-temper
npm install
npm approve-scripts        # allow native builds (better-sqlite3, esbuild, fsevents)
npm run dev                # Vite (5173) + Fastify backend (8787)
```

Open **http://localhost:5173**, then pick a provider in **Settings** (bottom bar).

### Providers — pick one (only the ones you have show up)

| Provider | What you need | Notes |
|---|---|---|
| **OpenRouter** *(easiest)* | an OpenRouter API key (paste in Settings) | no CLI; works for chat **and** agent nodes |
| **Claude Code** | the `claude` CLI, logged in (subscription) | runs skills agentically |
| **Codex** | `npm i -g @openai/codex` + `codex login` | uses your ChatGPT/Codex plan |
| **Anthropic Harness** | an Anthropic API key (in Settings) | in-app tool-use loop, no CLI |

**For compiling PDFs** (Forge / Temper / Assemble): also install **LaTeX**
(`latexmk`, `libertine`, `newtxmath`, `tcolorbox`) and **Python**
(`sympy`, `numpy`, `scipy`). Not needed for plain graph or OpenRouter-chat use.

---

## Core concepts

- **Nodes & ports.** Drag nodes from the palette and wire output ports → input
  ports (types must be compatible; an `any` port bridges anything). Two input
  channels matter most:
  - **`inputs`** = real **files/folders** (from a Files node), staged to disk for
    the agent to read.
  - **`context`** = **text** from any other node, merged into the prompt.
- **Custom Agent.** A blank, freely-wireable agent — name it, prompt it, choose a
  provider/model, tool scope, and file inputs. Click its **avatar** to restyle
  (symbol/color); save it to the palette to reuse. Drops anywhere, including onto
  a loop.
- **Loops.** Wire an agent's `out` back into an earlier agent's `feedback` to form
  a loop — the rose **↩ loop** arc *is* the loop (drag it to reshape). Drawing it
  auto-completes the return edge if needed. Click the arc to set the mode:
  - **`until-count`** — run a fixed N times (use this for plain/custom-agent loops).
  - **`until-pass`** — stop when the loop's **verifier** passes. Only **Temper**,
    or a **Custom Agent with "Verifier" turned on** (give it a *pass condition*),
    emits a pass/fail verdict.
- **Library & Warehouse.** The **Library** is your persistent input store (upload
  files/folders, pick them in a Files node). A **Warehouse** node collects results
  from any agent's output into an indexed pile that accumulates a `run-NNN` each run.
- **Self-awareness.** Before each agent runs, Forge prepends a live map of where it
  sits in the graph (its role, neighbours, the whole flow, loops, and what every
  step does). Editable/toggleable in **Settings → Agent self-awareness**.
- **Dry Run vs Run Graph.** **Dry Run** animates the flow (loops included) without
  calling any agent — free, for checking wiring. **Run Graph** actually executes.

## Settings

Project root folder · CLI binary paths (codex/claude) · provider API keys ·
app font + text size · light/dark theme (FT-style pastel) · the self-awareness
template. Keys live in `.forge-temper/settings.json` (**gitignored**, never
committed, never sent to the browser).

## Skills

Agents can run a **skill** (instructions injected into the system prompt). Forge
prefers your **`~/.claude/skills/<name>/`** — so any skill you create at home shows
up in the node's Skill dropdown — and falls back to the **bundled** `forge`/`temper`
so the app works out of the box with no install.

## Sharing a flow

Use **Export (⬇)** to save a flow as a `.ftflow.json` and **Import (⬆)** to load
one — handy for sending a graph to a collaborator. Named flows are saved locally
via **Save / Open**.

---

## Stack & architecture

Two local processes sharing one TypeScript + Zod contract layer:

```
Browser (Vite :5173) ──/api──> Fastify backend (:8787)
  React + @xyflow/react canvas        getProvider(cfg.provider).run(...)
  Zustand store, Properties panel       ├─ claude-code  (@anthropic-ai/claude-agent-sdk)
  SSE for live run events               ├─ codex        (codex exec --json)
                                        ├─ anthropic-harness (@anthropic-ai/sdk, tool loop)
                                        └─ openrouter / openrouter-agent (fetch)
  cycle-aware engine: compile → schedule → loopDriver → runOneNode
```

Vite · React · TypeScript · `@xyflow/react` · Zustand · Zod · Tailwind ·
CodeMirror 6 · Fastify · better-sqlite3 · `@anthropic-ai/claude-agent-sdk` · `@anthropic-ai/sdk`.

`npm run build` typechecks + builds. **[PLAN.md](./PLAN.md)** has deeper design
notes and hard-won gotchas (parts are historical — this README is the current
source of truth).
