import { mkdirSync } from 'node:fs'
import path from 'node:path'

/** Backend port; the Vite dev server proxies /api here. */
export const PORT = Number(process.env.FT_PORT ?? 8787)
export const HOST = process.env.FT_HOST ?? '127.0.0.1'

/**
 * Default workspace root: where paper projects live under
 * <workspace>/<paperId>/<versionId>/{inputs,proto}. Overridable at runtime via
 * setWorkspaceDir() (driven by the persisted Settings "Project folder").
 */
export const DEFAULT_WORKSPACE_DIR = process.env.FT_WORKSPACE ?? path.resolve(process.cwd(), 'workspace')

/**
 * Back-compat alias for the DEFAULT root. Do NOT read this for live path
 * resolution — call getWorkspaceDir() at call time so the runtime override
 * (persisted Settings) is honoured.
 */
export const WORKSPACE_DIR = DEFAULT_WORKSPACE_DIR

let workspaceOverride: string | null = null

/** The active workspace root: the runtime override if set, else the default. */
export function getWorkspaceDir(): string {
  return workspaceOverride ?? DEFAULT_WORKSPACE_DIR
}

/** Set (or clear, with null) the runtime workspace root and ensure it exists. */
export function setWorkspaceDir(dir: string | null): void {
  workspaceOverride = dir ? path.resolve(dir) : null
  try {
    mkdirSync(getWorkspaceDir(), { recursive: true })
  } catch {
    /* ignore */
  }
}

/** Run-history DB + transient run data. Env-overridable so the packaged app can
 *  point it at the OS user-data dir (Electron main sets FT_DATA_DIR). */
export const DATA_DIR = process.env.FT_DATA_DIR ?? path.resolve(process.cwd(), '.forge-temper')
