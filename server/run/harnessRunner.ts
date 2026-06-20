import Anthropic from '@anthropic-ai/sdk'
import { emitEvent } from './runEvents'
import { runStore } from '../persistence/runStore'
import { getKey } from '../persistence/settingsStore'
import { executeTool, HARNESS_TOOLS } from './harnessTools'
import type { ProviderRunParams, ProviderRunResult } from '../providers/types'

/**
 * The in-app agent harness: a hand-rolled agentic tool-use loop that runs
 * forge/temper/custom nodes against a plain API key — no CLI, no local agent
 * SDK. Two transports share one loop shape:
 *   - vendor 'anthropic'  → Anthropic Messages API (tool_use blocks)
 *   - vendor 'openrouter' → OpenAI-style chat-completions tool calling
 *
 * Tokens are emitted PER TURN (one 'token' per assistant text block), never
 * per token-delta, and a 'tool' event fires per tool_use — mirroring
 * claudeRunner so the SSE shapes are identical.
 */

const MAX_TURNS_DEFAULT = 60
const MAX_TOKENS = 16_000
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

/** Map model aliases to concrete ids; 'inherit'/empty → default Opus. */
function resolveAnthropicModel(model?: string): string {
  if (!model || model === 'inherit') return 'claude-opus-4-8'
  return model
}

/** Rough cost estimate from token usage (USD per 1M tokens, Opus-tier). */
function estimateCost(model: string, inputTokens: number, outputTokens: number): number | undefined {
  if (!inputTokens && !outputTokens) return undefined
  let inRate = 5
  let outRate = 25
  if (model.includes('sonnet')) {
    inRate = 3
    outRate = 15
  } else if (model.includes('haiku')) {
    inRate = 1
    outRate = 5
  }
  return (inputTokens * inRate + outputTokens * outRate) / 1_000_000
}

function buildSystem(p: ProviderRunParams): string | undefined {
  const base =
    'You are an autonomous agent with file and shell tools (Read, Write, Edit, Glob, Grep, Bash), all sandboxed to your working directory. Work fully end-to-end without pausing to ask for confirmation. Use Bash for builds (latexmk), numeric checks (python/sympy), and file inspection.'
  return p.systemAppend ? `${base}\n\n${p.systemAppend}` : base
}

function toolsForParams(p: ProviderRunParams) {
  if (!p.allowedTools?.length) return HARNESS_TOOLS
  const allow = new Set(p.allowedTools)
  return HARNESS_TOOLS.filter((t) => allow.has(t.name))
}

export async function runHarness(
  p: ProviderRunParams & { vendor: 'anthropic' | 'openrouter' },
): Promise<ProviderRunResult> {
  const { runId, nodeId, vendor } = p
  emitEvent(runId, { type: 'status', nodeId, status: 'running' })
  runStore.upsertNodeRun({ runId, nodeId, kind: p.kind, status: 'running' })

  const keyName = vendor === 'anthropic' ? 'anthropic' : 'openrouter'
  const apiKey = getKey(keyName) || (vendor === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENROUTER_API_KEY)
  if (!apiKey) {
    const error = `No ${vendor === 'anthropic' ? 'Anthropic' : 'OpenRouter'} API key — set one in Settings.`
    emitEvent(runId, { type: 'error', nodeId, error })
    emitEvent(runId, { type: 'status', nodeId, status: 'error' })
    runStore.upsertNodeRun({ runId, nodeId, status: 'error', error })
    return { ok: false, result: '' }
  }

  try {
    const result =
      vendor === 'anthropic'
        ? await runAnthropicLoop(p, apiKey)
        : await runOpenRouterLoop(p, apiKey)

    if (p.signal.aborted) {
      emitEvent(runId, { type: 'status', nodeId, status: 'error' })
      runStore.upsertNodeRun({ runId, nodeId, status: 'error', error: 'stopped', costUsd: result.costUsd })
      return { ok: false, result: result.result, costUsd: result.costUsd }
    }

    emitEvent(runId, { type: 'result', nodeId, ok: result.ok, result: result.result, costUsd: result.costUsd })
    emitEvent(runId, { type: 'status', nodeId, status: result.ok ? 'done' : 'error' })
    runStore.upsertNodeRun({
      runId,
      nodeId,
      status: result.ok ? 'done' : 'error',
      result: result.result,
      costUsd: result.costUsd,
    })
    return result
  } catch (e) {
    const error = String((e as Error)?.message ?? e)
    emitEvent(runId, { type: 'error', nodeId, error })
    emitEvent(runId, { type: 'status', nodeId, status: 'error' })
    runStore.upsertNodeRun({ runId, nodeId, status: 'error', error })
    return { ok: false, result: '' }
  }
}

// ---------------------------------------------------------------------------
// Anthropic Messages API transport
// ---------------------------------------------------------------------------

async function runAnthropicLoop(p: ProviderRunParams, apiKey: string): Promise<ProviderRunResult> {
  const { runId, nodeId } = p
  const client = new Anthropic({ apiKey })
  const model = resolveAnthropicModel(p.model)
  const system = buildSystem(p)
  const tools = toolsForParams(p).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Messages.Tool.InputSchema,
  }))
  const maxTurns = p.maxTurns ?? MAX_TURNS_DEFAULT

  const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: p.prompt }]

  let lastText = ''
  let inputTokens = 0
  let outputTokens = 0
  let ok = false

  for (let turn = 0; turn < maxTurns; turn++) {
    if (p.signal.aborted) break

    const response = await client.messages.create(
      {
        model,
        max_tokens: MAX_TOKENS,
        ...(system ? { system } : {}),
        ...(tools.length ? { tools } : {}),
        messages,
      },
      { signal: p.signal },
    )

    inputTokens += response.usage?.input_tokens ?? 0
    outputTokens += response.usage?.output_tokens ?? 0

    const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        lastText = block.text
        emitEvent(runId, { type: 'token', nodeId, text: block.text })
      } else if (block.type === 'tool_use') {
        emitEvent(runId, { type: 'tool', nodeId, tool: block.name })
        toolUses.push({ id: block.id, name: block.name, input: (block.input ?? {}) as Record<string, unknown> })
      }
    }

    // Append the assistant message verbatim (preserves block ordering/ids).
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      // max_tokens = truncated mid-output → NOT a success (a downstream node
      // would otherwise consume a cut-off artifact as if complete).
      if (response.stop_reason === 'max_tokens') {
        emitEvent(runId, { type: 'error', nodeId, error: 'output truncated at max_tokens' })
      }
      ok = response.stop_reason === 'end_turn'
      break
    }

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      if (p.signal.aborted) break
      const out = await executeTool(tu.name, tu.input, p.cwd ?? process.cwd(), p.signal)
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: out })
    }
    // On abort mid-execution some tool_use ids would be unpaired — don't send a
    // malformed message; the top-of-loop guard will exit cleanly.
    if (p.signal.aborted) break
    messages.push({ role: 'user', content: toolResults })
  }

  return { ok, result: lastText, costUsd: estimateCost(model, inputTokens, outputTokens) }
}

// ---------------------------------------------------------------------------
// OpenRouter (OpenAI-style chat-completions) transport
// ---------------------------------------------------------------------------

interface ORToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}
interface ORMessage {
  role: string
  content: string | null
  tool_calls?: ORToolCall[]
  tool_call_id?: string
  name?: string
}

async function runOpenRouterLoop(p: ProviderRunParams, apiKey: string): Promise<ProviderRunResult> {
  const { runId, nodeId } = p
  const model = p.model && p.model !== 'inherit' ? p.model : 'anthropic/claude-opus-4'
  const system = buildSystem(p)
  const tools = toolsForParams(p).map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }))
  const maxTurns = p.maxTurns ?? MAX_TURNS_DEFAULT

  const messages: ORMessage[] = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: p.prompt })

  let lastText = ''
  let costUsd: number | undefined
  let ok = false

  for (let turn = 0; turn < maxTurns; turn++) {
    if (p.signal.aborted) break

    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      signal: p.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'forge-temper',
      },
      body: JSON.stringify({ model, messages, ...(tools.length ? { tools } : {}), usage: { include: true } }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 300)}`)
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: ORMessage; finish_reason?: string }>
      usage?: { cost?: number }
    }
    if (data.usage?.cost != null) costUsd = (costUsd ?? 0) + data.usage.cost

    const choice = data.choices?.[0]
    const msg = choice?.message
    if (!msg) {
      ok = false
      break
    }

    if (msg.content) {
      lastText = msg.content
      emitEvent(runId, { type: 'token', nodeId, text: msg.content })
    }

    // Append assistant message verbatim (including any tool_calls).
    messages.push({ role: 'assistant', content: msg.content ?? null, ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) })

    // Drive the loop on the PRESENCE of tool calls, not finish_reason — many
    // OpenAI-compatible backends emit tool_calls with finish_reason 'stop'/null,
    // which would otherwise strand the calls unanswered and stall the agent.
    const calls = msg.tool_calls ?? []
    if (calls.length === 0) {
      ok = choice?.finish_reason !== 'error'
      break
    }

    for (const call of calls) {
      if (p.signal.aborted) break
      emitEvent(runId, { type: 'tool', nodeId, tool: call.function.name })
      let parsed: Record<string, unknown> = {}
      try {
        parsed = call.function.arguments ? JSON.parse(call.function.arguments) : {}
      } catch {
        /* leave empty — tool will report the missing args */
      }
      const out = await executeTool(call.function.name, parsed, p.cwd ?? process.cwd(), p.signal)
      messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: out })
    }
  }

  return { ok, result: lastText, costUsd }
}
