import { useEffect, useState } from 'react'
import { KeyRound, X } from 'lucide-react'

type Presence = { openrouter: boolean; openai: boolean; anthropic: boolean }

const PROVIDERS: { key: keyof Presence; label: string; hint: string }[] = [
  { key: 'openrouter', label: 'OpenRouter', hint: 'openrouter.ai/keys — unlocks OpenRouter agent + chat (400+ models)' },
  { key: 'anthropic', label: 'Anthropic', hint: 'unlocks the Anthropic Harness provider (run forge/temper with no CLI)' },
  { key: 'openai', label: 'OpenAI', hint: 'for a future OpenAI-direct provider (not yet wired)' },
]

export function Settings({ onClose }: { onClose: () => void }) {
  const [presence, setPresence] = useState<Presence>({ openrouter: false, openai: false, anthropic: false })
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setPresence(d.keys))
      .catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    const body = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()))
    const r = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    setPresence(d.keys)
    setValues({})
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={onClose}>
      <div
        className="w-[28rem] rounded-xl border border-white/10 bg-[#0d1320] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-amber-300" />
          <h2 className="text-sm font-semibold text-white/90">Provider API keys</h2>
          <button onClick={onClose} className="ml-auto rounded p-1 text-white/40 hover:bg-white/10">
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-3 text-[11px] text-white/40">
          Keys are stored locally in <code className="text-white/60">.forge-temper/settings.json</code> and never sent
          back to the browser.
        </p>
        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <div key={p.key} className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-white/70">
                {p.label}
                {presence[p.key] ? (
                  <span className="rounded bg-emerald-500/20 px-1.5 text-[10px] text-emerald-300">configured</span>
                ) : (
                  <span className="rounded bg-white/10 px-1.5 text-[10px] text-white/40">not set</span>
                )}
              </div>
              <input
                type="password"
                placeholder={presence[p.key] ? '•••••• (saved — type to replace)' : `${p.label} API key`}
                value={values[p.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [p.key]: e.target.value }))}
                className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/90 outline-none focus:border-temper"
              />
              <p className="text-[10px] text-white/25">{p.hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1 text-xs text-white/50 hover:bg-white/10">
            Close
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-temper/20 px-3 py-1 text-xs text-temper hover:bg-temper/30 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
