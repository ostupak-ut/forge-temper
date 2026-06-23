import type { FastifyInstance } from 'fastify'
import { spawn } from 'node:child_process'
import { query, type Options } from '@anthropic-ai/claude-agent-sdk'
import { getCli, getKey } from '../persistence/settingsStore'
import { resolveCodexBin } from '../run/codexRunner'

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
      // Default to a non-Claude model — for Claude, use the Claude Code provider.
      model: opts.model || 'openai/gpt-4o-mini',
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
    // One-shot text generation: DON'T load user/project settings — that starts
    // MCP servers + hooks (slow, and a hung MCP startup stalls the whole call).
    // A plain system prompt (no claude_code agent preset) + a single turn keeps
    // it fast and predictable.
    settingSources: [],
    systemPrompt: opts.system,
    maxTurns: 1,
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

/** One-shot Codex completion via `codex exec --json` (ChatGPT/Codex sub, no key). */
async function codexComplete(opts: {
  system: string
  prompt: string
  model?: string
  signal: AbortSignal
}): Promise<string> {
  const bin = resolveCodexBin()
  const args = ['exec', '--json', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox']
  if (opts.model && opts.model !== 'inherit') args.push('-m', opts.model)
  args.push(opts.system ? `${opts.system}\n\n${opts.prompt}` : opts.prompt)

  return await new Promise<string>((resolve, reject) => {
    // stdin 'ignore' → immediate EOF so codex doesn't block reading from a pipe.
    const child = spawn(bin, args, { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
    let last = ''
    let buf = ''
    let stderr = ''
    let failure = ''
    const onAbort = () => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* already gone */
      }
    }
    if (opts.signal.aborted) onAbort()
    else opts.signal.addEventListener('abort', onAbort)

    const handle = (line: string) => {
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
      const it = (ev.item ?? {}) as Record<string, unknown>
      if ((type === 'item.completed' || type === 'item.updated') && it.type === 'agent_message' && typeof it.text === 'string') {
        last = it.text
      } else if (type === 'agent_message') {
        const t = (legacy?.message ?? legacy?.text) as string | undefined
        if (t) last = t
      } else if (type === 'task_complete' && typeof legacy?.last_agent_message === 'string') {
        last = legacy.last_agent_message as string
      } else if (type === 'turn.failed') {
        failure ||= ((ev.error as { message?: string } | undefined)?.message) ?? 'turn failed'
      } else if (type === 'error') {
        failure ||= (ev.message as string) ?? 'codex error'
      }
    }

    child.stdout!.on('data', (b: Buffer) => {
      buf += b.toString('utf8')
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        handle(buf.slice(0, nl))
        buf = buf.slice(nl + 1)
      }
    })
    child.stderr!.on('data', (b: Buffer) => {
      if (stderr.length < 4000) stderr += b.toString('utf8')
    })
    child.on('error', (e) =>
      reject(new Error(`Codex CLI not runnable (${String((e as Error)?.message ?? e)}). Check Settings → CLI paths.`)),
    )
    child.on('close', () => {
      if (buf.trim()) handle(buf)
      opts.signal.removeEventListener('abort', onAbort)
      if (last.trim()) resolve(last)
      else reject(new Error(failure || stderr.slice(0, 300) || 'codex produced no output'))
    })
  })
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
    // A watchdog aborts a genuinely hung provider call so the request can't hang
    // forever (the UI also lets the user cancel).
    const ac = new AbortController()
    const TIMEOUT_MS = 5 * 60 * 1000
    let timedOut = false
    const watchdog = setTimeout(() => {
      timedOut = true
      ac.abort()
    }, TIMEOUT_MS)

    // Client disconnect (Cancel / New chat / closed panel) → abort the provider
    // call so its claude/codex subprocess is killed instead of orphaned. Guarded
    // by writableFinished so a normally-sent response doesn't trigger it.
    reply.raw.on('close', () => {
      if (!reply.raw.writableFinished) ac.abort()
    })

    try {
      let text: string
      if (body.provider === 'openrouter') {
        text = await openrouterComplete({ system, messages, model: body.model, signal: ac.signal })
      } else {
        const prompt =
          messages.map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`).join('\n\n') +
          '\n\nAssistant:'
        text =
          body.provider === 'codex'
            ? await codexComplete({ system, prompt, model: body.model, signal: ac.signal })
            : await claudeComplete({ system, prompt, model: body.model, signal: ac.signal })
      }
      return { ok: true, text }
    } catch (e) {
      const error = timedOut
        ? `Timed out after ${TIMEOUT_MS / 1000}s — the model took too long. Try a smaller request or a faster model (Sonnet/Haiku).`
        : String((e as Error)?.message ?? e)
      return reply.code(500).send({ ok: false, error })
    } finally {
      clearTimeout(watchdog)
    }
  })
}
