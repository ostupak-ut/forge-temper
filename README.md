# Forge · Temper — Visual Flow Modeller

A node-graph app (ComfyUI/n8n-style) that automates **math/economics paper prototyping and proof
verification** by orchestrating **local Claude Code** (and other models, via OpenRouter) per node.

Drag an **Idea** → **Forge** → **Temper** pipeline, hit Run, and watch a rough idea become a
LaTeX→PDF prototype with per-result **confidence discs** that get verified numerically — with the
forge↔temper loop automated.

It wraps the [`forge` / `temper` Claude Code skills](https://github.com/ostupak-ut/forge-temper-skills):
*forge* drafts a 2–4pp prototype (card cover, results spine, sympy checks, `verification.md`);
*temper* runs numeric checks and updates the discs.

## Status

Phases 0–3 + the multi-provider executor are done and **proven end-to-end** (a real PDF prototype is
generated and its verdict computed from the `.tex` disc tokens). The automatic loop engine, prose
nodes, and full-paper assembly are next. See **[PLAN.md](./PLAN.md)** for the full architecture,
hard-won gotchas, and roadmap.

## Quick start

```bash
npm install
npm run dev          # Vite (5173) + Fastify backend (8787)
```

Open http://localhost:5173 → **Starter** → type an idea in the Idea node → select **Forge** → **▶ Run**.

**Prerequisites:** an authenticated `claude` CLI on PATH; the `forge`/`temper`/`olehwrites` skills in
`~/.claude/skills/`; LaTeX (`latexmk`, libertine, newtxmath, tcolorbox); Python (`sympy`, `numpy`, `scipy`).

## Stack

Vite · React · TypeScript · `@xyflow/react` (React Flow) · Zustand · Zod · Tailwind · CodeMirror 6 ·
Fastify · better-sqlite3 · `@anthropic-ai/claude-agent-sdk`.

See **[PLAN.md](./PLAN.md)** for everything else.
