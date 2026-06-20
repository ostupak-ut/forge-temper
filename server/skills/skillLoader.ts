import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Bundled skills live in ./bundled/<name>/SKILL.md next to this file, so the app
// is SELF-CONTAINED and needs NO ~/.claude/skills install. Resolve the dir from
// this module's own URL (works under tsx without a build/dist step).
const BUNDLED_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bundled')
const USER_SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills')

// Precedence: PREFER bundled, FALL BACK to the user's ~/.claude/skills. Set
// FORGE_TEMPER_PREFER_USER_SKILLS=1 to flip it (handy when iterating on a skill
// in ~/.claude/skills without re-vendoring into bundled/).
const PREFER_USER = process.env.FORGE_TEMPER_PREFER_USER_SKILLS === '1'

const cache = new Map<string, string | null>()

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
  if (cache.has(name)) return cache.get(name)!
  const bundled = path.join(BUNDLED_DIR, name, 'SKILL.md')
  const user = path.join(USER_SKILLS_DIR, name, 'SKILL.md')
  const candidates = PREFER_USER ? [user, bundled] : [bundled, user]
  const file = candidates.find(existsSync)
  if (!file) {
    cache.set(name, null)
    return null
  }
  const raw = readFileSync(file, 'utf8')
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
  cache.set(name, body)
  return body
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
