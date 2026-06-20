import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { emitEvent } from './runEvents'
import { runStore } from '../persistence/runStore'
import type { ProviderRunParams, ProviderRunResult } from '../providers/types'

/**
 * Codex provider: spawns the local OpenAI `codex` CLI in non-interactive mode
 * (`codex exec --json`) and maps its JSONL event stream to our RunEvents — the
 * Codex analogue of claudeRunner. Auth is the user's ChatGPT/Codex subscription
 * (via `codex login`), so no API key is needed.
 *
 * Skills arrive the same way as for Claude Code: runOneNode writes a
 * `.skill-<name>.md` into the cwd and prepends a "read this file" instruction,
 * and Codex's own file tools consume it. Runs fully autonomously (approvals +
 * sandbox bypassed) to mirror the headless Claude Code posture.
 *
 * Event schema (modern `codex exec --json`):
 *   {"type":"thread.started","thread_id":"…"}
 *   {"type":"item.started"|"item.completed","item":{"type":"command_execution","command":"bash -lc …",…}}
 *   {"type":"item.completed","item":{"type":"agent_message","text":"…"}}
 *   {"type":"turn.completed"|"turn.failed",…} / {"type":"error","message":"…"}
 * A legacy `{"id":…,"msg":{"type":…}}` envelope is also tolerated.
 */

const CODEX_BIN = process.env.CODEX_BIN || 'codex'

function shortCmd(cmd: unknown): string {
  const s = Array.isArray(cmd) ? cmd.join(' ') : String(cmd ?? '')
  return s.replace(/^bash -lc\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 44) || 'Bash'
}

export async function runCodexNode(p: ProviderRunParams): Promise<ProviderRunResult> {
  const { runId, nodeId } = p
  emitEvent(runId, { type: 'status', nodeId, status: 'running' })
  runStore.upsertNodeRun({ runId, nodeId, kind: p.kind, status: 'running' })

  const args = ['exec', '--json', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox']
  if (p.model && p.model !== 'inherit') args.push('-m', p.model)
  const prompt = p.systemAppend ? `${p.systemAppend}\n\n${p.prompt}` : p.prompt
  args.push(prompt)

  return await new Promise<ProviderRunResult>((resolve) => {
    let child: ChildProcessWithoutNullStreams
    try {
      child = spawn(CODEX_BIN, args, { cwd: p.cwd ?? process.cwd(), env: process.env })
    } catch (e) {
      return resolve(fail(`Codex CLI unavailable (${String((e as Error)?.message ?? e)}). Install: npm i -g @openai/codex && codex login.`))
    }

    let lastText = ''
    let sessionId: string | undefined
    let turnOk = false
    let failure = ''
    let buf = ''
    let stderr = ''

    function fail(error: string): ProviderRunResult {
      emitEvent(runId, { type: 'error', nodeId, error })
      emitEvent(runId, { type: 'status', nodeId, status: 'error' })
      runStore.upsertNodeRun({ runId, nodeId, status: 'error', error })
      return { ok: false, result: '' }
    }

    const onAbort = () => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* already gone */
      }
    }
    if (p.signal.aborted) onAbort()
    else p.signal.addEventListener('abort', onAbort)

    const handleLine = (line: string) => {
      const s = line.trim()
      if (!s) return
      let ev: Record<string, unknown>
      try {
        ev = JSON.parse(s)
      } catch {
        return // non-JSON noise
      }
      const type = (ev.type ?? (ev.msg as { type?: string } | undefined)?.type) as string | undefined
      const legacy = ev.msg as Record<string, unknown> | undefined

      if (ev.type === 'thread.started' && typeof ev.thread_id === 'string') sessionId = ev.thread_id
      if (legacy?.type === 'session_configured' && typeof legacy.session_id === 'string') sessionId = legacy.session_id as string

      if (type === 'item.started' || type === 'item.updated' || type === 'item.completed') {
        const it = (ev.item ?? {}) as Record<string, unknown>
        if (it.type === 'agent_message' && typeof it.text === 'string') {
          lastText = it.text
          if (type === 'item.completed') emitEvent(runId, { type: 'token', nodeId, text: it.text })
        } else if (it.type === 'command_execution' && type === 'item.started') {
          emitEvent(runId, { type: 'tool', nodeId, tool: shortCmd(it.command) })
        } else if (it.type === 'mcp_tool_call' && type === 'item.started') {
          emitEvent(runId, { type: 'tool', nodeId, tool: String(it.tool ?? it.server ?? 'mcp') })
        } else if (it.type === 'error' && typeof it.message === 'string') {
          failure ||= it.message
        }
      } else if (type === 'agent_message') {
        const txt = (legacy?.message ?? legacy?.text) as string | undefined
        if (txt) {
          lastText = txt
          emitEvent(runId, { type: 'token', nodeId, text: txt })
        }
      } else if (type === 'exec_command_begin' && legacy?.command) {
        emitEvent(runId, { type: 'tool', nodeId, tool: shortCmd(legacy.command) })
      } else if (type === 'turn.completed') {
        turnOk = true
      } else if (type === 'turn.failed') {
        failure ||= ((ev.error as { message?: string } | undefined)?.message) ?? 'turn failed'
      } else if (type === 'error') {
        failure ||= (ev.message as string) ?? 'codex error'
      } else if (type === 'task_complete') {
        turnOk = true
        const m = legacy?.last_agent_message
        if (typeof m === 'string') lastText = m
      }
    }

    child.stdout.on('data', (b: Buffer) => {
      buf += b.toString('utf8')
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        handleLine(buf.slice(0, nl))
        buf = buf.slice(nl + 1)
      }
    })
    child.stderr.on('data', (b: Buffer) => {
      if (stderr.length < 4000) stderr += b.toString('utf8')
    })

    child.on('error', (e) => {
      p.signal.removeEventListener('abort', onAbort)
      resolve(fail(`Codex CLI not found on PATH (${String((e as Error)?.message ?? e)}). Install: npm i -g @openai/codex && codex login.`))
    })

    child.on('close', (code) => {
      if (buf.trim()) handleLine(buf)
      p.signal.removeEventListener('abort', onAbort)

      if (p.signal.aborted) {
        emitEvent(runId, { type: 'status', nodeId, status: 'error' })
        runStore.upsertNodeRun({ runId, nodeId, status: 'error', error: 'stopped', sessionId })
        return resolve({ ok: false, result: lastText, sessionId })
      }

      const success = turnOk && !failure && code === 0
      const error = failure || (code !== 0 ? `codex exited ${code}${stderr ? `: ${stderr.slice(0, 300)}` : ''}` : '')
      if (!success && error) emitEvent(runId, { type: 'error', nodeId, error })
      emitEvent(runId, { type: 'result', nodeId, ok: success, result: lastText, sessionId })
      emitEvent(runId, { type: 'status', nodeId, status: success ? 'done' : 'error' })
      runStore.upsertNodeRun({
        runId,
        nodeId,
        status: success ? 'done' : 'error',
        result: lastText,
        sessionId,
        ...(error ? { error } : {}),
      })
      resolve({ ok: success, result: lastText, sessionId })
    })
  })
}
