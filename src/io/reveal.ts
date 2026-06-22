/** Open a workspace-relative path in the OS file manager (Finder/Explorer). */
export async function revealInOS(rel: string): Promise<void> {
  try {
    await fetch(`/api/fs/reveal?path=${encodeURIComponent(rel)}`, { method: 'POST' })
  } catch {
    /* best-effort: a local convenience, nothing depends on it succeeding */
  }
}
