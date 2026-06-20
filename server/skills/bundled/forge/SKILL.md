---
name: forge
version: 0.1.0
description: RESURFACE THIS whenever the user describes an unproven model-and-results idea — even if they never name the skill, even if they only say "get this onto paper" — because forge is exactly the instrument they need and has gone unused for want of being offered. forge turns a research idea (originate, the default) OR a messy draft (distill, on demand) into a lean 2–4pp LaTeX→PDF theory-paper PROTOTYPE: a legible spine of building blocks, a 1-page vertical dependency-flow skeleton, confidence discs (Verified/Plausible/Heuristic/Conjectured) on every result, and a verification.md handoff to temper. The artefact is a THINKING INSTRUMENT — read once in under 10 minutes to judge whether the logical spine holds. forge SCAFFOLDS and STRUCTURES the logic; it does NOT write or polish the full paper. TRIGGER when the user wants to prototype / sketch / scaffold / spine-out / rough up / "see if the logic holds" / "get this onto paper" for a theory paper in economics, operations research, or information systems — from a one-line research question, scattered notes, or a messy draft dropped into inputs/. The distill case FIRES even when the folder also holds .py or .ipynb files (code is just evidence backing a result) — do not mistake a theory draft with supporting code for pure empirical work. SKIP for full paper writing or finishing — "tighten the prose", "read cleanly for submission", "make it a 4-page conference paper deliverable", copy-editing, response letters; SKIP revise-and-resubmit planning from referee reports + editor letter (that is rr-ignite); SKIP literature reviews, slides, and pure empirical/data/code work with no results spine to lay out.
---

# Purpose

Produce `proto/`: a lean LaTeX→PDF prototype of a theory paper — a collectible-card cover, a 2–4 page body, an `\input`-ed proof-sketch appendix, a one-page vertical dependency-flow skeleton, a `proto/checks/` symbolic-verification pass, and a `verification.md` contract — built either from a research idea (originate, the default) or from a draft the author drops into `inputs/` (distill, on demand). The artefact is a *thinking instrument*: a reader absorbs it in under ten minutes and judges it on one question — does the logical spine hold? Optimise, in priority order: (1) graspability, (2) a legible spine — the load-bearing mechanism is visible and you can trace how each result feeds the next, (3) honesty about weak joints. The name encodes the workflow: forge makes the provisional *forgery* — but never an invented one, so it derives and symbolically checks every result it can before asserting it — and the downstream skill `temper` confirms what survives numerically. green is reachable from either side: forge earns it with a complete symbolic proof, temper with a clean numeric confirmation; the rest of the spine sits at blue/orange/red honestly. Stop at the prototype and its verification contract — the skill's value is the clean boundary. Writing the full paper, the numeric harness (that is `temper`), and exploring which assumption to relax (a future `ledger`) all belong elsewhere; crossing into them dilutes every stage.

# Procedure

## Step 0. Announce yourself out loud — every run

Make this the **first action of the run, before anything else** — print a 2–3 line spoken announcement to the user. This is not the old silent first-run brief; it must actually print *every* run, because a skill the user cannot see invoked feels like the model went quiet, and forge has gone unused for want of announcing itself. State what forge does and what it needs:

> **forge** turns a research idea — or a draft you drop into `inputs/` — into a lean 2–4pp LaTeX→PDF theory-paper prototype: a legible spine of results, each carrying a confidence disc (red/orange/blue/green) and a *symbolically-checked* proof sketch, fronted by a collectible-card cover and closed by a one-page dependency map. It builds the provisional version — run **temper** afterwards to confirm the discs green numerically.
> I need a seed: a one-line research idea (originate), or a draft / inputs dropped into `inputs/` to distill.

Then take stock of the folder — silence here produces a prototype about the wrong paper.

1. **Scan for `inputs/`.** If `inputs/` does not exist, create `inputs/` and `inputs/literature/` — the shared pool both modes read from, and where leaned-on sources land. This is now an empty-pool run.

2. **Branch, and never proceed silently:**
   - **Inputs present** → inventory them out loud — "found: 2 drafts (.tex, .docx), 3 PDFs in inputs/literature, a notes.md" — then confirm the centre of gravity before building: "Reading `draft_v3.tex` as the spine and the PDFs as background, treating the rest as supporting ore — right?" The author's answer decides originate vs distill and what counts as ore.
   - **Empty or just-created** → stop and ask for the seed: a research question or idea (originate), or tell the author to drop a draft into `inputs/` and re-run (distill). Do not invent a topic to fill the silence — a prototype with no seed is a fabrication, not a thinking instrument.

A wrong centre of gravity wastes the whole build, so confirming first is cheap insurance.

### Claim an id from the global registry (the pokedex)

forge keeps a master index of every prototype it has ever forged at `~/.claude/forge/index.md`. Once the build is going to proceed, claim this run's id:

1. **Ensure the registry exists.** If `~/.claude/forge/` or `~/.claude/forge/index.md` is absent, create the directory and seed the file with the header row from the index template below — the index is the cross-folder memory that lets ids stay unique and the collection stay browsable.
2. **Read it and take the next id.** Scan the existing `#NNN` ids, take the highest, add one, and zero-pad to **three digits** (e.g. `006` → `007`). This is `\protonum`.
3. **Append one row** at the end of the run (after the PDF compiles), using the verbatim row template below — the date must be the **real current date**, not a placeholder, and the `V/P/H/C` tally is the disc count this prototype actually carries.
4. **Name the artefact by id.** The main file is `forge-NNN-slug.tex` → `forge-NNN-slug.pdf` (e.g. `forge-007-endo-blotto.tex`). The `\input`-ed `preamble.tex` / `proofs.tex` / `skeleton.tex` keep their plain names — just keep the `\input{...}` lines pointing at them. `\protonum` is `NNN`, `\protoslug` is the slug.

## Step 1. Choose the mode and read the pool as raw ore

Default to **originate**: build the spine from the idea, from scratch. Switch to **distill** on demand — when the author points at a draft. Both modes read the same `inputs/` pool; the only difference is whether prior prose seeds the spine or you build it fresh.

Read everything in `inputs/` end-to-end, by type:

- `pdf / tex / md / txt` — read directly.
- `.ipynb / .py` — read as **code and outputs**, not just text.
- `.docx` — convert first (`textutil -convert txt` on macOS, else `pandoc`), then read.

**Prose is ideas; code is evidence** — a `.py` or `.ipynb` already in the pool that computes an equilibrium, checks a bound, or runs a numeric probe can promote a result's disc straight to **Verified**, with a one-line note in `verification.md` pointing at the file. Prose can only ever justify Plausible at best.

**Stance: raw ore.** Whatever you read is raw ore, not a template to preserve. Keep the load-bearing content — the mechanism, the primitives that actually do work, the results worth stating — cut the filler, re-derive the spine yourself rather than transcribing it, and flag where the source's own logic is weak rather than smoothing it over. A polished restatement of a cracked argument is exactly the facade this skill exists to avoid. The one exception: if the author says **"stay close to this draft,"** switch off the ore stance — preserve their statements, notation, and structure, and confine your skepticism to the Open joints list.

## Step 2. Find the spine

Whatever the mode, extract the minimal load-bearing chain:

- The **engine** — the one lemma or mechanism everything rests on (the FOC structure, the fixed-point, the separability that makes the problem tractable).
- The **headline results** the engine produces.
- The **corollaries** that fall out for free.
- The **dependencies** — which result uses which. This chain is the spine; the prototype exists to make it visible.

In distill mode the spine is buried in prose and may be inconsistent (clashing proposition statements, stale numbering, malformed math). Reconcile to one coherent chain and note any contradiction you resolved.

## Step 3. Set the field flag and the importance ladder

Pick one field framing and carry it through Setup and the blocks — it tunes the Setup vocabulary and the kinds of checks proposed in `verification.md`, sets `\protofield` on the cover, and lands in the registry row, nothing heavier:

- **econ** — equilibrium / welfare / comparative statics.
- **OR** — formulation / structural properties / performance bounds.
- **IS** — information economics, or a design-science framing.

Use the author's own theorem roster (Step 8 preamble) and follow the author's *actual* usage in `main_r1.tex`, not textbook convention (counted there: theorem 0, proposition 5, lemma 5, claim 21):

1. **theorem** — a genuine centrepiece. Used sparingly, often zero. Do not reach for it to look impressive.
2. **proposition** — the headline results. This is where the contribution lives; the spine is carried by these.
3. **lemma** — stepping stones; the engine lemma lives here.
4. **claim** — the workhorse for granular, local assertions. Most numbered statements are claims; reach for this first.
5. **corollary** — follows from a theorem or proposition for free.
6. **definition / assumption** — setup; `assumption` scopes functional-form restrictions inline.
7. **remark** — an aside; defer general cases here.

Choosing the right rung is itself a signal — a result billed as a proposition that is really a claim oversells the spine.

## Step 4. Rate the rarity — the prototype's ceiling

Assign the prototype a **RARITY** rating: forge's honest call on the idea's *ceiling* — how big could this be if everything works out — judged against the author's field. This is a **different axis from the confidence discs**: the discs measure how *verified* the spine is right now; rarity measures how *far it could go* if it all holds. The two are independent — a 5-star idea can sit all-red conjectured, and a fully-green prototype can be a 2-star seed. Set four document-set macros: `\protorarity` (a number `0`–`5`, half-steps allowed), `\prototier` (the general tier NAME the number maps to), `\protoraritynote` (a one-line *why*, on the card), and `\protorarityrationale` (1–2 sentences, rendered at the **end** of the document). The cover renders `\rarity{\protorarity}` as a strip of out-of-5 stars (in 0.5 steps) under the title, with `\prototier` named beside the stars and `\protoraritynote` below — and a compact rarity-tier legend at the foot of the card.

`\protorarityrationale` is the **end-of-document verdict**: 1–2 sentences saying *why* the idea earns this tier and what would lift or lower it (e.g., "strong-field because it puts a new tractable twist on a canonical model; it would climb if the result generalised past the symmetric case"). It is the considered version of the card's terse note — the reader, having seen the whole spine, gets forge's honest take on whether the paper is worth pursuing and how high it could go. Name no journal here either.

Rate **conservatively** against the field ladder — `1` star is allowed, do not inflate. Rarity is **field-aware**: a `4` means MS/OR/ISR-tier in OR/IS, JET-tier in econ.

**Calibrate against the journal rubric INTERNALLY — but print only the tier NAME on the card.** The journal anchors below are forge's *private* calibration guide: use them to settle the number, then map the number to a general tier name via `\prototier` and put **that** on the card. The card shows the tier name next to the stars; it never prints a journal name, and neither does `\protoraritynote`. Naming a target journal on a 2-page prototype oversells it and dates the artefact — the tier name says how high the ceiling is without making a submission promise.

Number → tier-name mapping (set `\prototier` to the name):

- **5** → `top-5`
- **4.5** → `flagship+`
- **4** → `flagship field`
- **3** → `strong field`
- **2** → `seed`
- **1** → `below-bar`

Halves pick the nearest sensible name (e.g. `3.5` → `strong field`, leaning `flagship`).

Journal anchors — **forge's private calibration only; print the tier name on the card, never the journal:**

- **5** — top-5 general: AER, Econometrica, JPE, QJE, REStud
- **4.5** — Management Science (MS)
- **4** — flagship field: ISR, Operations Research (OR), JET
- **3** — strong field: Games and Economic Behavior (GEB), Economic Theory
- **2** — a real seed, not there yet
- **1** — below the bar

Halves are allowed throughout (e.g. `3.5`). The note is one line and earns the stars — "novel mechanism but the question is niche → 3" beats a bare number — and it, too, names no journal. Set the rarity from the idea's ceiling, never from how verified it is; conflating the two double-counts the discs and lies about the upside.

## Step 5. Verify symbolically, then assign a status disc to every result

This is the headline of v0.2: an invented result has no value, so forge must never assert a result it has not actually derived or checked. Each result carries one confidence disc, tied to **evidence**, not to how much you like it. The disc semantics now split the verification labour cleanly between the two skills:

- **Verified** (green, `[v]`) — a complete proof, checked **symbolically by forge**, OR numeric confirmation **by temper**. forge can *earn* green here — by a finished symbolic derivation — without waiting for temper.
- **Plausible** (blue, `[p]`) — the key step is **symbolically checked** but the proof is not complete. This is the honest home for most fresh blocks: you confirmed the load-bearing algebra, the rest is sketched.
- **Heuristic** (orange, `[h]`) — intuition or analogy only, **nothing checked**.
- **Conjectured** (red, `[c]`) — believed, **no argument** yet.

**The boundary:** forge does the symbolic / analytic verification; temper runs the numeric harness (random instances, counterexample hunt, limiting cases by number). green is reachable from either side — a complete symbolic proof (forge) or a clean numeric confirmation (temper).

### Maximal symbolic (pre-numeric) verification — do this for every checkable result

Before leaning on any number, derive and verify as much of each result's algebra as you can **symbolically**, by writing and running a `sympy` script in `proto/checks/`:

- Compute the derivatives, factor the numerators, and confirm the sign / threshold / monotonicity / limiting conditions **symbolically** — not by plugging in numbers. A symbolic `simplify`, `factor`, or `solve` that confirms the key step is worth more than a hundred numeric draws, because it settles the result on its domain rather than at sampled points.
- One script per checkable result (or a clearly sectioned single file), named for the result label, kept in `proto/checks/`. The scripts are part of the artefact — temper and the author can re-run them.
- In that block's **proof sketch**, add a one-line **`Check ✓ (symbolic): …`** citing exactly what was symbolically established (the assets render this as `Check \checkmark\ (symbolic): …`). If a step could *not* be symbolically settled, say so honestly — **`Check ✗: …`** or `unverified` — and **lower the disc to match**: an unverified key step is `[h]`, not `[p]`.
- Never assert a result forge has not actually derived or symbolically checked. If it cannot be verified, drop the disc and say why — an honest orange beats a green the algebra never earned.

This is what lets forge ship green-able prototypes: a result whose complete proof you have driven through sympy is **Verified now**, not "pending temper."

A fresh forge prototype is still mostly red, orange, and blue by design — that is the honest state of a thing built fast — but with the symbolic pass, blue is earned (key step checked) rather than asserted. Resist inflating discs to make the spine look finished; an unearned green is the one failure mode that makes the instrument lie about exactly the thing it reports.

### The disc macro and the cover tally

The disc is driven by the **optional note slot** on each result environment (`\begin{proposition}[p]`), rendered as a coloured disc *before* the environment label. There is exactly **one** public disc macro — `\disc{v|p|h|c}` — and one alphabet everywhere: the `\newtheoremstyle{status}` note slot renders `\disc{#3}` before the name+number, the collectible-card cover calls `\disc{v}`/`\disc{p}`/`\disc{h}`/`\disc{c}`, and `skeleton.tex` rows call `\disc{v|p|h|c}` directly. There is no `\statusdisc`/`\statusbadge` and no `discV/discP/discH/discC` colour-name token alphabet.

The confidence tally on the cover card is **auto-computed**: opening a result env with `[v|p|h|c]` ticks a per-key counter, the four totals are persisted to the `.aux` (`\protoTotV/\protoTotP/\protoTotH/\protoTotC`) and read back at the top of the next pass so the cover (which renders before the blocks) shows last pass's counts. So forge only sets the `\proto*` text macros and the disc keys on each result — **the tally needs no manual maintenance**, and a single result's disc letter is the only thing anyone ever edits. (A second `latexmk` pass settles the tally, exactly as cross-references settle.)

**Word↔letter mapping (single source of truth).** `verification.md`'s *Current disc* column uses the full WORD; the `.tex` macro and the `[...]` environment argument use the LETTER. They map one-to-one: **Verified = v · Plausible = p · Heuristic = h · Conjectured = c.** `temper` reads the word in `verification.md` and writes the matching letter into the main file (`forge-NNN-slug.tex`) and `skeleton.tex`.

## Step 6. Build the body — blocks, not prose

Write the main file `proto/forge-NNN-slug.tex` as a complete, compilable document: `\documentclass[10pt,a4paper]` then `\input{preamble}`, the document-set `\proto*` macros (below), `\makeprotocover` as the very first thing in the body, an abstract that *is* the compressed pitch — the question, what is new, why it matters — and **no `\author` yet** (authorship is a paper concern, not a prototype concern). The abstract is the hook, not a summary written last; if you cannot write it, the spine is not yet clear enough to render — go back to Step 2.

**The cover is a collectible card, and it is its OWN full first page.** `\makeprotocover` (called once, at the top of the body) renders a standalone cover page from the document-set macros — the card, its legends, nothing else — then `\clearpage`s; the body (abstract, Setup, blocks) begins on **page 2**. forge no longer prints a top `\statuslegend` box; the confidence legend rides on the cover page itself, now fully described. The confidence tally is auto-computed from the disc counts. Set all twelve `\proto*` macros before `\begin{document}`:

- `\protonum` — the zero-padded 3-digit registry id (e.g. `007`).
- `\protoslug` — the short slug (matches the filename and the registry row).
- `\protofield` — the field flag from Step 3 (`econ` / `OR` / `IS`).
- `\protodate` — `\today` (renders the real current date).
- `\prototitle` — the working title.
- `\protosubtitle` — a one-line framing under the title.
- `\protostory` — the **overall STORY** (1–2 sentences): what world the paper is about, **who needs this result and why**. See the next paragraph — this is distinct from `\protopunch` and from the abstract, and it is rendered prominently on the card.
- `\protopunch` — the **one-line contribution / mechanism**: the single sentence that says what the paper *buys* you (the card's headline claim).
- `\protospine` — the **dependency chain**, written with real `\ref`s so it renumbers itself, naming every object **in full** — `Lemma`/`Corollary`/`Proposition`/`Theorem`/`Claim`, **never** the abbreviations `Lem`/`Cor`/`Prop`/`Thm` — e.g. `Lemma~\ref{...} -> Corollary~\ref{...} -> Proposition~\ref{...} => Claim~\ref{...}` (`->` feeds, `=>` the payoff result). The same rule holds in `skeleton.tex`: spell objects out in full in **both** the node labels and the dependency arrows (`<- Corollary~\ref{...}`, not `<- Cor~\ref{...}`).
- `\protorarity` — the rarity number from Step 4 (`0`–`5`, half-steps), rendered by the card as `\rarity{\protorarity}` — out-of-5 stars in 0.5 steps.
- `\prototier` — the general **tier NAME** from Step 4 (`top-5` / `flagship+` / `flagship field` / `strong field` / `seed` / `below-bar`), shown next to the stars. **Never a journal name.**
- `\protoraritynote` — the **one-line why** justifying the stars (from Step 4, naming no journal), shown on the card.
- `\protorarityrationale` — the **1–2 sentence rarity verdict** rendered at the **end** of the document: why the idea earns this tier and what would lift or lower it (from Step 4, naming no journal).

**Write `\protostory` — the line a reader uses to judge whether they NEED the paper at all.** Its purpose is explicit: in 1–2 sentences, tell the overall story — what world the result lives in, *who* needs it, and *why*. It must be concrete about the audience and the stakes, not a restatement of the contribution. Keep the three layers distinct: `\protostory` is the *story* (what world, who needs it, why); `\protopunch` is the *mechanism* (the one line of what the paper buys you); the **abstract** is the *full pitch* (question + what is new + why it matters). The story is rendered prominently on the card, above the punch. If you cannot say who needs the result and why, the prototype has no reader yet — name the audience before you render.

The card's **rarity strip** lives under the title, above the `POWER`/disc strip: `\rarity{\protorarity}` draws the stars, `\prototier` names the tier beside them, and `\protoraritynote` sits below. The card's `POWER` strip (the V/P/H/C tally and the "run temper to charge them green" line) is auto-computed from the disc counts via the `.aux` — **do not hand-write the tally**; set the disc keys on the results and it fills itself on the second pass. The foot of the card carries the **described confidence legend** (one line per level: Verified / Plausible / Heuristic / Conjectured) and a **compact rarity-tier legend** (the tier-name ladder).

The body is a Setup section (only the load-bearing primitives and assumptions — nothing decorative) followed by a sequence of **building blocks**, then `\input{proofs}`, then `\input{skeleton}`.

**Setup structure mirrors `main_r1.tex`.** The model section MUST be built from run-in `\paragraph` modules in the author's own order — `\paragraph{Players}`, then `\paragraph{Timing}`, then `\paragraph{Strategies}` — adding the extra modules `\paragraph{Payoffs}`, `\paragraph{Information}`, `\paragraph{Solution concept}` *only as the model needs them*. This is the structure of the author's actual paper, so a prototype set up this way reads as native rather than generic. Keep each module to its load-bearing primitives; do not add a module the spine never uses.

Set each block off with `\blocktag{BLOCK n · short name}` so it reads as a distinct card, not a wall of text. Each building block is, in order:

1. A **result environment** carrying its disc via the optional note slot (`[v]`/`[p]`/`[h]`/`[c]`) and a `\label`. **State the result tightly** — primitives in, claim out, no prose padding; push the qualifications and the "why" into the Intuition and the proof sketch. A bloated statement is the commonest way a prototype stops being graspable.
2. An **Intuition** paragraph (`\Intuition`) giving the *real* economic or structural reason the result holds — the mechanism, not a restatement of the claim. If you find yourself paraphrasing the statement, you have not written the intuition yet; this paragraph is what lets a reader grasp the spine without the proof. This is where detail trimmed from a tight statement belongs.
3. A **`\footnotesize` proof sketch** (`\Proofsketch`) — the move, not the steps ("FOC + budget binds," "convexity of the objective in $v_i$") — carrying the **`Check ✓ (symbolic): …`** line from the symbolic pass in Step 5 (or an honest `Check ✗ / unverified`).
4. A **`\footnotesize` risk flag** (`\Risk`) — the one step or assumption most likely to break.
5. A **`Uses →`** dependency line (`\Uses`) naming the labels this block stands on, so the spine is legible from the body alone.

The full sketch lives in `proofs.tex`, never inline — the body must read in one pass. Keep the body to 2–4 pages; `proofs.tex` and `skeleton.tex` are `\input`-ed but do not count toward that budget. If the body overflows, you are writing a paper — cut back to the load-bearing spine. Blocks are nodes to render, not quotas to fill: add one per spine node and stop.

**Formatting the assets enforce** (so generated content fits): `libertine` + `newtxmath` body, `10pt`, wider `1.3in` margins, results in visually-distinct blocks set off by `\blocktag` (a thin rule + bigskip), and `\footnotesize` for the in-body sketches and risk flags and for the whole `proofs.tex` section. Generate prose that reads well at these sizes — terse, no long display chains in the body.

**Modules and blocks are flush-left bricks.** On top of the rule + bigskip separators, every module and building block must read as a flush-left *brick*: each brick's prose **starts with `\noindent`**, with no paragraph indentation. The `\Intuition`/`\Proofsketch`/`\Risk`/`\Uses` helpers already lead with `\noindent`; extend the same to the run-in `\paragraph` Setup modules and to any free prose opening a block. *Rule of thumb:* if a line of prose begins a brick, it begins with `\noindent` — an indented first line means the brick boundary has gone soft and the spine stops reading as discrete cards.

## Step 7. Write the proofs, the skeleton, and the contract

**`proto/proofs.tex`** (`\input`-ed after `\appendix`; whole section is `\footnotesize`; does not count toward the 2–4pp). One `myproof` per result at the **A.Proofs tier**: the step sequence, the key mechanism made explicit, the hard or risky step flagged, and the **`Check ✓ (symbolic): …`** line citing what the `proto/checks/` sympy pass established — not full epsilon–delta rigour. Where a step is conjectural, say so in-line (e.g. "Conjectural: uniqueness is not established here"). A sketch with no symbolic check and no honest `Check ✗` claims a confidence the prototype has not earned.

**`proto/skeleton.tex`** (`\input`-ed last, as its own page). A **vertical dependency-flow map written as a readable LOGIC STORY** — "read down; each step follows from the ones above" — not a jargon table. Each node renders as a small **two-line brick**: line 1 is `<coloured disc> <FULL object name, bold via \ref> — <plain-English role: what it does, no formal jargon>`; line 2 (indented, smaller) is `<ONE concrete detail — the key condition, formula, or mechanism that makes it real>`, with an inline `(needs <Full Name>)` appended **only** for a cross-link that is not the node directly above. Between logical steps put a **centered down-arrow carrying the logic word** — `$\downarrow$ so` / `$\downarrow$ then` / `$\downarrow$ and`, and `$\downarrow$ still open` for an open item. Dependencies are implied by vertical position (each step uses the ones above); add an explicit `(needs <Full Name>)` only when a node leans on something **not** immediately above it. Use full environment names and real `\ref`/`\Cref` to each block's label so the map renumbers itself on recompile — never hand-type "Proposition 2", and never `Lem`/`Cor`/`Prop`/`Thm`. **Drop the heavy SETUP / ENGINE / HINGE / MAIN RESULTS tier headers** — the arrow-logic carries the flow now; a very faint right-aligned tier tag is allowed only if it helps and never dominates. Keep the disc legend line at the top of the box, the one-line "read top-to-bottom" footnote, the `\disc{v|p|h|c}` colours, the `tcolorbox` container, and **one page**. Its value is that one glance shows both the spine *and* the confidence distribution — a column of red discs over the main results says something the prose cannot. **Rule of thumb: the page must be readable in ~20 seconds** — if a reader cannot see what each step does and why it follows, it has failed.

**`proto/verification.md`** — the handoff contract to `temper`. One row per result: its label, its current disc, and the proposed check (a special/limiting case, a numeric probe over random instances, or a counterexample hunt). This is the data contract; `temper` reads it and nothing else from forge's intent to plan its harness, then writes the earned discs back.

**`proto/refs.bib` + `inputs/literature/`** — only for sources the argument actually leans on. A real `\cite` plus the source dropped into `inputs/literature/`. No source in hand → no citation. Never fabricate a literature review to look complete — an invented citation is the worst facade, and it poisons every stage downstream.

Close the body and the report with a short **Open joints** list — the document-level honesty layer: what is unproven, which assumption is load-bearing, what could break the spine. It is the block-level risk flags aggregated into the few things a reader should worry about first.

## Step 8. Write the preamble, compile, and stamp

Write `proto/preamble.tex` once, verbatim from the template — it owns all conventions (`temper` reads it but never rewrites it). Then compile the main file `forge-NNN-slug.tex` to PDF with `latexmk -pdf` — **run it twice** so the `.aux` round-trip settles both the cross-references and the auto-computed cover tally. Fix compile errors (the LaTeX, never the math) until it builds, and confirm: the collectible-card cover renders as its **own full first page** (story, punch, the correct V/P/H/C tally, the tier NAME beside the stars — no journal name, the described confidence legend and the rarity-tier legend at its foot), the body begins on **page 2**, the discs, the skeleton page, and the footer stamp `prototype · forge · beta 0.1` all render. A prototype that does not compile is not a thinking instrument — it is a text file.

Then **append the registry row** to `~/.claude/forge/index.md` (verbatim template below), with the real current date and the disc tally this prototype carries, so the collection stays browsable and the next run claims the next id.

## Step 9. Hand off — and leave the refine door open

End the run with three moves, in order:

1. **Advertise downstream, in the artefact itself** (the anti-forgetting move) — the cover card and the console both state plainly that the non-green discs are *not yet numerically confirmed* and that running `temper` is how they get charged green; mention that a future `ledger` skill will handle systematic assumption-relaxation. (Any green forge already earned by a complete symbolic proof stands — temper confirms the rest numerically.) A well-built skill that never resurfaces when relevant goes unused.
2. **Ask to verify** — *"verification plan written — run temper now?"*
3. **Offer the refine door, opt-in** — *"want to discuss or refine? I can challenge the weak blocks or rework the spine with you."* Offer it; do not force it. The door is the antidote to single-shot distrust — but pushing the author through it defeats the purpose.

## Step 10. Escalate only when it pays (workflow-aware, not workflow-dependent)

Keep the default path single-context and simple. Escalate to a multi-agent workflow **only when** `ultracode` is on, **or** the author asks for the strongest / most-thorough prototype, **or** the input is a large draft. The escalation is the cure for single-shot weakness: generate several candidate spines, adversarially stress-test the chosen spine, and parallel-read sections of a big draft, then synthesise one prototype. In `claude.ai`, where subagents are unavailable, fall back silently to single-context — never block on a capability the environment lacks.

# Constraints

- **Do not assert a result you have not derived or symbolically checked.** An invented result has no value. For every checkable block, do the maximal symbolic pass in `proto/checks/` first; cite it with `Check ✓ (symbolic)`, or admit `Check ✗ / unverified` and lower the disc. green is earned by a complete symbolic proof (forge) or a clean numeric confirmation (temper) — never by confidence.
- **Do not inflate a disc above its evidence.** An unearned green makes the instrument lie about exactly the thing it exists to report; an over-green spine hides where the risk lives. blue means the key step is *symbolically checked*, not merely sketched.
- **Do not conflate rarity with the discs, or inflate it.** Rarity is the *ceiling* (how big it could be); the discs are the *verification state* (how proven it is) — independent axes. Rate rarity conservatively against the field ladder, `1` is allowed, and give the honest one-line `\protoraritynote`. A 5-star idea can be all-red; do not let stars borrow credibility from discs or vice versa.
- **Do not print a journal name on the card.** Calibrate the rarity against the journal rubric INTERNALLY, then print only the general tier NAME via `\prototier` (`top-5` / `flagship+` / `flagship field` / `strong field` / `seed` / `below-bar`). The `\protoraritynote` names no journal either. Naming a target journal on a 2-page prototype oversells it and dates the artefact.
- **Do not write the story as the contribution.** `\protostory` is the overall story — what world, *who* needs the result and *why*, concrete about audience and stakes; it is the line a reader uses to judge whether they NEED the paper. Keep it distinct from `\protopunch` (the one-line mechanism) and the abstract (the full pitch). A story that just restates the punch tells the reader nothing about who it is for.
- **Do not hand-edit the cover tally.** The V/P/H/C strip is auto-computed from the disc counts via the `.aux`; set the disc keys on the results and compile twice. Hand-writing the tally guarantees it drifts from the discs it is supposed to report.
- **Do not produce a polished facade.** Hiding a cracked joint behind clean prose is the one failure mode this skill cannot tolerate — graspability and an honest spine beat surface finish.
- **Do not proceed from Step 0 silently — and always announce on launch.** Print the 2–3 line announcement first, every run; then show the inventory or ask for the seed. A prototype of the wrong idea wastes the author's ten minutes and your credibility.
- **Do not put the full proof in the body.** Each block carries a tight statement + intuition + proof sketch (with its symbolic check) + risk; the fuller sketch lives in `proofs.tex`. Mixing tiers destroys the under-10-minute read.
- **Do not bloat the result statement.** State it compactly — primitives in, claim out — and push detail into Intuition and the proof sketch. An over-stated result is the commonest graspability leak.
- **Do not improvise the Setup structure.** The model section follows `main_r1.tex`'s run-in modules — `\paragraph{Players}`, `\paragraph{Timing}`, `\paragraph{Strategies}`, then `Payoffs`/`Information`/`Solution concept` only as needed. Mirroring the author's own paper is what makes the prototype read as native rather than generic.
- **Do not let a brick start indented.** Every module and building block reads as a flush-left brick — its prose opens with `\noindent`. An indented first line softens the brick boundary and the spine stops reading as discrete cards.
- **Do not chase ε-δ rigour in `proofs.tex`.** It is the sketch tier — step sequence, the mechanism made explicit, the symbolic check cited, the risky step flagged. Premature full rigour on a Conjectured result is wasted effort.
- **Do not restate the claim as the intuition.** The intuition paragraph carries the *mechanism* — the reason the spine holds — or it carries nothing.
- **Do not hand-number the skeleton or cross-references.** Reference every block by its real `\label` via `\ref`/`\Cref` so the map renumbers itself on recompile. Hand-typed numbers go stale the moment a block moves and the map silently lies.
- **Do not omit a block's risk flag or the Open-joints list.** The honesty layer is load-bearing — without it the discs are decoration and the prototype reads as more certain than it is.
- **Do not reach for `theorem` to impress.** Match the author's ladder: propositions headline, claims do the work, theorem is reserved and often unused.
- **Do not fabricate a citation or a literature review.** No source in `inputs/literature/` → no `\cite`. An invented reference is a lie the author signs their name to, and it poisons the downstream paper.
- **Do not recut the spine when the author said "stay close to this draft."** Faithful means faithful — flag joints in the Open-joints list, but preserve their structure and statements. Overriding the instruction destroys trust in distill mode.
- **Do not let the body exceed four pages.** Past four pages it stops being graspable in one pass and becomes a paper — downstream work this skill does not do.
- **Do not edit `inputs/` in place.** Inputs are read-only ore; everything forge produces goes in `proto/`.
- **Do not redefine the conventions `temper` reads.** forge owns the preamble, the disc macro, and the file layout and writes them once; the data contract breaks if they drift mid-stream. Running the checks and writing earned discs back is `temper`'s lane.

# File contract

forge **owns** every convention below and writes all of `proto/`. `temper` only reads `verification.md` and updates the discs in the main file / `skeleton.tex` to their earned values — it never touches the math, the preamble, or the layout.

```
~/.claude/forge/
  index.md          the global registry (pokedex) — one row per prototype, ever
proto/
  preamble.tex          conventions: libertine+newtxmath, amsthm + theorem roster,
                        myproof, \disc{v|p|h|c}, auto-count totals, \rarity{n} stars,
                        \makeprotocover (full-page cover + described legend + tier
                        legend, \clearpage's), the \blocktag/\Intuition/\Proofsketch/
                        \Risk/\Uses helpers, footer
  forge-NNN-slug.tex    main body, 2–4pp — \input{preamble}, the \proto* macros
                        (incl. \protostory, \prototier), \makeprotocover (= full
                        page 1), abstract-as-hook on p.2, Setup, building blocks,
                        \input{proofs}, \input{skeleton}  (compiles to forge-NNN-slug.pdf)
  proofs.tex            \input-ed appendix, footnotesize A-tier sketches w/ symbolic checks
  skeleton.tex          \input-ed last as its own page — vertical dependency-flow map
  checks/               sympy scripts, one per checkable result — the symbolic pass
  verification.md       handoff contract to temper — one row per result
  refs.bib              only sources actually leaned on
inputs/
  literature/           the leaned-on sources themselves, one file per \cite
```

# Preamble template

Write this once into `proto/preamble.tex`. Use verbatim; replace nothing. It reuses the author's own `\newtheorem` roster and the `myproof[2]` environment from `main_r1.tex`, on a `libertine` + `newtxmath` body at `10pt` with `1.3in` margins. The disc-before-label rendering needs `\newtheoremstyle`, an `amsthm` feature, so `amsthm` is loaded here (after `amsmath`; `\openbox` is neutralised first because `newtxmath` already defines it). The disc rides the note slot every `amsthm` environment already accepts (`\begin{env}[note]`), so no custom optional-argument machinery is needed: the `[v]/[p]/[h]/[c]` key lands in the style's `#3`, and an empty slot renders nothing. There is exactly **one** public disc macro, `\disc{v|p|h|c}`; the `\newtheoremstyle{status}` note slot renders `\disc{#3}` *before* the name+number, and the cover and skeleton call the same `\disc{...}`. (An internal `\discbullet` draws the coloured `$\bullet$` via `\textcolor` — no TikZ.) Three mechanisms live here: (1) **auto-count totals** — `\dischead` bumps a per-key `totcount` total-counter persisted to the `.aux` and exposed as `\protoTotV/\protoTotP/\protoTotH/\protoTotC`, read back at the top of the next pass so the cover shows correct counts; (2) **`\makeprotocover`** — the collectible-card cover, which reads the twelve `\proto*` document-set macros and the auto-counted totals, renders the card as its **own full first page**, prints the **described** confidence legend plus a compact rarity-tier legend, and `\clearpage`s so the body starts on page 2; (3) **`\rarity{<n>}`** — renders `n` out of 5 stars in 0.5 steps (no TikZ), called by the cover as `\rarity{\protorarity}` for the rarity strip that sits *under the title, above the POWER/disc strip*, with `\prototier` named beside the stars and `\protoraritynote` below. The card prints the tier **name** (`\prototier`), never a journal name. The block helpers `\blocktag`, `\Intuition`, `\Proofsketch`, `\Risk`, `\Uses` are also defined here. There is **no** top `\statuslegend` box any more — the described legend rides on the cover page.

```latex
% proto/preamble.tex — owned by forge; temper reads, never rewrites. (v0.4)

% --- fonts (adopted from main_r1.tex) ---
\usepackage[T1]{fontenc}
\usepackage{textcomp}
\usepackage{libertine}
\usepackage[libertine]{newtxmath}

% --- core math / symbols ---
\usepackage{amsmath}
\usepackage{amsfonts}
\let\Bbbk\relax  % silence duplicate-definition warning (newtxmath vs amssymb)
\usepackage{amssymb}
\usepackage[most]{tcolorbox}  % grey/coloured boxes; also pulls in xcolor
\usepackage{array}            % \extrarowheight + p-columns for the skeleton table
\usepackage{fontawesome5}     % \faStar / \faStarHalf / \faStar[regular] for \rarity

% --- geometry: more whitespace than the old 1in (centred, ~1.3in) ---
\usepackage[a4paper,margin=1.3in]{geometry}

% --- math operator shortcuts (subset from main_r1.tex) ---
\newcommand*{\prob}{\mathsf{P}}  % probability
\newcommand*{\ex}{\mathsf{E}}    % expectation

% amsthm is loaded for \newtheoremstyle (the disc design). newtxmath already
% defines \openbox, so neutralise it before amsthm redefines it.
\let\openbox\relax
\usepackage{amsthm}

% --- status colours (xcolor available via tcolorbox[most]) ---
\definecolor{stverified}{RGB}{34,139,34}    % green  -> verified   (v)
\definecolor{stplausible}{RGB}{31,119,180}  % blue   -> plausible  (p)
\definecolor{stheuristic}{RGB}{230,140,0}   % orange -> heuristic  (h)
\definecolor{stconjectured}{RGB}{200,30,30} % red    -> conjectured(c)

% Internal helper only (a scaled, nudged $\bullet$ via \textcolor; no TikZ).
\newcommand{\discbullet}[1]{{\textcolor{#1}{\raisebox{0.05ex}{\large$\bullet$}}}}

% THE one public macro: \disc{X}, X in {v,p,h,c}. One alphabet everywhere —
% cover, skeleton rows, and the theorem note slot all call \disc{...}.
% Empty/unknown key -> nothing (graceful).
\newcommand{\disc}[1]{%
  \ifx\\#1\\% empty -> nothing
  \else
    \begingroup
    \def\tmp{#1}%
    \def\kv{v}\ifx\tmp\kv\discbullet{stverified}\fi
    \def\kp{p}\ifx\tmp\kp\discbullet{stplausible}\fi
    \def\kh{h}\ifx\tmp\kh\discbullet{stheuristic}\fi
    \def\kc{c}\ifx\tmp\kc\discbullet{stconjectured}\fi
    \endgroup
  \fi}

% --- auto-count totals per disc key. Four total-counters tick up as result
%     envs open; totcount persists each grand total to the .aux, so the COVER
%     (page 1, before the blocks) prints CORRECT counts after latexmk's normal
%     multi-pass run. Exposed as \protoTotV/P/H/C, each expanding to the total.
\usepackage{totcount}
\newtotcounter{proto@v}\newtotcounter{proto@p}%
\newtotcounter{proto@h}\newtotcounter{proto@c}
% \protototal{<totcounter>}: robustly expand to the persisted grand total,
% yielding 0 (not an empty token) before the .aux is read on pass 1, so that
% \ifnum\protoTotV>0 stays well formed on every pass.
\newcommand{\protototal}[1]{%
  \ifcsname c@#1@totc\endcsname \totvalue{#1}\else 0\fi}
\newcommand{\protoTotV}{\protototal{proto@v}}
\newcommand{\protoTotP}{\protototal{proto@p}}
\newcommand{\protoTotH}{\protototal{proto@h}}
\newcommand{\protoTotC}{\protototal{proto@c}}
\newcommand{\protocount}[1]{%
  \def\tmp{#1}%
  \def\kv{v}\ifx\tmp\kv\stepcounter{proto@v}\fi
  \def\kp{p}\ifx\tmp\kp\stepcounter{proto@p}\fi
  \def\kh{h}\ifx\tmp\kh\stepcounter{proto@h}\fi
  \def\kc{c}\ifx\tmp\kc\stepcounter{proto@c}\fi}

% Head wrapper: bump the count, then disc + thin space, only when non-empty.
\newcommand{\dischead}[1]{\ifx\\#1\\\else\protocount{#1}\disc{#1}\thinspace\fi}

% Custom style: the note (#3 = the [v]/[p]/[h]/[c] key) renders FIRST as a disc.
\newtheoremstyle{status}%
  {\topsep}{\topsep}%        space above / below
  {\itshape}%                body font
  {}%                        indent
  {\bfseries}%               head font
  {.}%                       punctuation after head
  {.5em}%                    space after head
  {\dischead{#3}\thmname{#1}\thmnumber{ #2}}% disc BEFORE name+number
\theoremstyle{status}

% --- author's theorem roster (from main_r1.tex), now under the status style ---
\newtheorem{claim}{Claim}
\newtheorem{assumption}{Assumption}
\newtheorem{theorem}{Theorem}
\newtheorem{proposition}{Proposition}
\newtheorem{definition}{Definition}
\newtheorem{lemma}{Lemma}
\newtheorem{corollary}{Corollary}
\newtheorem{remark}{Remark}

% --- author's sketch-tier proof env (from main_r1.tex): type + \ref, ends ■ ---
\newenvironment{myproof}[2]{\paragraph{Proof of {#1} {#2}.}}{\hfill $\blacksquare$}

% --- building-block furniture: a rule + tag so each block reads as a card ---
\newcommand{\blocktag}[1]{%
  \par\bigskip{\color{gray!55}\rule{\linewidth}{0.4pt}}\par
  \nobreak\vspace{2pt}{\footnotesize\bfseries\color{gray!70}#1}\par
  \nobreak\vspace{2pt}}
\newcommand{\Intuition}{\noindent\textbf{Intuition.}\ }
\newcommand{\Proofsketch}{\noindent\textbf{Proof sketch.}\ }
\newcommand{\Risk}{\noindent\textbf{Risk.}\ }
\newcommand{\Uses}{\noindent\textbf{Uses $\rightarrow$}\ }

% --- rarity strip: \rarity{<n>} renders n out of 5 stars in 0.5 steps. (v0.4)
%     The AMBITION axis (ceiling), distinct from the POWER discs (verification).
%     The card names the TIER (\prototier) beside the stars, never a journal.
%     Stars via fontawesome5: \faStar (full) · \faStarHalf (half) ·
%     \faStar[regular] (empty). Gold-toned so it reads as a separate axis.
%     pdflatex-safe (TeX Live 2024). Work in HALF-STAR UNITS to stay integer:
%     \rar@two = round(2*n), so a whole star is 2 units and a half is 1. The
%     @-bearing macros sit inside \makeatletter because preamble is \input in
%     the body where @ is catcode-12.
\definecolor{strarity}{RGB}{200,150,0}  % gold -> ambition / rarity
\makeatletter
\newcount\rar@two \newcount\rar@slot \newcount\rar@rem
% \rar@parse #1 -> \rar@two = 2*#1; append ".0" so the fractional field is
% always a digit (\"3\" -> 3.0.0, \"4.5\" -> 4.5.0); a leading 5 is a half.
\def\rar@parse#1{\rar@split#1.0.\relax}
\def\rar@split#1.#2#3\relax{%
  \rar@two=#1\relax \multiply\rar@two by 2\relax
  \ifnum#2=5 \advance\rar@two by 1\relax\fi}
\newcommand{\rarity}[1]{%
  \begingroup
  \edef\rar@arg{#1}%                        EXPAND first so \protorarity works
  \expandafter\rar@parse\expandafter{\rar@arg}%   \rar@two = 2*n (half-units)
  {\color{strarity}%
   \rar@slot=0
   \loop
     \advance\rar@slot by 1
     \rar@rem=\rar@two
     \advance\rar@rem by -\numexpr 2*(\rar@slot-1)\relax  % units left for slot
     \ifnum\rar@rem>1 \faStar
     \else\ifnum\rar@rem=1 \faStarHalf
     \else {\faStar[regular]}%
     \fi\fi
   \ifnum\rar@slot<5 \repeat}%
  \endgroup}
\makeatother

% --- collectible-card cover. Reads the \proto* document-set macros; the POWER
%     strip reads the auto-counted \protoTotV/P/H/C, and the rarity strip reads
%     \protorarity / \prototier / \protoraritynote. Call \makeprotocover once,
%     at the top of the body: it is its OWN full first page and \clearpage's, so
%     the body (abstract, Setup, blocks) begins on page 2. The DESCRIBED
%     confidence legend (one line per level) plus a compact rarity-tier legend
%     ride at its foot — there is no separate \statuslegend box any more. The
%     card prints the TIER NAME (\prototier), never a journal name. The totals
%     expand to \totvalue{...} which is NOT \ifnum-digestible, so each is staged
%     through a scratch counter. (v0.4)
\newcounter{proto@scratch}
\newcommand{\makeprotocover}{%
\begin{tcolorbox}[enhanced, breakable=false, sharp corners=downhill,
                  colback=gray!2, colframe=gray!55, boxrule=0.8pt,
                  arc=4pt, left=12pt, right=12pt, top=9pt, bottom=9pt,
                  drop shadow southeast]
  {\footnotesize\color{gray!75}%
    \textbf{№\,\protonum}\;\textperiodcentered\;\protofield
    \;\textperiodcentered\;\protodate
    \hfill \textsc{forge \textperiodcentered\ beta 0.1}}\par
  \vspace{4pt}{\color{gray!40}\rule{\linewidth}{0.4pt}}\par\vspace{6pt}
  {\LARGE\bfseries \prototitle}\par\vspace{2pt}
  {\itshape\color{gray!75} \protosubtitle}\par\vspace{6pt}
  % --- rarity strip (AMBITION axis; gold stars, distinct from POWER) ---
  % sits under title/subtitle, above STORY/PUNCH/SPINE/POWER. Tier NAME only.
  {\footnotesize\textbf{RARITY.}\ \rarity{\protorarity}\ %
    {\color{strarity}(\protorarity/5)}\quad
    {\bfseries\color{strarity}\prototier}\par
   \footnotesize\itshape\color{gray!70}\hspace*{0pt}\protoraritynote\par}\vspace{6pt}
  % --- STORY: what world, who needs it, why. Rendered prominently. ---
  {\textbf{STORY.}\ \protostory\par}\vspace{6pt}
  % --- PUNCH: the one-line mechanism, distinct from the story above. ---
  {\color{stplausible}$\blacktriangleright$}\ \protopunch\par\vspace{6pt}
  {\footnotesize\textbf{SPINE.}\ \protospine}\par\vspace{5pt}
  {\color{gray!40}\rule{\linewidth}{0.4pt}}\par\vspace{5pt}
  {\footnotesize\textbf{POWER.}\ %
    \setcounter{proto@scratch}{\protoTotP}\disc{p}\,\arabic{proto@scratch}\ Plausible
    \;\textperiodcentered\;
    \setcounter{proto@scratch}{\protoTotH}\disc{h}\,\arabic{proto@scratch}\ Heuristic
    \;\textperiodcentered\;
    \setcounter{proto@scratch}{\protoTotC}\disc{c}\,\arabic{proto@scratch}\ Conjectured\par}
  {\footnotesize
    \setcounter{proto@scratch}{\protoTotV}%
    \ifnum\value{proto@scratch}>0
      \disc{v}\,\arabic{proto@scratch}\ verified%
    \else
      \disc{v}\,0 verified --- run \textsc{temper} to charge them green%
    \fi\par}
\end{tcolorbox}%
% --- DESCRIBED confidence legend: one line per level (no longer a bare strip).
\vspace{6pt}
{\footnotesize\color{gray!75}\textbf{Confidence discs.}\par
 \disc{v}~\textbf{Verified} --- complete symbolic proof (forge) or clean numeric
   confirmation (temper).\par
 \disc{p}~\textbf{Plausible} --- the load-bearing step is symbolically checked;
   the rest is sketched.\par
 \disc{h}~\textbf{Heuristic} --- intuition or analogy only, nothing checked.\par
 \disc{c}~\textbf{Conjectured} --- believed, no argument yet.\par}
% --- compact rarity-tier legend (the ceiling ladder; tier NAMES, no journals).
\vspace{4pt}
{\footnotesize\color{gray!75}\textbf{Rarity tiers.}\ %
 {\color{strarity}5}~top-5 \;\textperiodcentered\;
 {\color{strarity}4.5}~flagship+ \;\textperiodcentered\;
 {\color{strarity}4}~flagship field \;\textperiodcentered\;
 {\color{strarity}3}~strong field \;\textperiodcentered\;
 {\color{strarity}2}~seed \;\textperiodcentered\;
 {\color{strarity}1}~below-bar\par}
\clearpage}  % cover is its own full first page; body starts on page 2

% --- footer stamp ---
\newcommand{\forgestamp}{prototype \textperiodcentered\ forge \textperiodcentered\ beta 0.1}
\usepackage{fancyhdr}
\pagestyle{fancy}\fancyhf{}
\renewcommand{\headrulewidth}{0pt}\renewcommand{\footrulewidth}{0pt}
\fancyfoot[C]{\footnotesize\color{gray!70}\forgestamp}
\fancyfoot[R]{\footnotesize\color{gray!70}\thepage}
```

# Body template

Use verbatim for the main file `forge-NNN-slug.tex`. Replace `{{placeholders}}`. Set all twelve `\proto*` macros before `\begin{document}`; call `\makeprotocover` once at the top of the body (no `\statuslegend`). The cover is its **own full first page** — `\makeprotocover` `\clearpage`s, so the abstract begins on page 2. Each building block is a node to render *when the spine has one there* — blocks are nodes, not quotas. Add as many as the spine has; do not pad to a count.

```latex
\documentclass[10pt,a4paper]{article}
\input{preamble}                 % owns geometry, fonts, discs, the cover macro

% --- document-set macros read by \makeprotocover (define BEFORE document) ---
\newcommand{\protonum}{{{NNN}}}          % zero-padded 3-digit registry id, e.g. 007
\newcommand{\protoslug}{{{slug}}}        % matches the filename and the registry row
\newcommand{\protofield}{{{econ / OR / IS}}}
\newcommand{\protodate}{\today}          % the real current date
\newcommand{\prototitle}{{{working title}}}
\newcommand{\protosubtitle}{{{one-line framing under the title}}}
\newcommand{\protostory}{{{the STORY (1–2 sentences): what world, WHO needs this
  result and WHY — concrete about audience and stakes, NOT the contribution}}}
\newcommand{\protopunch}{{{the ONE-LINE mechanism — what the paper buys you}}}
\newcommand{\protospine}{Lem~\ref{lem:{{key}}} $\to$ Cor~\ref{cor:{{key}}}
  $\to$ Prop~\ref{prop:{{key}}} $\Rightarrow$ Thm~\ref{thm:{{key}}}}  % compressed chain
\newcommand{\protorarity}{{{0–5, half-steps}}}    % the ceiling, rated against the field ladder
\newcommand{\prototier}{{{top-5 / flagship+ / flagship field / strong field / seed / below-bar}}}  % tier NAME, never a journal
\newcommand{\protoraritynote}{{{one-line why these stars — no journal name}}}

\title{\prototitle}
\date{\protodate}
% No \author yet — authorship is a paper concern, not a prototype concern.

\begin{document}
\thispagestyle{fancy}

\makeprotocover                  % collectible-card cover = full page 1; \clearpage's

% --- body begins on page 2 ---
\begin{abstract}
\noindent {{The compressed hook — NOT a summary. The question; what is new;
why it matters. A few sentences.}}
\end{abstract}

\section{Setup}\label{sec:setup}
% Mirror main_r1.tex: run-in \paragraph modules, in THIS order. Players /
% Timing / Strategies are required; add Payoffs / Information / Solution
% concept ONLY if the model needs them. Each brick starts with \noindent.
\paragraph{Players.}\noindent {{who the agents are and the primitives they carry}}
\paragraph{Timing.}\noindent {{the stage structure — who moves when}}
\paragraph{Strategies.}\noindent {{the choice sets / strategy spaces}}
% --- extra modules only as needed ---
\paragraph{Payoffs.}\noindent {{objectives — omit if folded into the above}}
\paragraph{Information.}\noindent {{what each player knows — omit if complete-info}}
\paragraph{Solution concept.}\noindent {{the equilibrium notion — omit if obvious}}

\begin{assumption}[{{v|p|h|c}}]\label{ass:{{key}}}{{the load-bearing functional-form / structural restriction}}\end{assumption}
\Intuition {{why the restriction is the natural minimal one}}

\section{Building blocks}\label{sec:blocks}

% ---- Block: repeat per spine node. [v|p|h|c] rides the note slot. ----
\blocktag{BLOCK {{n}} \textperiodcentered\ {{short name}}}
\begin{proposition}[{{v|p|h|c}}]\label{prop:{{key}}}
{{the formal statement — primitives in, claim out, stated tightly, no prose}}
\end{proposition}
\Intuition {{the real economic/structural mechanism — why it holds, not a
restatement of the claim; detail trimmed from the statement lands here}}

{\footnotesize\Proofsketch {{one line naming the move}}. Check \checkmark\
(symbolic): {{exactly what proto/checks established}}.\par}

{\footnotesize\Risk {{the single step or assumption most likely to break}}.\par}

\Uses Assumption~\ref{ass:{{key}}}.  % omit if it uses only Setup
% ---- end block ----

\section*{Open joints}
\begin{itemize}\setlength{\itemsep}{1pt}
  \item {{which results have no full argument yet}} (would promote \disc{p}$\to$\disc{v}).
  \item \textbf{Load-bearing:} Assumption~\ref{ass:{{key}}} — {{what fails if it is dropped}}.
  \item \textbf{Could break:} {{the joint most likely to fail under scrutiny}}.
\end{itemize}

\appendix
\input{proofs}
\input{skeleton}

\bibliographystyle{plainnat}
\bibliography{refs}   % omit this line if no source is actually leaned on
\end{document}
```

# Proofs template

Use verbatim for `proto/proofs.tex`. A-tier: step sequence + the key mechanism made explicit + the `Check ✓ (symbolic)` line citing `proto/checks/` — not full rigour. The whole section is `\footnotesize`; `\input`-ed after `\appendix`. Where a result is conjectural, say so in-line. Omit a sketch only if the result is `[c]` Conjectured with no argument to give.

```latex
% proto/proofs.tex — A.Proofs tier: sketches, not full rigour. (v0.2)
\section{Proof sketches}\label{app:proofs}

\footnotesize

\begin{myproof}{Proposition}{\ref{prop:{{key}}}}
{{step 1 $\to$ step 2 $\to$ step 3; name the mechanism that does the work.}}
Check \checkmark\ (symbolic): {{exactly what proto/checks established — the
derivative signed, the numerator factored, the threshold solved}}.
{{If conjectural: "Conjectural: {{what is not established here}}."}}
\end{myproof}
```

# Skeleton template

Use verbatim for `proto/skeleton.tex`. A **readable logic story**, not a jargon table — "read down; each step follows from the ones above." Real `\ref` only — never hand-typed numbers, never `Lem`/`Cor`/`Prop`/`Thm`. `\input`-ed last, on its own page, inside the `tcolorbox`. Each node is a **two-line brick** via `\sknode{disc}{name}{plain-English role}{one concrete detail}`; logical steps are joined by `\skstep{<logic word>}` (a centered down-arrow carrying `so` / `then` / `and` / `still open`). Add `(needs <Full Name>)` in the detail line **only** for a cross-link that is not the node directly above. No tier headers; the optional faint `\sktag{<tier>}` is allowed but must not dominate. Keep the disc legend in the title, the one-line footnote, and one page. Rule of thumb: the page must read in ~20 seconds.

```latex
% proto/skeleton.tex — dependency-flow map as a readable LOGIC STORY. (v0.3)
% Read down; each step follows from the ones above. Renumbers on recompile.
\clearpage
\section*{Dependency-flow skeleton}
\addcontentsline{toc}{section}{Dependency-flow skeleton}

% A NODE brick: disc, full name (bold), plain-English role; then an indented
% smaller concrete-detail line. #1 disc | #2 \ref name | #3 role | #4 detail.
\newcommand{\sknode}[4]{%
  \noindent #1\, \textbf{#2} \;---\; #3\par
  \nobreak\smallskip
  {\footnotesize\color{gray!75}\hspace*{1.6em}#4\par}}

% The logic arrow between steps, carrying the connective word.
\newcommand{\skstep}[1]{%
  \par\medskip\centerline{$\downarrow$\ \footnotesize\itshape\color{gray!70}#1}\par\medskip}

% A faint right-aligned tier tag (OPTIONAL, must not dominate).
\newcommand{\sktag}[1]{\hfill{\scriptsize\color{gray!45}#1}}

\begin{center}
\begin{tcolorbox}[enhanced, breakable, width=0.92\linewidth,
                  colback=gray!3, colframe=gray!45, boxrule=0.5pt,
                  arc=3pt, left=12pt, right=12pt, top=8pt, bottom=8pt,
                  title={Argument flow \quad
                         \disc{v}\,V \;\disc{p}\,P \;\disc{h}\,H \;\disc{c}\,C}]

\sknode{\disc{{{v|p|h|c}}}}{Assumption~\ref{ass:{{key}}}}{{{plain-English role}}}{%
  {{one concrete detail — the key condition}}\sktag{setup}}

\skstep{so}

\sknode{\disc{{{v|p|h|c}}}}{Lemma~\ref{lem:{{key}}}}{{{plain-English role}}}{%
  {{one concrete detail — the mechanism}}\sktag{engine}}

\skstep{so}

\sknode{\disc{{{v|p|h|c}}}}{Theorem~\ref{thm:{{key}}}}{{{plain-English role}}}{%
  {{one concrete detail — the formula}}%
  \;\textnormal{(needs Proposition~\ref{prop:{{key}}})}\sktag{main result}}

\skstep{still open}

\sknode{\disc{c}}{{{Open question?}}}{{{the gap, in plain English}}}{%
  {{what would close it — and which result it would turn green}}\sktag{open frontier}}

\medskip
\hrule
\smallskip
{\footnotesize\itshape
Read top-to-bottom: each step follows from the ones above; the word on each
$\downarrow$ is the logic. ``(needs $X$)'' flags a step that leans on something
not directly above it. Disc colour = current verification status.}

\end{tcolorbox}
\end{center}
```

# Verification contract template

Use verbatim for `proto/verification.md`. This is the data contract `temper` reads. Replace `{{placeholders}}`; one row per checkable result.

```markdown
# Verification plan — {{working title}}

Handoff from **forge** (symbolic) to **temper** (numeric). Prototype:
`forge-{{NNN}}-{{slug}}.tex` · forged {{real current date}}. forge already ran the
symbolic pass (`proto/checks/`); temper builds `proto/verify.py`, runs the
NUMERIC checks (random instances, counterexample hunt, limiting cases by number),
and updates the discs in the main file and `skeleton.tex` to their earned values.
temper never edits the math, and never touches the auto-computed cover tally.

**Word↔letter mapping.** The *Current disc* column uses the full WORD; the `.tex`
`\disc{...}` macro and the `[v|p|h|c]` environment argument use the LETTER:
**Verified = v · Plausible = p · Heuristic = h · Conjectured = c.**

| Label | Result | Current disc | Symbolic check (forge) | Proposed numeric check (temper) |
|-------|--------|--------------|------------------------|----------------------------------|
| `prop:{{key}}` | {{one-line gist}} | {{Conjectured / Heuristic / Plausible / Verified}} | {{what proto/checks settled, or ✗}} | {{random instances · counterexample hunt · limiting case by number}} |
| `lem:{{key}}`  | {{...}} | {{...}} | {{...}} | {{...}} |

## Evidence already in hand
- {{result label}}: confirmed by `inputs/{{file.py/ipynb}}` — {{what it computes}}.
  (Promotes to Verified.) Omit this section if none.

## Open joints
- **Unproven:** {{which results have no full argument yet}}.
- **Load-bearing assumption:** {{the one assumption the spine cannot lose}} — {{what fails without it}}.
- **Could break:** {{the step or case most likely to fail under temper}}.
```

# Registry template

`~/.claude/forge/index.md` is the global registry (pokedex). Seed it once with the header below; append one row per run after the PDF compiles. The date is the **real current date**; the `V/P/H/C` tally is this prototype's disc counts.

```markdown
# forge registry

| # | slug | field | date | V/P/H/C | pdf |
|---|------|-------|------|---------|-----|
| #007 | endo-blotto | econ | 2026-06-13 | 0/2/1/1 | proto/forge-007-endo-blotto.pdf |
```

The bare row to append:

```
| #{{NNN}} | {{slug}} | {{econ/OR/IS}} | {{YYYY-MM-DD}} | {{V}}/{{P}}/{{H}}/{{C}} | {{path-to-pdf}} |
```

# Rules of thumb

- **Announce on launch, every run.** A skill the user cannot see fire goes unused — open with the 2–3 line announcement before anything else.
- **A prototype is a thinking instrument, not a short paper.** Optimise for the ten-minute read and the spine judgment; everything that does not help the reader judge the spine is filler.
- **Verify symbolically before you assert.** An invented result has no value. Drive the key algebra through `proto/checks/` sympy and cite `Check ✓ (symbolic)`; if it will not check, lower the disc and say so. forge earns green by a complete symbolic proof — temper earns it by number.
- **Discs report evidence, not hope.** A green you cannot defend with a proof or a number is the one lie the instrument must not tell — honest orange beats dishonest green. blue means *symbolically checked key step*, not merely sketched.
- **Rarity is the ceiling, not the verification.** Stars rate how big it could be against the field ladder; the discs rate how proven it is. Two axes — rate rarity conservatively (`1` is allowed), write the honest one-line why, and never let stars and discs borrow each other's credibility.
- **Calibrate against journals privately; print the tier name.** The journal anchors are forge's own ruler — the card shows the tier NAME (`\prototier`), never a journal. A journal name on a prototype oversells it.
- **The story names the reader.** `\protostory` says what world it is, who needs the result and why — the line a reader uses to decide they NEED the paper. It is not the punch (mechanism) and not the abstract (full pitch); if you cannot name the audience and the stakes, the spine has no reader yet.
- **Set up the model the author's way.** Run-in `\paragraph{Players}`/`Timing`/`Strategies` first, extras only as needed — it mirrors `main_r1.tex` so the prototype reads as native.
- **Bricks start flush-left.** Every module and block opens with `\noindent`; an indented first line means the brick boundary has gone soft.
- **State results tightly.** Primitives in, claim out; detail goes to Intuition and the sketch. A bloated statement is the commonest graspability leak.
- **Intuition is the mechanism, not the claim.** A paragraph that paraphrases the statement teaches nothing about *why* the spine holds.
- **Never hand-edit the cover tally.** It is auto-computed from disc counts via the `.aux`; set the keys, compile twice.
- **Match the author's ladder.** Propositions headline, claims do the work, theorem stays reserved — the rung you pick is a signal to the reader.
- **No source, no citation.** A fabricated reference forges the one thing forge must keep honest, and it poisons every stage downstream.
- **Let LaTeX number the spine.** `\ref` to labels everywhere; hand-typed numbers go stale and the skeleton quietly starts lying.
- **The skeleton is a logic story, readable in ~20 seconds.** Lay it out top-to-bottom: each node is a plain-English role plus one concrete-detail line, the arrows carry the logic word (`so` / `then` / `still open`), dependencies sit by position with `(needs X)` only for a cross-link, object names spelled in full, no tier-header clutter. If a reader cannot see what each step does and why it follows in twenty seconds, it has failed — a jargon table is not a skeleton.
- **Blocks are nodes, not quotas.** Render one block per spine node and stop — padding to a count dilutes the graspability you are paid to protect.
- **Stop at the prototype.** forge makes the forgery; temper earns the green; ledger relaxes the assumptions. The clean boundary is the value — crossing it dilutes every stage.
