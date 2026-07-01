import { query, type Options } from '@anthropic-ai/claude-agent-sdk'
import { emitEvent } from './runEvents'
import { runStore } from '../persistence/runStore'
import { getClaudeExec } from '../persistence/settingsStore'
import type { ProviderRunParams, ProviderRunResult } from '../providers/types'

/** Execute a single node by invoking local Claude Code, streaming events out. */
export async function runNode(p: ProviderRunParams): Promise<ProviderRunResult> {
  const { runId, nodeId } = p
  emitEvent(runId, { type: 'status', nodeId, status: 'running' })
  runStore.upsertNodeRun({ runId, nodeId, kind: p.kind, status: 'running' })

  const ac = new AbortController()
  const onAbort = () => ac.abort()
  if (p.signal.aborted) ac.abort()
  else p.signal.addEventListener('abort', onAbort)

  const options: Options = {
    abortController: ac,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    // NOTE: partial-message (token) streaming floods subprocess stdout and
    // deadlocks the Windows pipe during long tool loops — emit per-turn instead.
    settingSources: ['user', 'project', 'local'],
    // The Skill tool hangs in headless query(); we inject skill text as the
    // system prompt instead, so forbid the tool entirely.
    disallowedTools: ['Skill'],
    systemPrompt: { type: 'preset', preset: 'claude_code', ...(p.systemAppend ? { append: p.systemAppend } : {}) },
    maxTurns: p.maxTurns ?? 60,
    ...(p.cwd ? { cwd: p.cwd } : {}),
    ...(p.model && p.model !== 'inherit' ? { model: p.model } : {}),
    ...(p.allowedTools?.length ? { allowedTools: p.allowedTools } : {}),
    // Reasoning effort (low|medium|high|xhigh|max) — the SDK silently downgrades
    // for models that don't support a given level.
    ...(p.effort && ['low', 'medium', 'high', 'xhigh', 'max'].includes(p.effort)
      ? { effort: p.effort as 'low' | 'medium' | 'high' | 'xhigh' | 'max' }
      : {}),
    // Settings → CLI paths (or FT_CLAUDE_BIN in the portable build): override
    // the claude binary the SDK spawns.
    ...(getClaudeExec() ? { pathToClaudeCodeExecutable: getClaudeExec() } : {}),
  }

  let resultText = ''
  let sessionId: string | undefined
  let costUsd: number | undefined
  let structured: unknown
  let ok = false

  try {
    for await (const msg of query({ prompt: p.prompt, options })) {
      if (p.signal.aborted) break
      if (msg.type === 'assistant') {
        const blocks = (msg.message?.content ?? []) as Array<{ type: string; name?: string; text?: string }>
        for (const b of blocks) {
          if (b.type === 'text' && b.text) emitEvent(runId, { type: 'token', nodeId, text: b.text })
          else if (b.type === 'tool_use' && b.name) emitEvent(runId, { type: 'tool', nodeId, tool: b.name })
        }
      } else if (msg.type === 'result') {
        ok = msg.subtype === 'success'
        const r = msg as { result?: string; total_cost_usd?: number; session_id?: string; structured_output?: unknown }
        resultText = r.result ?? ''
        costUsd = r.total_cost_usd
        sessionId = r.session_id
        structured = r.structured_output
        if (!ok) emitEvent(runId, { type: 'error', nodeId, error: msg.subtype })
      }
    }

    if (p.signal.aborted) {
      emitEvent(runId, { type: 'status', nodeId, status: 'error' })
      runStore.upsertNodeRun({ runId, nodeId, status: 'error', error: 'stopped', sessionId, costUsd })
      return { ok: false, result: resultText, sessionId, costUsd, structured }
    }

    emitEvent(runId, { type: 'result', nodeId, ok, result: resultText, costUsd, sessionId })
    emitEvent(runId, { type: 'status', nodeId, status: ok ? 'done' : 'error' })
    runStore.upsertNodeRun({
      runId,
      nodeId,
      status: ok ? 'done' : 'error',
      sessionId,
      costUsd,
      result: resultText,
      structured,
    })
    return { ok, result: resultText, sessionId, costUsd, structured }
  } catch (e) {
    const error = String((e as Error)?.message ?? e)
    emitEvent(runId, { type: 'error', nodeId, error })
    emitEvent(runId, { type: 'status', nodeId, status: 'error' })
    runStore.upsertNodeRun({ runId, nodeId, status: 'error', error })
    return { ok: false, result: resultText, sessionId, costUsd }
  } finally {
    p.signal.removeEventListener('abort', onAbort)
  }
}
