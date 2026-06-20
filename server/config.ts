import path from 'node:path'

/** Backend port; the Vite dev server proxies /api here. */
export const PORT = Number(process.env.FT_PORT ?? 8787)
export const HOST = process.env.FT_HOST ?? '127.0.0.1'

/** Where paper projects live: <WORKSPACE_DIR>/<paperId>/<versionId>/{inputs,proto}. */
export const WORKSPACE_DIR = process.env.FT_WORKSPACE ?? path.resolve(process.cwd(), 'workspace')

/** Run-history DB + transient run data. */
export const DATA_DIR = path.resolve(process.cwd(), '.forge-temper')
