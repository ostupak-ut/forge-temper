import type { FastifyInstance } from 'fastify'
import { query, type Options } from '@anthropic-ai/claude-agent-sdk'
import { getCli, getKey } from '../persistence/settingsStore'

interface ChatMsg {
  role: string
  content: string
}

/** One-shot OpenRouter chat completion (non-streaming). */
async function openrouterComplete(opts: {
  system: string
  messages: ChatMsg[]
  model?: string
  signal: AbortSignal
}): Promise<string> {
  const apiKey = getKey('openrouter')
  if (!apiKey) throw new Error('No OpenRouter API key — set one in Settings.')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: opts.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'forge-temper',
    },
    body: JSON.stringify({
      model: opts.model || 'anthropic/claude-sonnet-4.5',
      messages: [{ role: 'system', content: opts.system }, ...opts.messages],
      stream: false,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 300)}`)
  }
  const d = await res.json()
  return d.choices?.[0]?.message?.content ?? ''
}

/** One-shot Claude Code completion via the agent SDK (no tools, plain text out). */
async function claudeComplete(opts: {
  system: string
  prompt: string
  model?: string
  signal: AbortSignal
}): Promise<string> {
  const ac = new AbortController()
  if (opts.signal.aborted) ac.abort()
  else opts.signal.addEventListener('abort', () => ac.abort())

  const options: Options = {
    abortController: ac,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    disallowedTools: ['Skill'],
    allowedTools: [],
    settingSources: ['user', 'project', 'local'],
    systemPrompt: { type: 'preset', preset: 'claude_code', append: opts.system },
    maxTurns: 2,
    ...(opts.model && opts.model !== 'inherit' ? { model: opts.model } : {}),
    ...(getCli('claude') ? { pathToClaudeCodeExecutable: getCli('claude') } : {}),
  }

  let text = ''
  for await (const msg of query({ prompt: opts.prompt, options })) {
    if (opts.signal.aborted) break
    if (msg.type === 'result') text = (msg as { result?: string }).result ?? ''
  }
  return text
}

export async function designRoutes(app: FastifyInstance) {
  app.post('/api/design', async (req, reply) => {
    const body = (req.body ?? {}) as { provider?: string; model?: string; system?: string; messages?: ChatMsg[] }
    const system = String(body.system ?? '')
    const messages = (Array.isArray(body.messages) ? body.messages : []).filter(
      (m) => m && typeof m.content === 'string' && m.content.trim(),
    )
    if (!messages.length) return reply.code(400).send({ ok: false, error: 'no messages' })

    // NOTE: don't abort on req.raw 'close' — it fires when the request body
    // finishes, not on client disconnect, and would kill the call instantly.
    const ac = new AbortController()

    try {
      let text: string
      if (body.provider === 'openrouter') {
        text = await openrouterComplete({ system, messages, model: body.model, signal: ac.signal })
      } else {
        const prompt =
          messages.map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`).join('\n\n') +
          '\n\nAssistant:'
        text = await claudeComplete({ system, prompt, model: body.model, signal: ac.signal })
      }
      return { ok: true, text }
    } catch (e) {
      return reply.code(500).send({ ok: false, error: String((e as Error)?.message ?? e) })
    }
  })
}
