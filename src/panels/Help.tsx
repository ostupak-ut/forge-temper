import { HelpCircle, X } from 'lucide-react'
import { PORT_COLOR } from '@/registry/portTypes'
import { useT } from '@/i18n'

/**
 * In-app legend & quickstart. The graph language has grown enough kinds, ports
 * and edge semantics that a one-screen reference earns its keep — opened from the
 * "?" in the header.
 */

const PORTS: { type: keyof typeof PORT_COLOR; what: string }[] = [
  { type: 'idea', what: 'a raw idea / seed (from an Idea node)' },
  { type: 'paper', what: 'a Forge prototype (LaTeX + results skeleton)' },
  { type: 'report', what: 'a Temper verdict (the loop’s feedback)' },
  { type: 'verified', what: 'results that PASSED verification' },
  { type: 'card', what: 'an Info Card (title / abstract / spec)' },
  { type: 'section', what: 'written prose (body / literature)' },
  { type: 'bib', what: 'a bibliography (.bib)' },
  { type: 'file', what: 'files & folders staged onto disk' },
  { type: 'any', what: 'universal — accepts/emits anything (Custom Agent, Warehouse)' },
]

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 text-[11px] leading-relaxed text-fg/70">{children}</div>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 space-y-1.5 rounded-lg border border-border/15 bg-fg/[0.03] p-3">
      <h3 className="text-xs font-semibold text-fg/85">{title}</h3>
      {children}
    </div>
  )
}

export function Help({ onClose }: { onClose: () => void }) {
  const t = useT()
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-[34rem] flex-col rounded-xl border border-border/15 bg-card text-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border/10 px-4 py-3">
          <HelpCircle className="size-4 text-temper" />
          <h2 className="text-sm font-semibold text-fg/90">{t('How Forge works')}</h2>
          <button onClick={onClose} className="ml-auto rounded p-1 text-fg/40 hover:bg-fg/10">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <Section title={t('The idea in one line')}>
            <p className="text-[11px] leading-relaxed text-fg/70">
              {t(
                'Drag nodes from the left, wire their ports, and run the graph. Each node is an agent or a piece of data; edges carry one node’s output into the next node’s input.',
              )}
            </p>
          </Section>

          <Section title={t('Port colors — what flows on an edge')}>
            {PORTS.map((p) => (
              <Row key={p.type}>
                <span
                  className="mt-1 inline-block size-2.5 shrink-0 rounded-full"
                  style={{ background: PORT_COLOR[p.type] }}
                />
                <span>
                  <b className="text-fg/85">{p.type}</b> — {t(p.what)}
                </span>
              </Row>
            ))}
            <p className="pt-1 text-[10px] text-fg/40">
              {t('Ports only connect when types are compatible; an any port bridges anything.')}
            </p>
          </Section>

          <Section title={t('A Forge node’s inputs (context vs files vs idea)')}>
            <Row>
              <span className="text-fg/85">●&nbsp;idea</span>
              <span>{t('the required seed — your claim/mechanism in words. Injected as {{idea}}.')}</span>
            </Row>
            <Row>
              <span className="text-fg/85">●&nbsp;inputs</span>
              <span>
                {t(
                  'files & folders (from a Files node). Copied to disk in the agent’s inputs/ folder; the agent opens them with Read. Use for PDFs, data, .bib, a draft.',
                )}
              </span>
            </Row>
            <Row>
              <span className="text-fg/85">●&nbsp;context</span>
              <span>
                {t(
                  'text from any other node (another agent’s output, an Info Card, notes). Merged into the prompt as text — never a file. Use to “consider this too”.',
                )}
              </span>
            </Row>
            <Row>
              <span className="text-fg/85">●&nbsp;feedback</span>
              <span>{t('the loop’s back-edge — Temper’s verdict, re-injected each iteration (see Loops).')}</span>
            </Row>
            <p className="pt-1 text-[10px] text-fg/40">
              {t(
                'Rule of thumb: a document → inputs (a file on disk); text/another node’s output → context (text in the prompt). Everything passes as text except inputs, which pass as real files.',
              )}
            </p>
          </Section>

          <Section title={t('Loops — the arching arrow IS the loop')}>
            <p className="text-[11px] leading-relaxed text-fg/70">
              {t(
                'Wire a node’s out back into an earlier node’s feedback port to form a loop (e.g. Temper → Forge). The rose “loop ≤N” arc means it really cycles — the source re-runs the target until it passes or hits the cap (click the arc to edit mode/cap; drag its handle to reposition).',
              )}
            </p>
            <p className="text-[11px] leading-relaxed text-amber-200">
              {t(
                'An amber “⚠ not a loop” edge means there’s no forward path closing the cycle — so nothing iterates. Add a forward edge from the target back to the source (or delete the stray edge).',
              )}
            </p>
          </Section>

          <Section title={t('Running')}>
            <Row>
              <span className="text-fg/85">Dry&nbsp;Run</span>
              <span>{t('walks the order & animates edges WITHOUT calling any agent — free, for sanity-checking wiring.')}</span>
            </Row>
            <Row>
              <span className="text-fg/85">Run&nbsp;Graph</span>
              <span>{t('actually executes every agent (spends tokens), iterating loops to convergence.')}</span>
            </Row>
            <Row>
              <span className="text-fg/85">{t('▶ on a node')}</span>
              <span>{t('runs just that node (and its upstream dependencies).')}</span>
            </Row>
          </Section>

          <Section title={t('Files in vs results out')}>
            <Row>
              <span className="text-fg/85">Library</span>
              <span>{t('your persistent input store — upload files/folders, then pick them in a Files node.')}</span>
            </Row>
            <Row>
              <span className="text-fg/85">Warehouse</span>
              <span>
                {t(
                  'wire it from ANY agent’s output; it collects artifacts (pdf/md/tex/all) from disk into an indexed pile that accumulates a new run-NNN each run.',
                )}
              </span>
            </Row>
          </Section>

          <Section title={t('Agents & effort')}>
            <p className="text-[11px] leading-relaxed text-fg/70">
              {t(
                'Each agent picks a provider (only the ones you have are offered): Claude Code & Codex use your CLI subscription; Anthropic Harness & OpenRouter use an API key (Settings). Effort trades latency for depth (low→max). A Custom Agent is a blank agent — name it, prompt it, wire it anywhere, even onto the loop.',
              )}
            </p>
          </Section>
        </div>

        <div className="flex shrink-0 justify-end border-t border-border/10 px-4 py-3">
          <button onClick={onClose} className="rounded-md bg-temper/20 px-3 py-1 text-xs text-temper hover:bg-temper/30">
            {t('Got it')}
          </button>
        </div>
      </div>
    </div>
  )
}
