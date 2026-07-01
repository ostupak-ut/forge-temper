import Fastify from 'fastify'
import cors from '@fastify/cors'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir } from 'node:fs/promises'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { HOST, PORT, getWorkspaceDir } from './config'
import { fsRoutes } from './api/fs'
import { flowRoutes } from './api/flows'
import { runRoutes } from './api/runs'
import { settingsRoutes } from './api/settings'
import { designRoutes } from './api/design'
import { keyPresence } from './persistence/settingsStore'
import { resolveCodexBin } from './run/codexRunner'

const pexec = promisify(execFile)

/** Best-effort: report the local Claude Code version so the UI can preflight. */
async function getClaudeVersion(): Promise<string | undefined> {
  try {
    const { stdout } = await pexec('claude', ['--version'], { timeout: 5000, shell: true })
    return stdout.trim()
  } catch {
    return undefined
  }
}

/** Whether the codex CLI is runnable (bundled in the IDE extension, CODEX_BIN, or PATH). */
async function getCodexAvailable(): Promise<boolean> {
  try {
    await pexec(resolveCodexBin(), ['--version'], { timeout: 20000 })
    return true
  } catch {
    return false
  }
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
// Built frontend to serve in the PACKAGED app: FT_DIST (Electron) or ../dist
// (repo). Guarded by existsSync below — in dev there is no dist/ (Vite serves).
const DIST = process.env.FT_DIST ?? path.resolve(HERE, '..', 'dist')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
}

/**
 * Build + start the Fastify app. Returns the bound address (so a free port,
 * FT_PORT=0, is discoverable) and a close handle. Reused by dev (auto-start
 * below) and the Electron main process.
 */
export async function startServer(): Promise<{ address: string; close: () => Promise<void> }> {
  const app = Fastify({ logger: { level: 'info' }, bodyLimit: 50 * 1024 * 1024 })
  await app.register(cors, { origin: true })

  // Accept raw binary uploads (File node "Choose file…").
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) =>
    done(null, body),
  )

  await mkdir(getWorkspaceDir(), { recursive: true })
  await app.register(fsRoutes)
  await app.register(flowRoutes)
  await app.register(runRoutes)
  await app.register(settingsRoutes)
  await app.register(designRoutes)

  app.get('/api/health', async () => {
    const claude = await getClaudeVersion()
    const [codex, keys] = [await getCodexAvailable(), keyPresence()]
    return {
      ok: true,
      service: 'forge-temper-server',
      workspace: getWorkspaceDir(),
      claude,
      providers: {
        'claude-code': !!claude,
        codex,
        'anthropic-harness': keys.anthropic,
        'openrouter-agent': keys.openrouter,
        openrouter: keys.openrouter,
        'openrouter-image': keys.openrouter,
        'openrouter-video': keys.openrouter,
      },
    }
  })

  // Serve the built SPA (packaged app only — dev has no dist/, so this is skipped
  // and Vite serves the frontend). Anything not matched by an /api route falls
  // through here: a real file if it exists, else index.html (SPA fallback).
  if (existsSync(DIST)) {
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== 'GET' || req.url.startsWith('/api')) {
        return reply.code(404).send({ error: 'not found' })
      }
      const rel = decodeURIComponent(req.url.split('?')[0])
      let fp = path.join(DIST, rel)
      if (!fp.startsWith(DIST) || !existsSync(fp) || statSync(fp).isDirectory()) {
        fp = path.join(DIST, 'index.html')
      }
      if (!existsSync(fp)) return reply.code(404).send({ error: 'frontend build missing' })
      reply.type(MIME[path.extname(fp).toLowerCase()] ?? 'application/octet-stream')
      return readFileSync(fp)
    })
  }

  const address = await app.listen({ port: PORT, host: HOST })
  app.log.info(`forge-temper server listening on ${address}`)
  return { address, close: () => app.close() }
}

// Auto-start when run directly (dev: `tsx server/index.ts`), NOT when imported
// by the Electron main process (which calls startServer() itself).
const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) {
  void startServer()
}
