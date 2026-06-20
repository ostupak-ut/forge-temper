import type { FastifyInstance } from 'fastify'
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DATA_DIR } from '../config'

const FLOWS_DIR = path.join(DATA_DIR, 'flows')

/** Allow letters, numbers, space, dash, underscore, dot — no path separators. */
function safeName(n: string): string | null {
  return /^[\w.\- ]{1,80}$/.test(n) ? n : null
}

export async function flowRoutes(app: FastifyInstance) {
  await mkdir(FLOWS_DIR, { recursive: true })

  app.get('/api/flows', async () => {
    const files = (await readdir(FLOWS_DIR)).filter((f) => f.endsWith('.json'))
    const items = await Promise.all(
      files.map(async (f) => {
        const s = await stat(path.join(FLOWS_DIR, f))
        return { name: f.replace(/\.json$/, ''), updatedAt: s.mtimeMs, size: s.size }
      }),
    )
    items.sort((a, b) => b.updatedAt - a.updatedAt)
    return { items }
  })

  app.get('/api/flows/:name', async (req, reply) => {
    const name = safeName(decodeURIComponent((req.params as { name: string }).name))
    if (!name) return reply.code(400).send({ error: 'bad name' })
    try {
      return JSON.parse(await readFile(path.join(FLOWS_DIR, `${name}.json`), 'utf8'))
    } catch {
      return reply.code(404).send({ error: 'not found' })
    }
  })

  app.put('/api/flows/:name', async (req, reply) => {
    const name = safeName(decodeURIComponent((req.params as { name: string }).name))
    if (!name) return reply.code(400).send({ error: 'bad name' })
    await writeFile(path.join(FLOWS_DIR, `${name}.json`), JSON.stringify(req.body, null, 2), 'utf8')
    return { ok: true, name }
  })

  app.delete('/api/flows/:name', async (req, reply) => {
    const name = safeName(decodeURIComponent((req.params as { name: string }).name))
    if (!name) return reply.code(400).send({ error: 'bad name' })
    try {
      await unlink(path.join(FLOWS_DIR, `${name}.json`))
      return { ok: true }
    } catch {
      return reply.code(404).send({ error: 'not found' })
    }
  })
}
