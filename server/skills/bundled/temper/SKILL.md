---
name: temper
version: 0.1.0
description: Temper a forge prototype — read `proto/verification.md`, build and run a small numeric harness (`proto/verify.py`) that stress-tests each checkable result (special / limiting cases, random instances, an active counterexample hunt), then update the confidence discs in `prototype.tex` and `skeleton.tex` to their EARNED values and write `proto/temper-report.md`. On failure it diagnoses, shows the breaking instance, and SUGGESTS fixes — it never edits the math. TRIGGER ONLY when a forge prototype already EXISTS — a `proto/` directory containing `verification.md` and discs — and the user wants to verify / check / stress-test / numerically confirm / harden those results, turn the discs green, or hunt for a counterexample. The existing prototype is a hard precondition: with no `proto/verification.md`, do NOT fire even on "turn the discs green". SKIP and point at forge / the discuss loop when the user asks to verify and fix the MATH with no prototype in hand. SKIP generic robustness or sanity checks on a standalone `.py` script when no prototype exists. SKIP "which assumption should I relax, systematically" — that is the future ledger, not temper.
---

# Purpose

Harden a forge prototype: read `proto/verification.md`, build a small **numeric** harness `proto/verify.py` that runs each checkable result through limiting cases by number, random instances, and an active counterexample hunt, then update the confidence discs in the main file (`forge-NNN-slug.tex`) and `skeleton.tex` to the values the evidence earns, recompile, and write `proto/temper-report.md`. temper is the second half of the workflow the disc names encode, and the two halves split cleanly by *kind* of verification: **forge owns the symbolic / analytic pre-numeric checks** (and can earn green by a complete symbolic proof); **temper owns the numeric harness** — random instances, the counterexample hunt, limiting cases by number — and pushes discs to green by numeric confirmation. The skill **reads and updates** the artefact; it does **not** own its conventions, it does **not** touch the math, and it does **not** hand-edit the auto-computed cover tally (flipping a disc key and recompiling updates it). When a check fails it diagnoses, shows the breaking instance, and suggests a fix — applying that fix is forge's job, and systematically searching for which assumption to relax is the future **ledger**'s. Stop at the verdict.

# Procedure

## Step 0. Announce yourself out loud — every run

Make this the **first action of the run, before anything else** — print a 2–3 line spoken announcement to the user. Print it *every* run, not just the first: a skill the user cannot see fire feels like the model went quiet, and the workflow goes unused for want of announcing itself. State what temper does and what it needs:

> **temper** is the NUMERIC half of the workflow: I read a forge prototype's `proto/verification.md`, build and run a small harness (`proto/verify.py`) that stress-tests each result — random instances, limiting cases by number, an active counterexample hunt — then charge the confidence discs green where the numbers confirm them, drop and flag them where they don't. forge already did the symbolic checks; I never edit the math, I report and suggest fixes.
> I need an existing forge prototype: a `proto/` folder with `verification.md` and discs. With none, I'll point you at forge and stop.

Then orient in the folder and read the contract — do this before writing a line of Python, because the contract names the lane.

1. **Find the artefact.** Expect `proto/verification.md`, the main file (`proto/forge-NNN-slug.tex`), `proto/skeleton.tex`, `proto/preamble.tex`, and a `proto/checks/` directory of forge's symbolic scripts. If `proto/` or `verification.md` is missing, stop and say so — there is nothing to temper. **Do not generate a prototype; that is forge.** Point the user at forge and stop.

2. **Read `verification.md` end-to-end.** It is the only thing temper reads from forge's intent: one row per result — label, current disc, the symbolic check forge already ran, and the proposed *numeric* check — plus the notes block (which checks are cheap vs. expensive, which result is most likely to break, any `inputs/` code that already backs a result). The proposed numeric check defines the harness; honour it, and only extend it when a row's check is too weak to settle a disc. The *Current disc* column uses the full WORD; translate it to the letter the `.tex` uses via the mapping in step 3.

3. **Confirm the disc macro, the word↔letter mapping, and the auto-tally.** The discs are driven by the single public macro `\disc{v|p|h|c}` and the optional environment argument `[v|p|h|c]`, both defined in `preamble.tex`. There is no `\statusdisc`/`\statusbadge` and no `discV/discP/discH/discC` token alphabet — one alphabet (`v|p|h|c`) everywhere. `verification.md`'s *Current disc* column states the full WORD; the `.tex` macro and argument use the LETTER, mapping one-to-one: **Verified = v · Plausible = p · Heuristic = h · Conjectured = c.** temper reads the word in `verification.md`, then writes the matching letter into the `[...]` argument and the `\disc{...}` token per result — and nothing else in the `.tex`. **The cover card's confidence tally is AUTO-COMPUTED** from the disc counts (the per-key totals persist via the `.aux` as `\protoTotV/\protoTotP/\protoTotH/\protoTotC`): when temper flips a result's disc key and recompiles, the cover updates itself on the next pass. **temper never hand-edits the tally** — it flips disc keys and recompiles, nothing more.

## Step 1. Plan the harness, decide effort

temper is the **numeric** lane: forge already ran the *symbolic* pre-numeric checks (the `Check ✓ (symbolic)` lines and the `proto/checks/` scripts), so temper's job is to confirm by number what survives — and to find where the symbolic story breaks on actual instances. For each row, classify the proposed numeric check into the three probe kinds, because each earns a different disc ceiling:

- **Limiting case by number** — evaluate a closed form at a boundary (`n=2`, `z→0`, symmetric agents) and compare against a hand value. Passing limiting cases support **Plausible**, not Verified — they are necessary, not sufficient.
- **Random instances** — sample the parameter domain, evaluate the claim numerically (an equality to tolerance, an inequality, a monotonicity), count passes. Broad random coverage with no failure earns **Verified** for a numeric claim.
- **Counterexample hunt** — actively search for a violation: grid sweep, then random search, then a small optimiser pushed toward the constraint boundary. A clean hunt over a stated domain is the strongest numeric evidence; a hit demotes the disc and produces the breaking instance.

A result forge already marked green by a complete symbolic proof needs no numeric earning — but a numeric pass is still a cheap cross-check, and a numeric *contradiction* of a symbolic green is a real finding worth reporting.

**Effort is workflow-aware, not workflow-dependent.** The default is single-context: one `verify.py`, one run. **Escalate to parallel per-result checks only when** there are many results, **or** the counterexample hunts are expensive, **or** `ultracode` is on — fan the independent per-result checks out across workers, then synthesise one report. In claude.ai (no subagents), fall back silently to single-context. temper is lighter than forge; do not over-build the harness.

## Step 2. Build `proto/verify.py`

Write one self-contained harness (template below). One function per result, keyed by its `verification.md` label, each returning a structured verdict (`pass` / `fail` / `inconclusive`, the disc earned, the breaking instance if any, the coverage). A `main()` runs all checks and prints a per-label table. Seed the RNG so a reported breaking instance reproduces. Prefer the standard scientific stack already on the machine (`numpy`, and `scipy` only if a check needs an optimiser or solver). If a result is **non-numeric** (a pure existence or structural claim with nothing to sample), mark it `inconclusive` — do not invent a probe that proves nothing.

## Step 3. Run, and map evidence to a disc

Run `python proto/verify.py`. Map each result's outcome to its earned disc — the same ladder forge uses, now driven by what the harness actually found:

| Disc | Level | Earned when temper's harness shows |
|------|-------|-------------------------------------|
| green `[v]` | **Verified** | broad random coverage passes AND the counterexample hunt comes back clean over the stated domain (or a limiting case is exact and exhaustive) — numeric confirmation. (A complete symbolic proof forge already shipped as green also stands.) |
| blue `[p]` | **Plausible** | limiting cases pass and no counterexample found, but coverage is partial |
| orange `[h]` | **Heuristic** | only a probe or two ran, or the claim is structural and untested numerically |
| red `[c]` | **Conjectured** | not checkable as stated, or no probe could be built |

A disc may also **drop**: if a check fails, the result cannot stay above the level its surviving evidence supports — usually `[c]` or `[h]`, with the failure documented. Never raise a disc on intuition; green is earned by the harness, never assigned.

## Step 4. Update the discs in place

For every result whose disc changes, edit the main file (`forge-NNN-slug.tex`) and `skeleton.tex` to the earned value — and **only** the disc tokens:

- the optional environment argument: `\begin{proposition}[h]` → `\begin{proposition}[v]`,
- the matching `\disc{...}` on that result's row in `skeleton.tex`.

Match the label to the macro via the `\label{...}` on the environment, and translate the earned word to its letter (**Verified = v · Plausible = p · Heuristic = h · Conjectured = c**) before writing it. Change nothing else — not the statement, not the intuition, not the proof sketch, not a single inequality, **and not the cover tally** (it is auto-computed; flipping the disc key is what moves it). **temper flips the disc key per result; the math is forge's lane.**

## Step 5. Recompile and stamp

Recompile the main file with `latexmk -pdf` so the updated discs and the skeleton's confidence distribution render — **run it twice** so the `.aux` round-trip recomputes the cover card's auto-tally from the new disc counts. The footer stamp temper leaves is `temper · beta 0.1`. If the build breaks, fix only the disc-token edit you just made (a stray bracket, a wrong letter) and recompile — do not touch anything forge wrote beyond the discs, and never hand-edit the tally.

## Step 6. On failure — diagnose, show the instance, suggest, then stop

When a check fails, the report is the product. For each failing result:

1. **Show the breaking instance** — the exact parameter values, the claimed vs. actual quantity, and the reproducing seed. Concrete beats narrated.
2. **Diagnose** — name which sketch step in `proofs.tex` the instance violates, if you can localise it (the inequality that flips, the limit that does not commute, the existence that fails off the assumed domain). If the failure contradicts a `Check ✓ (symbolic)` line, flag that explicitly — the symbolic pass either has a gap or assumed a domain the instance left.
3. **Suggest fixes, do not apply them** — offer 1–3 concrete moves: add or strengthen an assumption, restrict the domain to where the hunt stayed clean, weaken a strict inequality to weak, split the claim into the regime that holds and the regime that breaks. Each fix carries a one-line consequence so the author can choose.

Then stop. **Applying a fix is forge's job** (or the discuss-and-refine loop); **systematically exploring which assumption to relax is the ledger's**. temper found the crack and named the repair — crossing into the repair dilutes both lanes.

## Step 7. Write the report and hand back

Write `proto/temper-report.md` (template below): per-result outcome, earned disc, coverage, breaking instance and suggested fixes where a check failed, and a one-line confidence-distribution summary (how many discs are now green vs. before). Close by handing back in ≤6 lines: report location, count of discs raised to green, any result that broke and the cheapest suggested fix, and — if any disc is still red/orange — the suggestion to **re-run forge to apply a fix, or open the discuss loop**. Mention the future **ledger** for systematic assumption-relaxation. A skill that never resurfaces when relevant goes unused.

# Constraints

- **Do not edit the prototype's math.** Statements, intuition, proof sketches, and every inequality are forge's lane — forge owns the symbolic side, temper the numeric. temper changes only the disc tokens. Editing the math here erases the boundary that makes the verdict trustworthy.
- **Do not hand-edit the cover tally.** It is auto-computed from the disc counts via the `.aux`; flip the disc key and recompile twice — the card updates itself. Hand-writing it guarantees it drifts from the discs it reports.
- **Do not apply a fix.** temper suggests; forge (or the discuss loop) applies. Mixing diagnosis with repair means the next reader cannot tell what was checked from what was changed.
- **Do not generate a prototype.** No `proto/` or no `verification.md` means there is nothing to temper — point the user at forge and stop. temper reads the artefact; it never originates it.
- **Do not assign green on intuition.** A disc goes green only when the harness earns it — broad coverage plus a clean counterexample hunt. A confident result with no passing probe is `[h]` at most.
- **Do not invent a probe for an unprobeable claim.** A pure structural or existence claim with nothing to sample is `inconclusive`; mark it so. A probe that tests a trivial corollary and calls the result Verified is a green facade — the one thing the whole workflow exists to prevent.
- **Do not redefine the conventions.** The disc macro, the preamble, and the file layout belong to forge. temper depends on the exact macro names (`\disc`, `[v/p/h/c]`); improvising breaks the contract.
- **Do not hide a failed check to keep a disc.** A drop is information. Demote the disc, document the instance, and report it — a survived facade is worse than an honest red.
- **Do not over-build the harness.** temper is lighter than forge. One `verify.py`, the checks the contract names, parallelised only when there are many results. Gold-plating the harness is effort the verdict does not need.
- **Do not silently extend a check beyond its row.** If a `verification.md` check is too weak to settle a disc, strengthen it and say so in the report — but keep the result keyed to its label so the artefact and the harness stay aligned.

# File contract

forge **owns** every convention; temper **reads** `verification.md`, the main file, `skeleton.tex`, `preamble.tex`, and `checks/`, and **writes** only `verify.py`, the disc tokens, and the report.

```
proto/
  verification.md       READ — the handoff: label, current disc, symbolic + numeric check
  forge-NNN-slug.tex    UPDATE discs only — [v/p/h/c] on the env; never the math, never the tally
  skeleton.tex          UPDATE discs only — the \disc{...} on each result's row
  preamble.tex          READ — owns \disc, the colours, the auto-tally, the cover, the footer
  checks/               READ — forge's symbolic scripts; a numeric failure may contradict one
  verify.py             WRITE — the numeric harness, one check per result label
  temper-report.md      WRITE — per-result verdict, breaking instances, suggested fixes
inputs/                 READ-ONLY — code here may already back a result (note it)
```

# `verify.py` template

Use verbatim. Replace `{{placeholders}}`. One function per result keyed by its `verification.md` label; each returns a structured verdict. Seed the RNG so any breaking instance reproduces.

```python
"""temper harness — checks the results in proto/verification.md.
Run: python proto/verify.py
Reports per-result: PASS / FAIL / INCONCLUSIVE, earned disc, breaking instance.
temper updates the discs in the .tex from these verdicts; it never edits the math."""

import numpy as np
np.random.seed(0)  # breaking instances reproduce

TOL = 1e-9
N_RANDOM = {{20000}}        # random-instance coverage
HUNT_BUDGET = {{50000}}     # counterexample-hunt draws over the stated domain


def verdict(label, passed, disc, coverage, instance=None):
    return dict(label=label, passed=passed, disc=disc,
                coverage=coverage, instance=instance)


def check_{{engine_label}}():
    """{{lem:engine}} — {{the proposed check from verification.md}}."""
    # --- special / limiting case: exact value at a boundary ---
    {{assert closed form at n=2 / z->0 matches a hand value}}
    # --- random instances over the stated domain ---
    fails = 0
    for _ in range(N_RANDOM):
        x = {{sample the domain}}
        if not ({{the claim holds to TOL}}):
            fails += 1
    # --- counterexample hunt: push toward the constraint boundary ---
    bad = None
    for _ in range(HUNT_BUDGET):
        x = {{draw near the boundary / adversarial region}}
        if {{the claim is violated}}:
            bad = x; break
    if bad is not None:
        return verdict("{{lem:engine}}", False, "c",
                       "hunt hit a violation", instance=bad)
    if fails == 0:
        return verdict("{{lem:engine}}", True, "v",
                       f"{N_RANDOM} random + clean hunt")
    return verdict("{{lem:engine}}", False, "h",
                   f"{fails}/{N_RANDOM} random failed")


# ... one check_<label>() per row in verification.md ...
# Structural / non-numeric claim with nothing to sample:
#   return verdict("{{label}}", None, "c", "not numerically checkable")


def main():
    checks = [check_{{engine_label}}, {{...}}]
    print(f"{'label':18} {'verdict':12} {'disc':5} coverage")
    for c in checks:
        r = c()
        v = {True: "PASS", False: "FAIL", None: "INCONCLUSIVE"}[r["passed"]]
        print(f"{r['label']:18} {v:12} [{r['disc']}]  {r['coverage']}")
        if r["instance"] is not None:
            print(f"    breaking instance: {r['instance']}")


if __name__ == "__main__":
    main()
```

# `temper-report.md` template

Use verbatim. Replace `{{placeholders}}`. One row per result, then the failure detail only for results that broke. Omit the breaking-instance block for results that passed — it is a slot to fill on failure, not a quota.

```markdown
# Temper report — {{working title}}

Harness: `proto/verify.py` · seed {{0}} · {{N_RANDOM}} random instances, {{HUNT_BUDGET}}-draw counterexample hunts.
temper (the numeric lane) updated the discs in the main file and `skeleton.tex` to the earned values below; the cover tally recomputed itself. The math was not edited, the tally was not hand-edited.

## Results

| Label | Disc before | Disc earned | Verdict | Coverage |
|-------|-------------|-------------|---------|----------|
| `lem:engine` | {{Heuristic}} | {{Verified}} | PASS | {{20000 random + clean hunt over [0,1]^2}} |
| `prop:main`  | {{Plausible}} | {{Conjectured}} | FAIL | {{counterexample at n=3}} |
| `cor:1`      | {{Conjectured}} | {{Plausible}} | PASS | {{limiting cases pass; partial coverage}} |

## Failures — diagnosis and suggested fixes

### `prop:main` — FAIL
- **Breaking instance:** {{parameter values}} (seed {{0}}); claimed {{X}}, actual {{Y}}.
- **Diagnosis:** violates {{the step in proofs.tex that fails — the inequality that flips / the limit that does not commute}}.
- **Suggested fixes** (temper suggests; forge applies):
  - {{add/strengthen Assumption N}} — {{consequence: rules out the breaking region but narrows scope}}.
  - {{restrict the domain to {{where the hunt stayed clean}}}} — {{consequence: weaker but earns Plausible}}.
  - {{weaken the strict inequality to weak}} — {{consequence: holds, but loses the strictness corollary uses}}.

## Confidence distribution

Before: {{discs by colour}} → After: {{discs by colour}}. {{count}} result(s) earned green.

**Next.** {{If any disc is still red/orange:}} re-run **forge** to apply a fix, or open the discuss-and-refine loop. Systematic "which assumption to relax" is the future **ledger**.
```

# Rules of thumb

- **Announce on launch, every run.** A skill the user cannot see fire goes unused — open with the 2–3 line announcement before anything else.
- **temper is the numeric lane.** forge already ran the symbolic pre-numeric checks; temper confirms by number — random instances, limiting cases by number, the counterexample hunt — and can push a disc to green by numeric confirmation.
- **Green is earned, never assigned.** A disc goes green only on broad numeric coverage plus a clean counterexample hunt (or a complete symbolic proof forge already shipped) — a confident result with no passing probe is orange at most.
- **A clean hunt is the strongest numeric evidence.** Limiting cases by number are necessary, not sufficient; actively searching for a violation and finding none is what moves a disc to green.
- **The breaking instance is the verdict.** Exact parameters and a reproducing seed beat any narrated explanation of why a result fails — and a numeric contradiction of a symbolic green is a real finding.
- **Diagnose, suggest, do not apply.** temper names the crack and the repair; forge or the discuss loop makes the change. The clean boundary is what lets the next reader trust the report.
- **A drop is information, not a failure of the skill.** Demoting a disc and documenting the instance is the honest outcome — a survived facade is worse than an earned red.
- **Lighter than forge.** One harness, the checks the contract names, parallelised only when results are many. The verdict does not need a gold-plated harness.
- **Flip the disc key, nothing else.** temper updates the disc on the environment and on the skeleton row; the statements, intuition, proofs, and the auto-computed cover tally stay exactly as forge left them.
- **Stop at the verdict.** forge makes the forgery, temper hardens what survives, the ledger relaxes assumptions. Crossing into the repair dilutes every stage.
