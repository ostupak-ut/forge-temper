import { existsSync, readdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Bundled skills live in ./bundled/<name>/SKILL.md next to this file, so the app
// is SELF-CONTAINED and needs NO ~/.claude/skills install. Resolve the dir from
// this module's own URL (works under tsx without a build/dist step).
const BUNDLED_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bundled')
const USER_SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills')

// Precedence: PREFER the user's ~/.claude/skills (so the app taps skills you
// create or edit at home — incl. olehwrites and any new custom skill), and FALL
// BACK to the bundled forge/temper so it still works out of the box with no
// install. Set FORGE_TEMPER_PREFER_USER_SKILLS=0 to prefer bundled instead.
const PREFER_USER = process.env.FORGE_TEMPER_PREFER_USER_SKILLS !== '0'

// Only successful reads are cached — a missing skill is re-checked each call so a
// skill you create at home is picked up WITHOUT restarting the server.
const cache = new Map<string, string>()

/**
 * Read a skill's instructions (frontmatter stripped). We INJECT this as the
 * system prompt rather than invoking the Skill tool — headless `query()` hangs
 * on the Skill tool, and inlining means "skill = prompt + tools", so it works on
 * any agentic provider.
 *
 * Looks in bundled/<name>/SKILL.md first, then ~/.claude/skills/<name>/SKILL.md
 * (order flipped by FORGE_TEMPER_PREFER_USER_SKILLS=1). Returns null gracefully
 * when the skill is installed in neither place (e.g. olehwrites).
 */
export function loadSkillText(name: string): string | null {
  const cached = cache.get(name)
  if (cached !== undefined) return cached
  const bundled = path.join(BUNDLED_DIR, name, 'SKILL.md')
  const user = path.join(USER_SKILLS_DIR, name, 'SKILL.md')
  const candidates = PREFER_USER ? [user, bundled] : [bundled, user]
  const file = candidates.find(existsSync)
  if (!file) return null // not cached → re-checked once you create the skill
  const raw = readFileSync(file, 'utf8')
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
  cache.set(name, body)
  return body
}

/** Names of all available skills (your ~/.claude/skills first, then bundled), deduped. */
export function listSkills(): string[] {
  const names = new Set<string>()
  for (const dir of [USER_SKILLS_DIR, BUNDLED_DIR]) {
    try {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.isDirectory() && existsSync(path.join(dir, ent.name, 'SKILL.md'))) names.add(ent.name)
      }
    } catch {
      /* dir may not exist (e.g. no ~/.claude/skills) */
    }
  }
  return [...names].sort()
}

/** Compose a node's system prompt: skill instructions + the node's own append. */
export function composeSystemPrompt(skill: string | undefined, systemAppend: string | undefined): string {
  const parts: string[] = []
  const skillText = skill ? loadSkillText(skill) : null
  if (skillText) {
    parts.push(
      `You are operating with the "${skill}" skill. Follow its instructions exactly, working fully autonomously end-to-end (do not pause to ask the user to confirm — proceed).\n\n${skillText}`,
    )
  }
  if (systemAppend?.trim()) parts.push(systemAppend.trim())
  return parts.join('\n\n---\n\n')
}
