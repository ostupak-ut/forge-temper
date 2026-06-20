import type { FastifyInstance } from 'fastify'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getWorkspaceDir } from '../config'

/** Resolve a workspace-relative path, refusing anything that escapes the root. */
function safeResolve(rel: string): string | null {
  const root = path.resolve(getWorkspaceDir())
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
            rel: path.relative(getWorkspaceDir(), full).split(path.sep).join('/'),
            size,
          }
        }),
      )
      items.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
      return { root: path.basename(getWorkspaceDir()), path: rel, items }
    } catch (e) {
      // A not-yet-created dir (e.g. library/ before first upload) = empty, not an error.
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return { root: path.basename(getWorkspaceDir()), path: rel, items: [] as FsEntry[] }
      }
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

  // Upload a binary body. `path` = full workspace-relative destination (each
  // segment sanitized; enables folder uploads that preserve structure under
  // library/); falls back to the legacy `name` → _uploads/<name>.
  app.post('/api/fs/upload', async (req, reply) => {
    const q = req.query as { name?: string; path?: string }
    const body = req.body
    if (!Buffer.isBuffer(body)) return reply.code(400).send({ error: 'expected binary body' })
    let rel: string
    if (q.path) {
      rel = q.path
        .split('/')
        .map((s) => s.replace(/[^\w.\- ]/g, '_'))
        .filter(Boolean)
        .join('/')
    } else {
      rel = `_uploads/${String(q.name ?? 'file').replace(/[^\w.\- ]/g, '_')}`
    }
    const dest = safeResolve(rel)
    if (!dest) return reply.code(400).send({ error: 'path outside workspace' })
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, body)
    return { path: rel, size: body.length }
  })

  // Browse directories ANYWHERE on the machine (for choosing the project root).
  // Lists subfolders only; defaults to the home dir. Not workspace-confined — it
  // exists to pick the workspace root. Local single-user app.
  app.get('/api/fs/browse', async (req, reply) => {
    const raw = String((req.query as { path?: string }).path ?? '')
    const dir = raw && path.isAbsolute(raw) ? raw : os.homedir()
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => ({ name: e.name, path: path.join(dir, e.name) }))
        .sort((a, b) => a.name.localeCompare(b.name))
      const parent = path.dirname(dir)
      return { path: dir, parent: parent !== dir ? parent : null, home: os.homedir(), dirs }
    } catch (e) {
      return reply.code(400).send({ error: String((e as Error)?.message ?? e) })
    }
  })

  // Create a directory at an absolute path (for the project-root picker's
  // "New folder"). Not workspace-confined — same rationale as /browse.
  app.post('/api/fs/mkdir', async (req, reply) => {
    const p = String((req.query as { path?: string }).path ?? '').trim()
    if (!p || !path.isAbsolute(p)) return reply.code(400).send({ error: 'absolute path required' })
    try {
      await mkdir(p, { recursive: true })
      return { ok: true, path: p }
    } catch (e) {
      return reply.code(400).send({ error: String((e as Error)?.message ?? e) })
    }
  })

  // Delete a file or folder (recursive), confined to the workspace.
  app.delete('/api/fs/delete', async (req, reply) => {
    const rel = String((req.query as { path?: string }).path ?? '').trim()
    const target = safeResolve(rel)
    if (!target || !rel) return reply.code(400).send({ error: 'invalid path' })
    if (target === path.resolve(getWorkspaceDir())) return reply.code(400).send({ error: 'refusing to delete workspace root' })
    try {
      await rm(target, { recursive: true, force: true })
      return { ok: true }
    } catch (e) {
      return reply.code(500).send({ error: String((e as Error)?.message ?? e) })
    }
  })
}
