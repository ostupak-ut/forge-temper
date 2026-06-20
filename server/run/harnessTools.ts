import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * The six agentic tools the in-app harness exposes (no CLI). Each carries a
 * JSON input_schema (Anthropic shape — the OpenRouter adapter re-wraps it). All
 * file/shell access is sandboxed to the node's working dir (cwd).
 */
export interface HarnessTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const HARNESS_TOOLS: HarnessTool[] = [
  {
    name: 'Read',
    description: 'Read a UTF-8 text file from the working directory. Returns the file contents.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the working directory (or absolute inside it).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'Write',
    description: 'Write (create or overwrite) a UTF-8 text file in the working directory.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the working directory.' },
        content: { type: 'string', description: 'Full file contents to write.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'Edit',
    description:
      'Replace an exact string in a file with a new string. old_string must occur exactly once unless replace_all is true.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the working directory.' },
        old_string: { type: 'string', description: 'Exact text to replace.' },
        new_string: { type: 'string', description: 'Replacement text.' },
        replace_all: { type: 'boolean', description: 'Replace every occurrence (default false).' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'Glob',
    description: 'List files in the working directory matching a glob-ish pattern (supports * and **).',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Pattern, e.g. "**/*.tex" or "proto/*.py".' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'Grep',
    description: 'Search file contents in the working directory for a regular expression. Returns matching lines.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'JavaScript regular expression.' },
        path: { type: 'string', description: 'Optional sub-path to limit the search.' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'Bash',
    description:
      'Run a shell command inside the working directory (latexmk, python, sympy, etc). Returns combined stdout+stderr. Credential paths (~/.ssh, ~/.aws, ~/.claude, …) are blocked.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute.' },
        timeout: { type: 'number', description: 'Timeout in ms (default 120000, max 600000).' },
      },
      required: ['command'],
    },
  },
]

const OUTPUT_CAP = 30_000
const BASH_DEFAULT_TIMEOUT = 120_000
const BASH_MAX_TIMEOUT = 600_000

/**
 * Bash env is built from an ALLOWLIST (not a denylist) so no secret-bearing var
 * a developer exports in their shell (API keys, tokens, DATABASE_URL, …) can
 * ever leak into a tool-run command. Only what latexmk/python actually need.
 */
const ENV_ALLOW = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'TMPDIR', 'TEXMFHOME', 'TEXMFVAR']

/**
 * Home-relative directories the sandboxed Bash must never read — credentials
 * that would otherwise be trivially exfiltrable via `cat ~/.claude/...`. Enforced
 * on macOS via sandbox-exec (allow-default + deny these subpaths), which keeps
 * the TeX/Python toolchain working while blocking secret theft.
 */
const SANDBOX_DENY_DIRS = ['.claude', '.ssh', '.aws', '.gnupg', '.config/gcloud', '.azure', '.kube', '.docker']
const SANDBOX_DENY_FILES = ['.netrc', '.npmrc', '.pypirc', '.git-credentials']
const SANDBOX_EXEC = '/usr/bin/sandbox-exec'

/** Build a sandbox-exec profile: allow everything, deny reads of credential paths. */
function sandboxProfile(home: string): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const subs = SANDBOX_DENY_DIRS.map((d) => `(subpath "${esc(path.join(home, d))}")`)
  const lits = SANDBOX_DENY_FILES.map((f) => `(literal "${esc(path.join(home, f))}")`)
  return `(version 1)\n(allow default)\n(deny file-read* ${[...subs, ...lits].join(' ')})\n(deny file-write* ${subs.join(' ')})`
}

/**
 * Resolve `p` against `cwd` and reject anything that escapes it. Uses
 * fs.realpathSync on the nearest existing ancestor so symlinks can't tunnel
 * out of the sandbox.
 */
function resolveInside(cwd: string, p: string): string {
  const cwdReal = realpathSync(cwd)
  const abs = path.resolve(cwdReal, p)
  // Walk up to the nearest existing ancestor and realpath THAT, then re-append
  // the not-yet-created tail. This catches symlinked parents on create paths.
  let existing = abs
  const tail: string[] = []
  while (!existsSync(existing)) {
    tail.unshift(path.basename(existing))
    const parent = path.dirname(existing)
    if (parent === existing) break
    existing = parent
  }
  const existingReal = realpathSync(existing)
  const resolved = tail.length ? path.join(existingReal, ...tail) : existingReal
  const withSep = cwdReal.endsWith(path.sep) ? cwdReal : cwdReal + path.sep
  if (resolved !== cwdReal && !resolved.startsWith(withSep)) {
    throw new Error(`path escapes the working directory: ${p}`)
  }
  return resolved
}

/** Compile a simple glob (supporting * and **) into a RegExp over a relative path. */
function globToRegExp(pattern: string): RegExp {
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*'
        i++
        if (pattern[i + 1] === '/') i++
      } else {
        re += '[^/]*'
      }
    } else if ('.+?^${}()|[]\\'.includes(c)) {
      re += '\\' + c
    } else {
      re += c
    }
  }
  return new RegExp('^' + re + '$')
}

/** Recursively list files under `dir`, returning paths relative to `root`. */
function walk(dir: string, root: string, acc: string[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, root, acc)
    else acc.push(path.relative(root, full).split(path.sep).join('/'))
  }
}

function cap(text: string): string {
  return text.length > OUTPUT_CAP ? text.slice(0, OUTPUT_CAP) + `\n…[truncated ${text.length - OUTPUT_CAP} chars]` : text
}

function runBash(command: string, cwd: string, timeoutMs: number, signal: AbortSignal): Promise<string> {
  return new Promise((resolve) => {
    // Env from an ALLOWLIST — no exported secret can leak to the command.
    const env: NodeJS.ProcessEnv = {}
    for (const k of ENV_ALLOW) if (process.env[k] != null) env[k] = process.env[k]

    // `bash -c` (NOT -lc): a login shell would source ~/.zprofile etc. and
    // re-introduce exported secrets, defeating the allowlist.
    const home = os.homedir()
    let cmd: string
    let argv: string[]
    if (process.platform === 'darwin' && existsSync(SANDBOX_EXEC)) {
      cmd = SANDBOX_EXEC
      argv = ['-p', sandboxProfile(home), 'bash', '-c', command]
    } else {
      cmd = 'bash'
      argv = ['-c', command]
    }

    // detached → child is its own process-group leader so we can kill the whole
    // tree (a grandchild python/latexmk) on timeout/abort, not just bash.
    const child = spawn(cmd, argv, { cwd, env, detached: true })
    let out = ''
    let killed = false
    const onData = (b: Buffer) => {
      if (out.length < OUTPUT_CAP) out += b.toString('utf8')
      if (out.length > OUTPUT_CAP) out = out.slice(0, OUTPUT_CAP) // hard ceiling
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)

    const killTree = () => {
      killed = true
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL')
      } catch {
        child.kill('SIGKILL')
      }
    }
    const timer = setTimeout(killTree, timeoutMs)
    const onAbort = () => killTree()
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort)

    child.on('error', (e) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve(cap(out + `\n[bash error: ${String((e as Error)?.message ?? e)}]`))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      const note = killed ? `\n[command killed${signal.aborted ? ' (aborted)' : ' (timeout)'}]` : `\n[exit code ${code}]`
      resolve(cap(out + note))
    })
  })
}

/**
 * Execute one tool call. Returns the textual tool result (errors are returned
 * as strings prefixed with "Error:" rather than thrown, so the agent can
 * recover). `signal` aborts in-flight Bash children.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  cwd: string,
  signal: AbortSignal,
): Promise<string> {
  try {
    switch (name) {
      case 'Read': {
        const fp = resolveInside(cwd, String(input.path ?? ''))
        return cap(readFileSync(fp, 'utf8'))
      }
      case 'Write': {
        const fp = resolveInside(cwd, String(input.path ?? ''))
        mkdirSync(path.dirname(fp), { recursive: true })
        writeFileSync(fp, String(input.content ?? ''), 'utf8')
        return `Wrote ${input.path}`
      }
      case 'Edit': {
        const fp = resolveInside(cwd, String(input.path ?? ''))
        const old = String(input.old_string ?? '')
        const next = String(input.new_string ?? '')
        const replaceAll = input.replace_all === true
        const before = readFileSync(fp, 'utf8')
        if (!old) return 'Error: old_string is empty'
        const count = before.split(old).length - 1
        if (count === 0) return `Error: old_string not found in ${input.path}`
        if (count > 1 && !replaceAll) return `Error: old_string occurs ${count} times; pass replace_all or make it unique`
        const after = replaceAll ? before.split(old).join(next) : before.replace(old, next)
        writeFileSync(fp, after, 'utf8')
        return `Edited ${input.path} (${replaceAll ? count : 1} replacement${(replaceAll ? count : 1) === 1 ? '' : 's'})`
      }
      case 'Glob': {
        const cwdReal = realpathSync(cwd)
        const re = globToRegExp(String(input.pattern ?? '*'))
        const all: string[] = []
        walk(cwdReal, cwdReal, all)
        const hits = all.filter((rel) => re.test(rel)).sort()
        return hits.length ? cap(hits.join('\n')) : 'No files matched.'
      }
      case 'Grep': {
        const cwdReal = realpathSync(cwd)
        let re: RegExp
        try {
          re = new RegExp(String(input.pattern ?? ''))
        } catch (e) {
          return `Error: invalid regex: ${String((e as Error)?.message ?? e)}`
        }
        const base = input.path ? resolveInside(cwd, String(input.path)) : cwdReal
        let files: string[] = []
        if (existsSync(base) && statSync(base).isFile()) {
          files = [base]
        } else {
          const rels: string[] = []
          walk(base, cwdReal, rels)
          files = rels.map((rel) => path.join(cwdReal, rel))
        }
        const lines: string[] = []
        for (const f of files) {
          let text: string
          try {
            text = readFileSync(f, 'utf8')
          } catch {
            continue
          }
          const rel = path.relative(cwdReal, f).split(path.sep).join('/')
          text.split('\n').forEach((line, i) => {
            if (re.test(line)) lines.push(`${rel}:${i + 1}: ${line}`)
          })
          if (lines.length > 500) return cap(lines.slice(0, 500).join('\n') + '\n…[more matches truncated]')
        }
        return lines.length ? cap(lines.join('\n')) : 'No matches.'
      }
      case 'Bash': {
        const cwdReal = realpathSync(cwd)
        let t = typeof input.timeout === 'number' ? input.timeout : BASH_DEFAULT_TIMEOUT
        if (t > BASH_MAX_TIMEOUT) t = BASH_MAX_TIMEOUT
        if (t <= 0) t = BASH_DEFAULT_TIMEOUT
        return await runBash(String(input.command ?? ''), cwdReal, t, signal)
      }
      default:
        return `Error: unknown tool ${name}`
    }
  } catch (e) {
    return `Error: ${String((e as Error)?.message ?? e)}`
  }
}
