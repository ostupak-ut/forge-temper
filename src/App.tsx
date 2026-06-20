import { useEffect, useState, useSyncExternalStore } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Anvil, FolderTree, Moon, PanelRightOpen, Settings as SettingsIcon, Sun } from 'lucide-react'
import { FlowCanvas } from '@/canvas/FlowCanvas'
import { Palette } from '@/panels/Palette'
import { Inspector } from '@/panels/Inspector'
import { Toolbar } from '@/panels/Toolbar'
import { FileManager } from '@/panels/FileManager'
import { Settings } from '@/panels/Settings'
import { useGraphStore } from '@/store/graphStore'
import { loadAutosave, saveAutosave, serializeGraph } from '@/io/serialize'
import { getTheme, subscribe, toggleTheme } from '@/theme'

type Health = { ok: boolean; service: string; claude?: string }

function HealthBadge() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError(true))
  }, [])
  if (error) return <span className="rounded bg-red-500/20 px-2 py-1 text-red-300">backend offline</span>
  if (!health) return <span className="rounded bg-fg/10 px-2 py-1 text-fg/50">connecting…</span>
  return (
    <span className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-300">
      backend ok{health.claude ? ` · claude ${health.claude.split(' ')[0]}` : ''}
    </span>
  )
}

function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme)
  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex size-7 items-center justify-center rounded text-fg/50 transition hover:bg-fg/10 hover:text-fg/80"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}

/** Restore the last autosaved graph once, then autosave on every change. */
function useAutosave() {
  const setGraph = useGraphStore((s) => s.setGraph)
  useEffect(() => {
    const doc = loadAutosave()
    if (doc?.nodes?.length) setGraph(doc.nodes, doc.edges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const unsub = useGraphStore.subscribe((s) => {
      saveAutosave(serializeGraph(s.nodes, s.edges))
    })
    return unsub
  }, [])
}

export function App() {
  useAutosave()
  const [filesOpen, setFilesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-border/10 bg-field px-4 py-2">
          <div className="flex items-center gap-1.5 font-semibold tracking-tight">
            <Anvil className="size-5 text-forge" />
            <span>Forge</span>
          </div>
          <span className="text-sm text-fg/40">Visual Flow Modeller</span>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <HealthBadge />
            <ThemeToggle />
          </div>
        </header>

        <Toolbar />

        <div className="flex min-h-0 flex-1">
          <Palette />
          <div className="relative min-w-0 flex-1">
            <FlowCanvas />
          </div>
          {inspectorOpen ? (
            <Inspector onClose={() => setInspectorOpen(false)} />
          ) : (
            <button
              onClick={() => setInspectorOpen(true)}
              title="Open inspector"
              className="flex w-7 shrink-0 items-center justify-center border-l border-border/10 bg-surface text-fg/40 transition hover:bg-fg/5 hover:text-fg/80"
            >
              <PanelRightOpen className="size-4" />
            </button>
          )}
        </div>

        {filesOpen && <FileManager onClose={() => setFilesOpen(false)} />}

        <div className="flex items-center gap-2 border-t border-border/10 bg-field px-3 py-1">
          <button
            onClick={() => setFilesOpen((o) => !o)}
            className={
              'flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] transition ' +
              (filesOpen ? 'bg-fg/10 text-fg/80' : 'text-fg/45 hover:bg-fg/5 hover:text-fg/70')
            }
          >
            <FolderTree className="size-3.5" /> Files
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-fg/45 transition hover:bg-fg/5 hover:text-fg/70"
          >
            <SettingsIcon className="size-3.5" /> Settings
          </button>
          <span className="ml-auto text-[10px] text-fg/25">forge</span>
        </div>

        {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      </div>
    </ReactFlowProvider>
  )
}
