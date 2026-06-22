// OS → app drag-and-drop: pull dropped files AND folders (recursively) off a
// DataTransfer, then upload them into the workspace. The backend already accepts
// a binary body at /api/fs/upload?path=<rel>, preserving folder structure.

export interface DroppedFile {
  file: File
  /** Path relative to the drop, with folder structure, e.g. "papers/a.pdf". */
  relPath: string
}

/** Does this drag carry real OS files (vs. an internal palette/preset drag)? */
export function hasOsFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false
  return Array.from(dt.types).includes('Files')
}

// --- FileSystem entry traversal (Chromium/Electron `webkitGetAsEntry`) -------

interface FsEntryLike {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (cb: (f: File) => void, err: (e: unknown) => void) => void
  createReader?: () => {
    readEntries: (cb: (entries: FsEntryLike[]) => void, err: (e: unknown) => void) => void
  }
}

function readFile(entry: FsEntryLike): Promise<File> {
  return new Promise((resolve, reject) => entry.file!(resolve, reject))
}

function readDir(entry: FsEntryLike): Promise<FsEntryLike[]> {
  const reader = entry.createReader!()
  // readEntries returns at most ~100 entries per call — loop until empty.
  return new Promise((resolve, reject) => {
    const all: FsEntryLike[] = []
    const pump = () =>
      reader.readEntries((batch) => {
        if (!batch.length) resolve(all)
        else {
          all.push(...batch)
          pump()
        }
      }, reject)
    pump()
  })
}

async function walk(entry: FsEntryLike, prefix: string, out: DroppedFile[]): Promise<void> {
  const rel = prefix ? `${prefix}/${entry.name}` : entry.name
  if (entry.isFile) {
    try {
      out.push({ file: await readFile(entry), relPath: rel })
    } catch {
      /* unreadable file — skip */
    }
  } else if (entry.isDirectory) {
    const children = await readDir(entry)
    // Read sub-entries in parallel — serial recursion is what made deep/wide
    // folders crawl. Metadata reads are cheap; the byte transfer is pooled below.
    await Promise.all(children.map((c) => walk(c, rel, out)))
  }
}

/**
 * Collect every file from a drop, descending into folders. IMPORTANT: the
 * FileSystemEntry handles are only valid synchronously inside the drop event, so
 * we grab them all up front (before any await), then traverse asynchronously.
 */
export async function collectDropFiles(dt: DataTransfer): Promise<DroppedFile[]> {
  const items = dt.items ? Array.from(dt.items) : []
  const entries = items
    .filter((it) => it.kind === 'file')
    .map((it) => (it.webkitGetAsEntry?.() ?? null) as FsEntryLike | null)
    .filter((e): e is FsEntryLike => !!e)

  if (entries.length) {
    const out: DroppedFile[] = []
    for (const e of entries) await walk(e, '', out)
    return out
  }

  // Fallback (no entry API / Safari): flat file list, no folder structure.
  return Array.from(dt.files).map((file) => ({ file, relPath: file.name }))
}

// --- Upload ------------------------------------------------------------------

export interface UploadResult {
  /** Top-level workspace-relative paths added (files + folder roots). */
  added: string[]
  /** Total individual files written. */
  count: number
}

/** The distinct top-level workspace paths a drop maps to (folder → its root). */
export function topLevelPaths(files: DroppedFile[], baseDir = 'library'): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const { relPath } of files) {
    const top = `${baseDir}/${relPath.split('/')[0]}`
    if (!seen.has(top)) {
      seen.add(top)
      out.push(top)
    }
  }
  return out
}

const UPLOAD_CONCURRENCY = 8

/**
 * Upload collected files under `baseDir` (workspace-relative, e.g. "library"),
 * with a bounded concurrency pool so a folder of many files isn't a serial
 * round-trip chain. Returns the de-duplicated TOP-LEVEL paths.
 */
export async function uploadDropFiles(
  files: DroppedFile[],
  baseDir = 'library',
  onProgress?: (done: number, total: number) => void,
): Promise<UploadResult> {
  const added: string[] = []
  const seen = new Set<string>()
  let done = 0
  let next = 0

  // Single-threaded JS: the synchronous bookkeeping between awaits can't race.
  const worker = async () => {
    while (next < files.length) {
      const { file, relPath } = files[next++]
      const dest = `${baseDir}/${relPath}`
      try {
        await fetch(`/api/fs/upload?path=${encodeURIComponent(dest)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file,
        })
        const top = relPath.includes('/') ? `${baseDir}/${relPath.split('/')[0]}` : dest
        if (!seen.has(top)) {
          seen.add(top)
          added.push(top)
        }
      } catch {
        /* skip individual failures so one bad file doesn't abort the batch */
      }
      done += 1
      onProgress?.(done, files.length)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker),
  )
  return { added, count: done }
}
