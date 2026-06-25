import Fastify from 'fastify'
import cors from '@fastify/cors'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir } from 'node:fs/promises'
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
    // Availability per provider id — the UI lists only providers that can run.
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

const address = await app.listen({ port: PORT, host: HOST })
app.log.info(`forge-temper server listening on ${address}`)
