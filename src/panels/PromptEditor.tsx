import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { History, Save, Variable } from 'lucide-react'

/** Common template variables available to every agent prompt. */
const COMMON_VARS = ['iteration', 'temper_report', 'proto_dir', 'field']

interface PresetStore {
  [name: string]: string
}

function loadPresets(): PresetStore {
  try {
    return JSON.parse(localStorage.getItem('ft.promptPresets') ?? '{}')
  } catch {
    return {}
  }
}
function savePresets(p: PresetStore) {
  localStorage.setItem('ft.promptPresets', JSON.stringify(p))
}
function loadHistory(nodeId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`ft.promptHistory.${nodeId}`) ?? '[]')
  } catch {
    return []
  }
}
function pushHistory(nodeId: string, value: string) {
  if (!value.trim()) return
  const hist = loadHistory(nodeId)
  if (hist[0] === value) return
  const next = [value, ...hist.filter((h) => h !== value)].slice(0, 10)
  localStorage.setItem(`ft.promptHistory.${nodeId}`, JSON.stringify(next))
}

const cmTheme = EditorView.theme({
  '&': { fontSize: '12px', backgroundColor: 'transparent' },
  '.cm-content': { fontFamily: 'ui-monospace, monospace', color: '#d1d5db' },
  '.cm-gutters': { display: 'none' },
  '&.cm-focused': { outline: 'none' },
})

export function PromptEditor({
  nodeId,
  value,
  variables,
  onChange,
}: {
  nodeId: string
  value: string
  variables: string[]
  onChange: (v: string) => void
}) {
  const viewRef = useRef<EditorView | null>(null)
  const [presets, setPresets] = useState<PresetStore>(loadPresets)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => setHistory(loadHistory(nodeId)), [nodeId, showHistory])

  const allVars = Array.from(new Set([...variables, ...COMMON_VARS]))

  const insertVar = (name: string) => {
    const view = viewRef.current
    const token = `{{${name}}}`
    if (!view) {
      onChange(value + token)
      return
    }
    const { from, to } = view.state.selection.main
    view.dispatch({ changes: { from, to, insert: token }, selection: { anchor: from + token.length } })
    view.focus()
  }

  const applyPreset = (name: string) => {
    if (presets[name] != null) onChange(presets[name])
  }
  const saveAsPreset = () => {
    const name = window.prompt('Save prompt preset as:')
    if (!name) return
    const next = { ...presets, [name]: value }
    setPresets(next)
    savePresets(next)
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/30">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-1.5 py-1">
        <Variable className="size-3 text-white/30" />
        {allVars.map((v) => (
          <button
            key={v}
            onClick={() => insertVar(v)}
            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-temper hover:bg-white/10"
            title={`Insert {{${v}}}`}
          >
            {v}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setShowHistory((s) => !s)} title="History" className="rounded p-1 hover:bg-white/10">
            <History className="size-3 text-white/40" />
          </button>
          <button onClick={saveAsPreset} title="Save as preset" className="rounded p-1 hover:bg-white/10">
            <Save className="size-3 text-white/40" />
          </button>
        </div>
      </div>

      {Object.keys(presets).length > 0 && (
        <select
          className="w-full bg-transparent px-2 py-1 text-[11px] text-white/60 outline-none"
          value=""
          onChange={(e) => e.target.value && applyPreset(e.target.value)}
        >
          <option value="">apply preset…</option>
          {Object.keys(presets).map((n) => (
            <option key={n} value={n} className="bg-[#121826]">
              {n}
            </option>
          ))}
        </select>
      )}

      {showHistory && (
        <div className="max-h-28 overflow-auto border-b border-white/10 bg-black/40 p-1">
          {history.length === 0 && <p className="px-1 text-[10px] text-white/30">no history yet</p>}
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => onChange(h)}
              className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-white/50 hover:bg-white/10"
              title={h}
            >
              {h.slice(0, 80) || '(empty)'}
            </button>
          ))}
        </div>
      )}

      <CodeMirror
        value={value}
        height="120px"
        theme="dark"
        extensions={[markdown(), EditorView.lineWrapping, cmTheme]}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
        onCreateEditor={(view) => (viewRef.current = view)}
        onChange={onChange}
        onBlur={() => pushHistory(nodeId, value)}
      />
    </div>
  )
}
