import { useCallback, useEffect, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { collectDropFiles, hasOsFiles, uploadDropFiles } from '@/io/fileDrop'

/**
 * App-wide OS file drop. No drag overlay — dropping should never interrupt the
 * flow. Drops on the canvas are handled by FlowCanvas (it spawns a Files node);
 * drops anywhere else land in the Library here. A small corner pill is the only
 * (non-blocking) feedback, and only while a multi-file import is in flight.
 */
export function DropZone({ onImported }: { onImported: (added: string[]) => void }) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const onDrop = useCallback(
    async (e: DragEvent) => {
      if (!hasOsFiles(e.dataTransfer)) return
      e.preventDefault()
      // Drops on the canvas are handled by FlowCanvas (it spawns a Files node).
      const target = e.target as HTMLElement | null
      if (target?.closest?.('.react-flow')) return
      const files = await collectDropFiles(e.dataTransfer!)
      if (!files.length) return
      // Only surface a pill for larger imports; a single file is instant.
      if (files.length > 3) setProgress({ done: 0, total: files.length })
      const { added } = await uploadDropFiles(files, 'library', (done, total) => {
        if (files.length > 3) setProgress({ done, total })
      })
      setProgress(null)
      onImported(added)
    },
    [onImported],
  )

  useEffect(() => {
    // dragover must preventDefault so the window 'drop' fires for drops that
    // aren't over a dedicated drop target (header, side panels, empty chrome).
    const onOver = (e: DragEvent) => {
      if (!hasOsFiles(e.dataTransfer)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [onDrop])

  if (!progress) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-card/95 px-3 py-2 text-xs text-fg/80 shadow-lg ring-1 ring-border/10">
      <UploadCloud className="size-4 text-temper" />
      Importing {progress.done}/{progress.total}…
    </div>
  )
}
