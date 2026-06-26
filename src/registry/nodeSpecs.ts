import {
  Anvil,
  Thermometer,
  IdCard,
  FileInput,
  PenLine,
  BookText,
  FileStack,
  StickyNote,
  Sparkles,
  Archive,
  Clapperboard,
} from 'lucide-react'
import type { FieldDescriptor, NodeKind, NodeSpec } from './types'

const PROVIDER_OPTIONS = [
  { label: '★ Claude Code — subscription, no key (recommended)', value: 'claude-code' },
  { label: 'Codex — ChatGPT/Codex subscription (CLI)', value: 'codex' },
  { label: 'Anthropic Harness — API key, no CLI', value: 'anthropic-harness' },
  { label: 'OpenRouter — agent (tool-capable models)', value: 'openrouter-agent' },
  { label: 'OpenRouter — chat (no tools/skills)', value: 'openrouter' },
  { label: 'OpenRouter — image (generation)', value: 'openrouter-image' },
  { label: 'OpenRouter — video (generation)', value: 'openrouter-video' },
]

const MODEL_OPTIONS = [
  { label: 'Inherit (session default)', value: 'inherit' },
  { label: 'Opus 4.8', value: 'claude-opus-4-8' },
  { label: 'Sonnet 4.6', value: 'claude-sonnet-4-6' },
  { label: 'Haiku 4.5', value: 'claude-haiku-4-5' },
]

const EFFORT_OPTIONS = [
  { label: 'low', value: 'low' },
  { label: 'medium', value: 'medium' },
  { label: 'high', value: 'high' },
  { label: 'xhigh (Codex)', value: 'xhigh' },
  { label: 'max', value: 'max' },
]

/** Fields every Claude-backed (agent) node shares. */
function agentFields(opts: { skill?: string; promptHelp?: string }): FieldDescriptor[] {
  return [
    {
      key: 'provider',
      label: 'Provider',
      kind: 'select',
      group: 'Model',
      options: PROVIDER_OPTIONS,
      help: 'Claude Code is an AGENT (runs forge/temper skills). OpenRouter is a model gateway (chat only) — fine for prose/plain nodes.',
    },
    { key: 'model', label: 'Model', kind: 'model', group: 'Model', options: MODEL_OPTIONS },
    { key: 'effort', label: 'Effort', kind: 'select', group: 'Model', options: EFFORT_OPTIONS },
    {
      key: 'prompt',
      label: 'Prompt',
      kind: 'prompt',
      group: 'Prompt',
      help: opts.promptHelp ?? 'Use {{variables}} to pull in upstream outputs and loop state.',
    },
    {
      key: 'systemAppend',
      label: 'System append',
      kind: 'textarea',
      group: 'Prompt',
      rows: 3,
      help: 'Appended to the Claude Code system prompt (steers skill behavior).',
    },
    {
      key: 'skill',
      label: 'Skill',
      kind: 'skill',
      group: 'Prompt',
      help: 'Skill this node runs with — your ~/.claude/skills/ first, then bundled. Create a skill at home and it shows up here.',
    },
    {
      key: 'workingDir',
      label: 'Working dir',
      kind: 'path',
      group: 'Execution',
      help: 'Defaults to the paper version directory.',
    },
    {
      key: 'requireAllInputs',
      label: 'Wait for all inputs',
      kind: 'boolean',
      group: 'Flow',
      help: 'Only run once EVERY upstream input has succeeded. If any upstream agent failed or is still held, this node WAITS (it does not run on partial input) — fix the upstream and re-run it, and this node picks up the full set. Off (default) = run with whatever arrived.',
    },
  ]
}

const agentDefaults = (skill = '') => ({
  provider: 'claude-code',
  model: 'inherit',
  effort: 'high',
  prompt: '',
  systemAppend: '',
  skill,
  workingDir: '',
  requireAllInputs: false,
})

export const NODE_SPECS: Record<NodeKind, NodeSpec> = {
  idea: {
    kind: 'idea',
    label: 'Prompt',
    description: 'A sticky note — type your idea / prompt directly on it. The seed Forge turns into a prototype.',
    color: '#8b5cf6',
    icon: StickyNote,
    inputs: [],
    outputs: [{ id: 'idea', type: 'idea', label: 'prompt' }],
    fields: [
      {
        key: 'text',
        label: 'Prompt',
        kind: 'textarea',
        group: 'Prompt',
        rows: 8,
        help: 'Type directly on the node, or here. Describe your model / result / mechanism — Forge takes it from here.',
      },
    ],
    defaultConfig: { text: '' },
    reactFlowType: 'ftIdea',
  },

  infocard: {
    kind: 'infocard',
    hidePalette: true,
    label: 'Info Card',
    description: 'Documentation card (forge produces this): title, abstract, contributions of the prototype.',
    color: '#a855f7',
    icon: IdCard,
    inputs: [{ id: 'verified', type: 'verified', label: 'verified' }],
    outputs: [{ id: 'card', type: 'card', label: 'card' }],
    fields: [
      { key: 'title', label: 'Title', kind: 'text', group: 'Card' },
      { key: 'abstract', label: 'Abstract', kind: 'textarea', group: 'Card', rows: 3 },
      {
        key: 'field',
        label: 'Field',
        kind: 'select',
        group: 'Card',
        options: [
          { label: 'Economics', value: 'econ' },
          { label: 'Operations Research', value: 'OR' },
          { label: 'Information Systems', value: 'IS' },
        ],
      },
      {
        key: 'spec',
        label: 'Spec (JSON)',
        kind: 'textarea',
        group: 'Card',
        rows: 8,
        help: 'contributions, notation, assumptions, model_setup, target_results',
      },
    ],
    defaultConfig: {
      title: '',
      abstract: '',
      field: 'econ',
      spec: '{\n  "contributions": [],\n  "assumptions": [],\n  "target_results": []\n}',
    },
    reactFlowType: 'ftNode',
  },

  file: {
    kind: 'file',
    label: 'File',
    description:
      'Files & folders staged into an agent’s inputs/. Drag files straight from your desktop onto the canvas, drop onto this node to add more, or pick from the Library. Folders copy in recursively.',
    color: '#94a3b8',
    icon: FileInput,
    inputs: [],
    outputs: [{ id: 'file', type: 'file', label: 'files' }],
    fields: [
      {
        key: 'paths',
        label: 'Files & folders',
        kind: 'files',
        group: 'Files',
        help: 'Each entry is staged into the agent’s inputs/ (folders recursively).',
      },
    ],
    defaultConfig: { paths: [] },
    reactFlowType: 'ftFile',
  },

  forge: {
    kind: 'forge',
    hidePalette: true,
    label: 'Forge',
    description: 'Drafts a paper version + a machine-checkable results skeleton.',
    color: '#e8743b',
    icon: Anvil,
    inputs: [
      { id: 'idea', type: 'idea', label: 'idea', required: true },
      { id: 'inputs', type: 'file', label: 'inputs' },
      { id: 'context', type: 'any', label: 'context' },
      { id: 'feedback', type: 'report', label: 'feedback', loopInternal: true },
    ],
    outputs: [{ id: 'paper', type: 'paper', label: 'paper' }],
    fields: agentFields({
      skill: 'forge',
      promptHelp:
        'e.g. "forge a prototype of this idea: {{idea}}". Wire in as many ideas/files/anything as you like — multiples merge, and anything you don’t reference is auto-appended. {{temper_report}} is injected on loop re-runs.',
    }),
    defaultConfig: { ...agentDefaults('forge'), prompt: 'forge a prototype of this idea:\n\n{{idea}}' },
    reactFlowType: 'ftNode',
  },

  temper: {
    kind: 'temper',
    hidePalette: true,
    label: 'Temper',
    description: 'Verifies the skeleton algebraically + numerically; emits a structured verdict.',
    color: '#3b9ae8',
    icon: Thermometer,
    inputs: [
      { id: 'paper', type: 'paper', label: 'paper', required: true },
      { id: 'context', type: 'any', label: 'context' },
    ],
    outputs: [
      { id: 'report', type: 'report', label: 'report' },
      { id: 'verified', type: 'verified', label: 'verified' },
    ],
    fields: [
      ...agentFields({ skill: 'temper' }),
      {
        key: 'sampleCount',
        label: 'Numeric samples',
        kind: 'number',
        group: 'Verification',
        min: 100,
        max: 200000,
        step: 100,
        help: 'Random instances per result in the numeric harness.',
      },
    ],
    defaultConfig: { ...agentDefaults('temper'), prompt: 'temper {{paper}}: verify every result.', sampleCount: 20000 },
    reactFlowType: 'ftNode',
  },

  custom: {
    kind: 'custom',
    label: 'Custom Agent',
    description:
      'Freely-wireable agent — name it, prompt it, pick a provider/model, tool scope, file inputs. Drops anywhere in a flow, including onto a loop. Can act as a loop Verifier.',
    color: '#22d3ee',
    icon: Sparkles,
    inputs: [
      { id: 'in', type: 'any', label: 'in' },
      { id: 'inputs', type: 'file', label: 'files' },
      { id: 'feedback', type: 'report', label: 'feedback', loopInternal: true },
    ],
    outputs: [{ id: 'out', type: 'any', label: 'out' }],
    fields: [
      {
        key: 'symbol',
        label: 'Symbol',
        kind: 'icon',
        group: 'Design',
        help: 'Pick an icon for this agent — it shows on the node and in this panel.',
      },
      { key: 'color', label: 'Color', kind: 'color', group: 'Design', help: 'Accent color for this agent node.' },
      ...agentFields({
        promptHelp:
          'Your instructions. {{in}} = upstream output, {{files}} = staged files, {{temper_report}}/{{feedback}} on loop re-runs.',
      }),
      {
        key: 'toolScope',
        label: 'Tool scope',
        kind: 'multiselect',
        group: 'Execution',
        options: [
          { label: 'Read', value: 'Read' },
          { label: 'Write', value: 'Write' },
          { label: 'Edit', value: 'Edit' },
          { label: 'Bash', value: 'Bash' },
          { label: 'Glob', value: 'Glob' },
          { label: 'Grep', value: 'Grep' },
          { label: 'WebSearch', value: 'WebSearch' },
          { label: 'WebFetch', value: 'WebFetch' },
        ],
        help: 'Which tools this agent may use (bypassPermissions still applies). Enable WebSearch/WebFetch for research agents on Claude Code (native web access instead of curl).',
      },
      {
        key: 'verifier',
        label: 'Verifier (loop pass-gate)',
        kind: 'boolean',
        group: 'Verification',
        help: 'Make this agent emit a PASS/FAIL verdict so an until-pass loop can converge on it. Wire its out into the loop’s feedback so it drives the loop.',
      },
      {
        key: 'passCondition',
        label: 'Pass condition',
        kind: 'textarea',
        group: 'Verification',
        rows: 3,
        help: 'What counts as PASS (used only when Verifier is on). The agent reasons, then ends with VERDICT: PASS or VERDICT: FAIL.',
      },
    ],
    defaultConfig: {
      ...agentDefaults(''),
      symbol: 'Sparkles',
      color: '#22d3ee',
      prompt: '',
      toolScope: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      verifier: false,
      passCondition: '',
    },
    reactFlowType: 'ftNode',
  },

  body: {
    kind: 'body',
    hidePalette: true,
    label: 'Body',
    description: 'Writes the model/results exposition around the VERIFIED theorems (olehwrites).',
    color: '#eab308',
    icon: PenLine,
    inputs: [
      { id: 'verified', type: 'verified', label: 'verified', required: true },
      { id: 'card', type: 'card', label: 'card' },
      { id: 'context', type: 'any', label: 'context' },
    ],
    outputs: [{ id: 'section', type: 'section', label: 'section' }],
    fields: agentFields({ skill: 'olehwrites' }),
    defaultConfig: { ...agentDefaults('olehwrites'), prompt: 'Write the body exposition for {{verified}}.' },
    reactFlowType: 'ftNode',
  },

  literature: {
    kind: 'literature',
    hidePalette: true,
    label: 'Literature',
    description: 'Writes related work / lit review; consumes & emits .bib (olehwrites).',
    color: '#14b8a6',
    icon: BookText,
    inputs: [
      { id: 'verified', type: 'verified', label: 'verified' },
      { id: 'bib', type: 'bib', label: 'bib' },
      { id: 'context', type: 'any', label: 'context' },
    ],
    outputs: [
      { id: 'section', type: 'section', label: 'section' },
      { id: 'bib', type: 'bib', label: 'bib' },
    ],
    fields: agentFields({ skill: 'olehwrites' }),
    defaultConfig: { ...agentDefaults('olehwrites'), prompt: 'Write the related-work section for {{verified}}.' },
    reactFlowType: 'ftNode',
  },

  assemble: {
    kind: 'assemble',
    hidePalette: true,
    label: 'Assemble',
    description:
      'Stitches the verified theorems + written sections + bibliography into one compilable main.tex and runs latexmk → PDF. An agent node — pick any agentic provider (Claude Code / Codex / OpenRouter-agent).',
    color: '#64748b',
    icon: FileStack,
    inputs: [
      { id: 'section', type: 'section', label: 'sections' },
      { id: 'verified', type: 'verified', label: 'verified' },
      { id: 'bib', type: 'bib', label: 'bib' },
      { id: 'context', type: 'any', label: 'context' },
    ],
    outputs: [{ id: 'tex', type: 'file', label: 'main.tex' }],
    fields: [
      ...agentFields({
        promptHelp:
          'Integrates {{verified}} + {{section}} + {{bib}} into a single compilable main.tex and runs latexmk. Needs an agentic provider (Bash to compile).',
      }),
      { key: 'outputPath', label: 'Output path', kind: 'path', group: 'Output', placeholder: 'main.tex' },
      { key: 'runLatexmk', label: 'Compile (latexmk)', kind: 'boolean', group: 'Output' },
    ],
    defaultConfig: {
      ...agentDefaults(''),
      prompt:
        'Assemble ONE compilable LaTeX paper from the wired inputs, then compile it to a PDF.\n\n' +
        'Verified results:\n{{verified}}\n\nWritten sections:\n{{section}}\n\nBibliography:\n{{bib}}\n\n' +
        'Write a single self-contained main.tex in your working directory (a proper preamble — prefer Libertine + newtxmath if available) that integrates the verified results and the section prose in a sensible order, with the bibliography. Then run `latexmk -pdf main.tex`, fix any compile errors, and recompile until it builds. Report the final PDF path.',
      outputPath: 'main.tex',
      runLatexmk: true,
    },
    reactFlowType: 'ftNode',
  },

  warehouse: {
    kind: 'warehouse',
    label: 'Warehouse',
    description:
      'Collects the graph’s results into an indexed pile that ACCUMULATES across runs. Wire it from ANY agent’s output; each run adds a new run-NNN folder.',
    color: '#0ea5e9',
    icon: Archive,
    inputs: [{ id: 'in', type: 'any', label: 'in' }],
    outputs: [{ id: 'out', type: 'any', label: 'out' }],
    fields: [
      {
        key: 'warehouseName',
        label: 'Warehouse name',
        kind: 'text',
        group: 'Warehouse',
        placeholder: 'defaults to this node',
        help: 'The pile lives at warehouse/<name>. Reuse a name to restore an old pile or share one across nodes.',
      },
      {
        key: 'collect',
        label: 'Collect',
        kind: 'select',
        group: 'Warehouse',
        options: [
          { label: 'Everything (default)', value: 'all' },
          { label: 'PDF only', value: 'pdf' },
          { label: 'Markdown only', value: 'md' },
          { label: 'LaTeX (.tex)', value: 'tex' },
          { label: 'Images only', value: 'img' },
          { label: 'Video only', value: 'vid' },
        ],
        help: 'Collects every output file by default. Pick a type only to filter the pile down.',
      },
      { key: 'pile', label: 'Pile', kind: 'warehouse', group: 'Warehouse' },
    ],
    defaultConfig: { collect: 'all', warehouseName: '' },
    reactFlowType: 'ftWarehouse',
  },
  glue: {
    kind: 'glue',
    label: 'Glue',
    description:
      'Deterministically stitch photos + videos into ONE mp4 with ffmpeg (no AI, no tokens). Wire photo/video sources into "media"; stills become short segments. Clip order = file name — prefix 01_/02_ to control it.',
    color: '#14b8a6',
    icon: Clapperboard,
    inputs: [{ id: 'media', type: 'any', label: 'photos / videos' }],
    outputs: [{ id: 'out', type: 'file', label: 'glued.mp4' }],
    fields: [
      { key: 'outputName', label: 'Output file', kind: 'text', group: 'Output', placeholder: 'glued.mp4' },
      {
        key: 'width',
        label: 'Width',
        kind: 'number',
        group: 'Format',
        min: 0,
        help: '0 = match the first video clip (falls back to 1080).',
      },
      {
        key: 'height',
        label: 'Height',
        kind: 'number',
        group: 'Format',
        min: 0,
        help: '0 = match the first video clip (falls back to 1920).',
      },
      { key: 'fps', label: 'FPS', kind: 'number', group: 'Format', min: 1 },
      {
        key: 'imageDuration',
        label: 'Photo seconds',
        kind: 'number',
        group: 'Format',
        min: 1,
        help: 'How many seconds each still photo is shown.',
      },
    ],
    defaultConfig: { outputName: 'glued.mp4', width: 0, height: 0, fps: 30, imageDuration: 3 },
    reactFlowType: 'ftNode',
  },
}

export const ALL_KINDS = Object.keys(NODE_SPECS) as NodeKind[]

/**
 * Fallback for unknown/legacy node kinds (e.g. a graph saved before a kind was
 * removed, or stale in-memory state after an HMR). Renders as a harmless,
 * portless "Unknown" node instead of crashing the whole canvas.
 */
const FALLBACK_SPEC: NodeSpec = {
  kind: 'idea',
  label: 'Unknown node',
  description: 'Unrecognized node type (from an older graph). Safe to delete.',
  color: '#64748b',
  icon: FileStack,
  inputs: [],
  outputs: [],
  fields: [],
  defaultConfig: {},
  reactFlowType: 'ftNode',
}

export const getSpec = (kind: NodeKind): NodeSpec => NODE_SPECS[kind] ?? FALLBACK_SPEC
