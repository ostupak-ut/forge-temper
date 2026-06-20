# Bundled skills

These are **vendored copies** of the Claude Code skills the app injects as system
prompts (see `../skillLoader.ts`). They are committed so Forge-Temper is
**self-contained**: it runs with **no `~/.claude/skills` install**.

`skillLoader.loadSkillText(name)` prefers `bundled/<name>/SKILL.md`, then falls
back to `~/.claude/skills/<name>/SKILL.md`. Set
`FORGE_TEMPER_PREFER_USER_SKILLS=1` to flip that precedence while iterating on a
skill in `~/.claude/skills` (re-vendor here when done).

## Provenance

Vendored 2026-06-20 from `~/.claude/skills/`:

| skill  | version | files |
|--------|---------|-------|
| forge  | 0.1.0   | `SKILL.md`, `assets/{preamble,proofs,prototype,skeleton}.tex`, `assets/verification.md` |
| temper | 0.1.0   | `SKILL.md` |

`olehwrites` is intentionally **not** bundled (not installed upstream);
`loadSkillText('olehwrites')` returns `null` gracefully.

## Local edit (not a verbatim copy)

The forge **paper preamble** is pinned to a Libertine-text + newtx-math font
stack. These four lines were added to the font block in **both** the embedded
preamble inside `forge/SKILL.md` (the live path forge writes) **and**
`forge/assets/preamble.tex` (kept byte-identical):

```latex
\usepackage[T1]{fontenc}
\usepackage{textcomp}
\usepackage{libertine}
\usepackage[libertine]{newtxmath}
```

## Re-vendoring

When the upstream skills change, re-copy and re-apply the preamble pin:

```sh
BD=server/skills/bundled
cp ~/.claude/skills/forge/SKILL.md            "$BD/forge/SKILL.md"
cp ~/.claude/skills/forge/assets/*.tex        "$BD/forge/assets/"
cp ~/.claude/skills/forge/assets/*.md         "$BD/forge/assets/"
cp ~/.claude/skills/temper/SKILL.md           "$BD/temper/SKILL.md"
# then re-add the four font lines to the font block in BOTH
#   forge/SKILL.md (embedded preamble) and forge/assets/preamble.tex
```

Do **not** add credentials here — `.gitignore`'s secrets-guard block
(`**/.credentials.json`, `**/*.key`, `**/.env`) covers this tree but does not
ignore the tree itself.
