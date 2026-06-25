import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { emitEvent } from './runEvents'
import { runStore } from '../persistence/runStore'
import { getKey } from '../persistence/settingsStore'
import type { ProviderRunParams, ProviderRunResult } from '../providers/types'

/**
 * OpenRouter media generation — one runner, two modes, one API key:
 *   - 'image' → SYNCHRONOUS. POST /chat/completions with modalities:['image','text'];
 *               the reply carries base64 data-URL images we decode and save.
 *   - 'video' → ASYNCHRONOUS job API. POST /videos → poll /videos/{id} until
 *               'completed' → download the MP4. Takes 30s–several minutes.
 * Both write the generated file(s) into the node's working dir so a downstream
 * Warehouse collects them from disk (the runner's text reply is just a summary).
 */

const CHAT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const VIDEO_ENDPOINT = 'https://openrouter.ai/api/v1/videos'
const POLL_MS = 8_000
// Premium video models (Sora 2 Pro, Veo 1080p, long durations) routinely render
// for many minutes — keep the safety cap generous so we don't time out a job
// that's still legitimately in progress (and that you're already paying for).
const MAX_WAIT_MS = 25 * 60_000

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

/** Sleep that rejects promptly when the run is aborted. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'))
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new Error('aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Decode a data: URL (or fetch an http URL) → bytes + file extension. */
async function fetchMedia(
  url: string,
  signal: AbortSignal,
  auth: Record<string, string>,
): Promise<{ buf: Buffer; ext: string }> {
  if (url.startsWith('data:')) {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url)
    if (!m) throw new Error('unparseable data URL')
    const mime = m[1]
    const ext = MIME_EXT[mime] ?? mime.split('/')[1] ?? 'bin'
    const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8')
    return { buf, ext }
  }
  // OpenRouter content URLs need the API key; pre-signed external/CDN URLs don't.
  const onOpenRouter = new URL(url).hostname.endsWith('openrouter.ai')
  const res = await fetch(url, { signal, ...(onOpenRouter ? { headers: auth } : {}) })
  if (!res.ok) throw new Error(`download ${res.status}`)
  const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  const ext = MIME_EXT[mime] ?? (path.extname(new URL(url).pathname).slice(1) || 'bin')
  return { buf: Buffer.from(await res.arrayBuffer()), ext }
}

/** Pull every image data-URL out of a chat-completions reply message. */
function imageUrlsFromMessage(msg: unknown): string[] {
  const m = (msg ?? {}) as { images?: Array<{ image_url?: { url?: string }; url?: string }> }
  const urls: string[] = []
  for (const img of m.images ?? []) {
    const u = img?.image_url?.url ?? img?.url
    if (typeof u === 'string') urls.push(u)
  }
  return urls
}

export async function runOpenrouterMedia(
  p: ProviderRunParams,
  mediaKind: 'image' | 'video',
): Promise<ProviderRunResult> {
  const { runId, nodeId } = p
  emitEvent(runId, { type: 'status', nodeId, status: 'running' })
  runStore.upsertNodeRun({ runId, nodeId, kind: p.kind, status: 'running' })

  const fail = (error: string): ProviderRunResult => {
    emitEvent(runId, { type: 'error', nodeId, error })
    emitEvent(runId, { type: 'status', nodeId, status: 'error' })
    runStore.upsertNodeRun({ runId, nodeId, status: 'error', error })
    return { ok: false, result: '' }
  }

  const apiKey = getKey('openrouter')
  if (!apiKey) return fail('No OpenRouter API key — set one in Settings.')
  if (!p.model || p.model === 'inherit')
    return fail(`Pick a specific OpenRouter ${mediaKind} model — there is no session default for generation.`)

  const cwd = p.cwd || '.'
  mkdirSync(cwd, { recursive: true })

  const ac = new AbortController()
  const onAbort = () => ac.abort()
  if (p.signal.aborted) ac.abort()
  else p.signal.addEventListener('abort', onAbort)

  const auth = { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': 'http://localhost:5173', 'X-Title': 'forge-temper' }
  const saved: string[] = []
  let costUsd: number | undefined

  try {
    if (mediaKind === 'image') {
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        signal: ac.signal,
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: p.model,
          messages: [{ role: 'user', content: p.prompt }],
          modalities: ['image', 'text'],
        }),
      })
      if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
      const j = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { cost?: number }
      }
      costUsd = j.usage?.cost
      const urls = imageUrlsFromMessage(j.choices?.[0]?.message)
      let i = 0
      for (const url of urls) {
        const { buf, ext } = await fetchMedia(url, ac.signal, auth)
        const file = `image-${stamp()}-${++i}.${ext}`
        writeFileSync(path.join(cwd, file), buf)
        saved.push(file)
        emitEvent(runId, { type: 'tool', nodeId, tool: `saved ${file}` })
      }
    } else {
      // VIDEO — async job. Submit, then poll the returned polling_url to completion.
      emitEvent(runId, { type: 'token', nodeId, text: 'Submitting video job…' })
      const submitRes = await fetch(VIDEO_ENDPOINT, {
        method: 'POST',
        signal: ac.signal,
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: p.model, prompt: p.prompt }),
      })
      if (!submitRes.ok)
        throw new Error(`OpenRouter ${submitRes.status}: ${(await submitRes.text().catch(() => '')).slice(0, 300)}`)
      const job = (await submitRes.json()) as { id?: string; polling_url?: string; status?: string }
      if (!job.id) throw new Error('video job had no id')
      // polling_url comes back ABSOLUTE from the live API ("https://openrouter.ai/…"),
      // but the docs show it relative — accept either without double-prefixing the host.
      const rawPoll = job.polling_url ?? `/api/v1/videos/${job.id}`
      const pollUrl = rawPoll.startsWith('http') ? rawPoll : `https://openrouter.ai${rawPoll}`

      let status = job.status ?? 'pending'
      let urls: string[] = []
      const started = Date.now()
      while (status === 'pending' || status === 'processing' || status === 'queued') {
        if (Date.now() - started > MAX_WAIT_MS) throw new Error('video generation timed out')
        await sleep(POLL_MS, ac.signal)
        const pr = await fetch(pollUrl, { signal: ac.signal, headers: auth })
        if (!pr.ok) throw new Error(`poll ${pr.status}`)
        const pj = (await pr.json()) as { status?: string; unsigned_urls?: string[]; usage?: { cost?: number } }
        status = pj.status ?? 'pending'
        if (pj.usage?.cost != null) costUsd = pj.usage.cost
        if (status === 'completed') urls = pj.unsigned_urls ?? []
        emitEvent(runId, { type: 'token', nodeId, text: `video ${status}…` })
      }
      if (status !== 'completed') throw new Error(`video ${status}`)
      let i = 0
      for (const url of urls) {
        const { buf, ext } = await fetchMedia(url, ac.signal, auth)
        const file = `video-${stamp()}-${++i}.${ext === 'bin' ? 'mp4' : ext}`
        writeFileSync(path.join(cwd, file), buf)
        saved.push(file)
        emitEvent(runId, { type: 'tool', nodeId, tool: `saved ${file}` })
      }
    }

    if (p.signal.aborted) {
      emitEvent(runId, { type: 'status', nodeId, status: 'error' })
      runStore.upsertNodeRun({ runId, nodeId, status: 'error', error: 'stopped', costUsd })
      return { ok: false, result: saved.join(', '), costUsd }
    }

    const ok = saved.length > 0
    const result = ok
      ? `Generated ${saved.length} ${mediaKind}${saved.length > 1 ? 's' : ''}: ${saved.join(', ')}`
      : `No ${mediaKind} returned by ${p.model}.`
    if (!ok) emitEvent(runId, { type: 'error', nodeId, error: result })
    emitEvent(runId, { type: 'result', nodeId, ok, result, costUsd })
    emitEvent(runId, { type: 'status', nodeId, status: ok ? 'done' : 'error' })
    runStore.upsertNodeRun({ runId, nodeId, status: ok ? 'done' : 'error', result, costUsd })
    return { ok, result, costUsd }
  } catch (e) {
    // Node wraps low-level network failures as a bare "fetch failed" — dig the
    // real reason out of .cause so the UI shows something actionable.
    const err = e as { message?: string; cause?: { code?: string; message?: string } }
    const cause = err?.cause ? ` (${err.cause.code ?? err.cause.message ?? ''})`.trimEnd() : ''
    return fail(`${err?.message ?? String(e)}${cause}`)
  } finally {
    p.signal.removeEventListener('abort', onAbort)
  }
}
