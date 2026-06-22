import { useEffect, useState } from 'react'
import { ChevronDown, FolderOpen } from 'lucide-react'
import { OpenFolder } from '@/panels/OpenFolder'

const baseName = (p: string) => p.replace(/[/\\]+$/, '').split(/[/\\]/).pop() || p

/**
 * Prominent header control: shows the current project root (VSCode-style) and
 * opens the Open Folder dialog to switch it.
 */
export function RootFolder() {
  const [dir, setDir] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setDir(d.workspaceDir ?? ''))
      .catch(() => {})
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={dir ? `Project root: ${dir}\nClick to open a different folder` : 'Choose a project root folder'}
        className="flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-500/20"
      >
        <FolderOpen className="size-4 shrink-0" />
        <span className="max-w-[16rem] truncate">{dir ? baseName(dir) : 'Open Folder…'}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </button>
      {open && (
        <OpenFolder
          current={dir}
          onClose={() => setOpen(false)}
          onChosen={(d) => {
            setDir(d)
            // Reload into the new root, like VSCode's Open Folder. The graph
            // autosaves to localStorage, so it's restored on reload.
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
