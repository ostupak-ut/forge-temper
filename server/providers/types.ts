/** Provider-agnostic params for running one node. */
export interface ProviderRunParams {
  runId: string
  nodeId: string
  kind: string
  prompt: string
  systemAppend?: string
  model?: string
  cwd?: string
  allowedTools?: string[]
  /** Skill instructions for CHAT providers to inline as a system message (agents read a file instead). */
  skillText?: string
  maxTurns?: number
  /** Reasoning effort hint (low|medium|high), forwarded from the node config. */
  effort?: string
  /** Resume a prior agent session so context compounds across loop iterations. */
  resumeSessionId?: string
  signal: AbortSignal
}

export interface ProviderRunResult {
  ok: boolean
  result: string
  sessionId?: string
  costUsd?: number
  structured?: unknown
}

/**
 * A model/agent backend. `agent` providers run an agentic loop with tools and
 * can load Claude Code skills; `chat` providers are single-shot text models.
 * Each provider emits SSE events itself (via emitEvent(runId, …)).
 */
export interface Provider {
  id: string
  label: string
  kind: 'agent' | 'chat'
  supportsSkills: boolean
  run(params: ProviderRunParams): Promise<ProviderRunResult>
}
