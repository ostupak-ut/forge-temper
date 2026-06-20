import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from '../config'

mkdirSync(DATA_DIR, { recursive: true })
const db = new Database(path.join(DATA_DIR, 'runs.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    kind TEXT,
    status TEXT,
    started_at INTEGER,
    ended_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS node_runs (
    run_id TEXT,
    node_id TEXT,
    iteration INTEGER DEFAULT 0,
    kind TEXT,
    status TEXT,
    started_at INTEGER,
    ended_at INTEGER,
    session_id TEXT,
    cost_usd REAL,
    result TEXT,
    structured TEXT,
    error TEXT,
    PRIMARY KEY (run_id, node_id, iteration)
  );
`)

export interface NodeRunRow {
  runId: string
  nodeId: string
  iteration?: number
  kind?: string
  status: string
  sessionId?: string
  costUsd?: number
  result?: string
  structured?: unknown
  error?: string
}

const insertRun = db.prepare(
  `INSERT OR REPLACE INTO runs (id, kind, status, started_at) VALUES (@id, @kind, @status, @started_at)`,
)
const finishRunStmt = db.prepare(`UPDATE runs SET status=@status, ended_at=@ended_at WHERE id=@id`)
const upsertNode = db.prepare(`
  INSERT INTO node_runs (run_id, node_id, iteration, kind, status, started_at, ended_at, session_id, cost_usd, result, structured, error)
  VALUES (@run_id, @node_id, @iteration, @kind, @status, @started_at, @ended_at, @session_id, @cost_usd, @result, @structured, @error)
  ON CONFLICT(run_id, node_id, iteration) DO UPDATE SET
    status=excluded.status,
    ended_at=COALESCE(excluded.ended_at, node_runs.ended_at),
    session_id=COALESCE(excluded.session_id, node_runs.session_id),
    cost_usd=COALESCE(excluded.cost_usd, node_runs.cost_usd),
    result=COALESCE(excluded.result, node_runs.result),
    structured=COALESCE(excluded.structured, node_runs.structured),
    error=COALESCE(excluded.error, node_runs.error)
`)

export const runStore = {
  createRun(id: string, kind: string) {
    insertRun.run({ id, kind, status: 'running', started_at: Date.now() })
  },
  finishRun(id: string, status: string) {
    finishRunStmt.run({ id, status, ended_at: Date.now() })
  },
  upsertNodeRun(row: NodeRunRow) {
    const now = Date.now()
    const ended = row.status === 'done' || row.status === 'error' ? now : null
    upsertNode.run({
      run_id: row.runId,
      node_id: row.nodeId,
      iteration: row.iteration ?? 0,
      kind: row.kind ?? null,
      status: row.status,
      started_at: now,
      ended_at: ended,
      session_id: row.sessionId ?? null,
      cost_usd: row.costUsd ?? null,
      result: row.result ?? null,
      structured: row.structured != null ? JSON.stringify(row.structured) : null,
      error: row.error ?? null,
    })
  },
  getRun(id: string) {
    const run = db.prepare(`SELECT * FROM runs WHERE id=?`).get(id) as Record<string, unknown> | undefined
    const nodes = db.prepare(`SELECT * FROM node_runs WHERE run_id=?`).all(id) as Record<string, unknown>[]
    return run ? { ...run, nodes } : null
  },
}
