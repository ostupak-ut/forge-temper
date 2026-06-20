import type { FastifyInstance } from 'fastify'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { WORKSPACE_DIR } from '../config'

/** Resolve a workspace-relative path, refusing anything that escapes the root. */
function safeResolve(rel: string): string | null {
  const root = path.resolve(WORKSPACE_DIR)
  const target = path.resolve(root, rel || '.')
  if (target !== root && !target.startsWith(root + path.sep)) return null
  return target
}

const CONTENT_TYPE: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.tex': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.bib': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

export interface FsEntry {
  name: string
  dir: boolean
  rel: string
  size: number
}

export async function fsRoutes(app: FastifyInstance) {
  app.get('/api/fs/list', async (req, reply) => {
    const rel = String((req.query as { path?: string }).path ?? '')
    const dir = safeResolve(rel)
    if (!dir) return reply.code(400).send({ error: 'path outside workspace' })
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      const items: FsEntry[] = await Promise.all(
        entries.map(async (e) => {
          const full = path.join(dir, e.name)
          let size = 0
          try {
            if (!e.isDirectory()) size = (await stat(full)).size
          } catch {
            /* ignore */
          }
          return {
            name: e.name,
            dir: e.isDirectory(),
            rel: path.relative(WORKSPACE_DIR, full).split(path.sep).join('/'),
            size,
          }
        }),
      )
      items.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
      return { root: path.basename(WORKSPACE_DIR), path: rel, items }
    } catch (e) {
      return reply.code(404).send({ error: String((e as Error)?.message ?? e) })
    }
  })

  app.get('/api/fs/raw', async (req, reply) => {
    const rel = String((req.query as { path?: string }).path ?? '')
    const file = safeResolve(rel)
    if (!file) return reply.code(400).send({ error: 'path outside workspace' })
    const ext = path.extname(file).toLowerCase()
    reply.type(CONTENT_TYPE[ext] ?? 'application/octet-stream')
    return createReadStream(file)
  })

  // Upload a file from the OS picker → stored under workspace/_uploads, returns its workspace path.
  app.post('/api/fs/upload', async (req, reply) => {
    const name = String((req.query as { name?: string }).name ?? 'file').replace(/[^\w.\- ]/g, '_')
    const body = req.body
    if (!Buffer.isBuffer(body)) return reply.code(400).send({ error: 'expected binary body' })
    const destDir = path.join(WORKSPACE_DIR, '_uploads')
    await mkdir(destDir, { recursive: true })
    await writeFile(path.join(destDir, name), body)
    return { path: `_uploads/${name}`, size: body.length }
  })
}
