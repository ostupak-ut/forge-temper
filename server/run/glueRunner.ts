import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { emitEvent } from './runEvents'
import { runStore } from '../persistence/runStore'

/**
 * The Glue node — DETERMINISTIC media stitching via local ffmpeg (no LLM, no
 * tokens). It reads every photo/video the scheduler staged into <cwd>/inputs/,
 * normalizes each to a common format (stills become N-second segments), and
 * concatenates them into ONE mp4 in <cwd> for a downstream Warehouse.
 *
 * Two-pass for robustness across clips from different models: re-encode each
 * input to a uniform seg_*.mp4 (same codec/res/fps + guaranteed audio track),
 * then concat-copy. Clip ORDER = sorted input file path (prefix 01_/02_ to
 * control it).
 */

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.avif'])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi'])

interface GlueNode {
  id: string
  data: { kind: string; label: string; config: Record<string, unknown> }
}

function numCfg(v: unknown, def: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : def
}
function strCfg(v: unknown, def: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : def
}

/** Run a binary, capturing output; SIGKILL on abort. */
function run(
  bin: string,
  args: string[],
  signal: AbortSignal,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const onAbort = () => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* already gone */
      }
    }
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort)
    child.stdout!.on('data', (b: Buffer) => {
      if (stdout.length < 10_000) stdout += b.toString('utf8')
    })
    child.stderr!.on('data', (b: Buffer) => {
      if (stderr.length < 20_000) stderr += b.toString('utf8')
    })
    child.on('error', (e) => {
      signal.removeEventListener('abort', onAbort)
      reject(e)
    })
    child.on('close', (code) => {
      signal.removeEventListener('abort', onAbort)
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}

/** Locate ffmpeg/ffprobe even when the server's PATH lacks Homebrew's bin dir. */
async function findBin(name: string, signal: AbortSignal): Promise<string | null> {
  const candidates = [name, `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, `/opt/local/bin/${name}`]
  for (const c of candidates) {
    try {
      const r = await run(c, ['-version'], signal)
      if (r.code === 0) return c
    } catch {
      /* not at this path */
    }
  }
  return null
}

/** Recursively gather media files under a dir, ordered by path (name). */
function collectMedia(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    let ents
    try {
      ents = readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (IMAGE_EXTS.has(path.extname(e.name).toLowerCase()) || VIDEO_EXTS.has(path.extname(e.name).toLowerCase()))
        out.push(p)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out.sort()
}

/** Does a media file carry an audio stream? (ffprobe; assume yes if unknown.) */
async function hasAudio(ffprobe: string | null, file: string, signal: AbortSignal): Promise<boolean> {
  if (!ffprobe) return true
  try {
    const r = await run(
      ffprobe,
      ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file],
      signal,
    )
    return r.stdout.trim().length > 0
  } catch {
    return true
  }
}

/** Probe a video's pixel dimensions (for auto target size). */
async function probeDims(
  ffprobe: string | null,
  file: string,
  signal: AbortSignal,
): Promise<{ w: number; h: number } | null> {
  if (!ffprobe) return null
  try {
    const r = await run(
      ffprobe,
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file],
      signal,
    )
    const m = /(\d+)x(\d+)/.exec(r.stdout.trim())
    return m ? { w: Number(m[1]), h: Number(m[2]) } : null
  } catch {
    return null
  }
}

export async function runGlue(
  node: GlueNode,
  cwd: string,
  runId: string,
  signal: AbortSignal,
): Promise<{ ok: boolean; result: string }> {
  const nodeId = node.id
  emitEvent(runId, { type: 'status', nodeId, status: 'running' })
  runStore.upsertNodeRun({ runId, nodeId, kind: node.data.kind, status: 'running' })

  const fail = (error: string): { ok: false; result: string } => {
    emitEvent(runId, { type: 'error', nodeId, error })
    emitEvent(runId, { type: 'status', nodeId, status: 'error' })
    runStore.upsertNodeRun({ runId, nodeId, status: 'error', error })
    return { ok: false, result: '' }
  }

  try {
    const ffmpeg = await findBin('ffmpeg', signal)
    if (!ffmpeg) return fail('ffmpeg is not installed — run `brew install ffmpeg`, then re-run this node.')
    const ffprobe = await findBin('ffprobe', signal)

    const media = collectMedia(path.join(cwd, 'inputs'))
    if (media.length === 0)
      return fail('No photos/videos found in inputs — wire File nodes or image/video generators into this Glue node.')

    const cfg = node.data.config ?? {}
    const fps = numCfg(cfg.fps, 30)
    const imgDur = numCfg(cfg.imageDuration, 3)
    const outName = strCfg(cfg.outputName, 'glued.mp4').replace(/[^\w.\- ]/g, '_')

    // Target canvas: explicit config, else the first video's size, else portrait.
    let W = numCfg(cfg.width, 0)
    let H = numCfg(cfg.height, 0)
    if (!W || !H) {
      const firstVideo = media.find((f) => VIDEO_EXTS.has(path.extname(f).toLowerCase()))
      const dims = firstVideo ? await probeDims(ffprobe, firstVideo, signal) : null
      if (dims) {
        W = dims.w
        H = dims.h
      } else {
        W = 1080
        H = 1920
      }
    }

    emitEvent(runId, { type: 'token', nodeId, text: `Gluing ${media.length} clip(s) → ${outName} (${W}x${H} @ ${fps}fps)` })

    const segDir = path.join(cwd, '.glue')
    rmSync(segDir, { recursive: true, force: true })
    mkdirSync(segDir, { recursive: true })
    const vf = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:-1:-1:color=black,setsar=1,fps=${fps},format=yuv420p`
    const SILENT = ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']
    const ENC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2']

    const segs: string[] = []
    for (let i = 0; i < media.length; i++) {
      const f = media[i]
      const isImg = IMAGE_EXTS.has(path.extname(f).toLowerCase())
      const seg = path.join(segDir, `seg_${String(i).padStart(3, '0')}.mp4`)
      emitEvent(runId, { type: 'tool', nodeId, tool: `normalize ${path.basename(f)}` })

      let args: string[]
      if (isImg) {
        // Still photo → imgDur-second clip with a silent track.
        args = ['-y', '-loop', '1', '-t', String(imgDur), '-i', f, ...SILENT, '-vf', vf, ...ENC, '-shortest', seg]
      } else if (await hasAudio(ffprobe, f, signal)) {
        args = ['-y', '-i', f, '-vf', vf, ...ENC, seg]
      } else {
        // Silent video → graft a silent track so every seg has uniform streams.
        args = ['-y', '-i', f, ...SILENT, '-vf', vf, ...ENC, '-map', '0:v:0', '-map', '1:a:0', '-shortest', seg]
      }
      const r = await run(ffmpeg, args, signal)
      if (signal.aborted) return fail('stopped')
      if (r.code !== 0 || !existsSync(seg))
        return fail(`ffmpeg failed normalizing ${path.basename(f)}: ${r.stderr.slice(-280).trim()}`)
      segs.push(seg)
    }

    // Concat the uniform segments losslessly (stream copy).
    const listFile = path.join(segDir, 'concat.txt')
    writeFileSync(listFile, segs.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'))
    const outPath = path.join(cwd, outName)
    const cat = await run(
      ffmpeg,
      ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', outPath],
      signal,
    )
    if (cat.code !== 0 || !existsSync(outPath))
      return fail(`ffmpeg concat failed: ${cat.stderr.slice(-280).trim()}`)

    rmSync(segDir, { recursive: true, force: true }) // keep cwd clean for the warehouse

    const result = `Glued ${media.length} clip${media.length > 1 ? 's' : ''} → ${outName} (${W}x${H} @ ${fps}fps)`
    emitEvent(runId, { type: 'result', nodeId, ok: true, result })
    emitEvent(runId, { type: 'status', nodeId, status: 'done' })
    runStore.upsertNodeRun({ runId, nodeId, status: 'done', result })
    return { ok: true, result }
  } catch (e) {
    return fail(String((e as Error)?.message ?? e))
  }
}
