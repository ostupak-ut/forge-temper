import { emitEvent } from './runEvents'
import { runStore } from '../persistence/runStore'
import { getKey } from '../persistence/settingsStore'
import type { ProviderRunParams, ProviderRunResult } from '../providers/types'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

/** Run a node against an OpenRouter chat model, streaming tokens out. */
export async function runOpenRouter(p: ProviderRunParams): Promise<ProviderRunResult> {
  const { runId, nodeId } = p
  emitEvent(runId, { type: 'status', nodeId, status: 'running' })
  runStore.upsertNodeRun({ runId, nodeId, kind: p.kind, status: 'running' })

  const apiKey = getKey('openrouter')
  if (!apiKey) {
    const error = 'No OpenRouter API key — set one in Settings.'
    emitEvent(runId, { type: 'error', nodeId, error })
    emitEvent(runId, { type: 'status', nodeId, status: 'error' })
    runStore.upsertNodeRun({ runId, nodeId, status: 'error', error })
    return { ok: false, result: '' }
  }

  const messages: Array<{ role: string; content: string }> = []
  if (p.skillText) messages.push({ role: 'system', content: `Follow these instructions exactly:\n\n${p.skillText}` })
  if (p.systemAppend?.trim()) messages.push({ role: 'system', content: p.systemAppend })
  messages.push({ role: 'user', content: p.prompt })

  const ac = new AbortController()
  const onAbort = () => ac.abort()
  if (p.signal.aborted) ac.abort()
  else p.signal.addEventListener('abort', onAbort)

  let text = ''
  let costUsd: number | undefined
  let sessionId: string | undefined
  let finishReason: string | undefined
  let ok = false

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'forge-temper',
      },
      body: JSON.stringify({ model: p.model || 'openai/gpt-4o', messages, stream: true }),
    })
    sessionId = res.headers.get('x-generation-id') ?? undefined
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 300)}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line || line.startsWith(':')) continue // keepalive comment
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const chunk = JSON.parse(data)
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) {
            text += delta
            emitEvent(runId, { type: 'token', nodeId, text: delta })
          }
          if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason
          if (chunk.usage?.cost != null) costUsd = chunk.usage.cost
        } catch {
          /* skip malformed chunk */
        }
      }
    }

    ok = finishReason !== 'error'
    if (p.signal.aborted) {
      emitEvent(runId, { type: 'status', nodeId, status: 'error' })
      runStore.upsertNodeRun({ runId, nodeId, status: 'error', error: 'stopped', costUsd, sessionId })
      return { ok: false, result: text, costUsd, sessionId }
    }
    if (!ok) emitEvent(runId, { type: 'error', nodeId, error: `finish_reason: ${finishReason}` })

    emitEvent(runId, { type: 'result', nodeId, ok, result: text, costUsd, sessionId })
    emitEvent(runId, { type: 'status', nodeId, status: ok ? 'done' : 'error' })
    runStore.upsertNodeRun({ runId, nodeId, status: ok ? 'done' : 'error', result: text, costUsd, sessionId })
    return { ok, result: text, costUsd, sessionId }
  } catch (e) {
    const error = String((e as Error)?.message ?? e)
    emitEvent(runId, { type: 'error', nodeId, error })
    emitEvent(runId, { type: 'status', nodeId, status: 'error' })
    runStore.upsertNodeRun({ runId, nodeId, status: 'error', error })
    return { ok: false, result: text }
  } finally {
    p.signal.removeEventListener('abort', onAbort)
  }
}
