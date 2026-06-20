import Fastify from 'fastify'
import cors from '@fastify/cors'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir } from 'node:fs/promises'
import { HOST, PORT, WORKSPACE_DIR } from './config'
import { fsRoutes } from './api/fs'
import { flowRoutes } from './api/flows'
import { runRoutes } from './api/runs'
import { settingsRoutes } from './api/settings'
import { keyPresence } from './persistence/settingsStore'

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

const app = Fastify({ logger: { level: 'info' }, bodyLimit: 50 * 1024 * 1024 })
await app.register(cors, { origin: true })

// Accept raw binary uploads (File node "Choose file…").
app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) =>
  done(null, body),
)

await mkdir(WORKSPACE_DIR, { recursive: true })
await app.register(fsRoutes)
await app.register(flowRoutes)
await app.register(runRoutes)
await app.register(settingsRoutes)

app.get('/api/health', async () => {
  const claude = await getClaudeVersion()
  return {
    ok: true,
    service: 'forge-temper-server',
    workspace: WORKSPACE_DIR,
    claude,
    providers: { 'claude-code': !!claude, openrouter: keyPresence().openrouter },
  }
})

const address = await app.listen({ port: PORT, host: HOST })
app.log.info(`forge-temper server listening on ${address}`)
