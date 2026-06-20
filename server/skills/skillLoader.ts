import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills')
const cache = new Map<string, string | null>()

/**
 * Read a skill's instructions from ~/.claude/skills/<name>/SKILL.md (frontmatter
 * stripped). We INJECT this as the system prompt rather than invoking the Skill
 * tool — headless `query()` hangs on the Skill tool, and inlining means "skill =
 * prompt + tools", so it works on any agentic provider.
 */
export function loadSkillText(name: string): string | null {
  if (cache.has(name)) return cache.get(name)!
  const file = path.join(SKILLS_DIR, name, 'SKILL.md')
  if (!existsSync(file)) {
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
