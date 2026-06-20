# Verification handoff (temper template)

Handoff from **forge** (build) to **temper** (verify). One row per result.
Disc legend: `v` verified (green) · `p` plausible (blue) · `h` heuristic (orange) · `c` conjectured (red).

**Word↔letter mapping (single source of truth).** The "Current disc" column below
uses the FULL WORD; the `\disc{...}` macro and the `[v|p|h|c]` environment argument
in `prototype.tex` / `skeleton.tex` use the LETTER. They map one-to-one:
**Verified = v · Plausible = p · Heuristic = h · Conjectured = c.**

For each result, propose at least one cheap check before a full proof pass:
- **special case** — collapse parameters to a tractable limit and confirm the claim holds.
- **numeric probe** — evaluate / simulate on sampled parameters and check the inequality or identity.
- **counterexample** — actively search for a violating instance; if none after honest effort, raise the disc.

| Label | Result | Current disc | Proposed check | Type | Outcome / new disc |
|-------|--------|--------------|----------------|------|--------------------|
| `ass:reg` | Assumption (regularity) | Verified | n/a (definitional) | — | |
| `lem:monotone` | Lemma (best response increasing) | Verified | sign of `b'(x)=g'(x)/u''(b(x))` under sampled concave `u` | numeric probe | |
| `prop:unique` | Proposition (unique interior optimum) | Plausible | quadratic `u`, uniform `f` -> closed-form `x*`; confirm interior + unique | special case | |
| `prop:unique` | Proposition (unique interior optimum) | Plausible | search for a density with `f->0` at an endpoint forcing a corner solution | counterexample | |
| `thm:welfare` | Theorem (constrained efficiency) | Heuristic | two-agent grid; compare `E[u(X)]` at `x*` vs. perturbations | numeric probe | |
| `thm:welfare` | Theorem (constrained efficiency) | Heuristic | planner Lagrangian multiplier match in the quadratic special case | special case | |

## Notes
- Promote a disc only after the check passes: `c -> h -> p -> v`. Demote on a failed check and log the failing instance.
- Heuristic (`h`) rows are the priority: `thm:welfare` rests on a multiplier-matching argument that has only been sketched.
- Record the exact parameters / seed used for any numeric probe so it is reproducible.
