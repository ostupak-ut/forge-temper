import {
  Anvil,
  Thermometer,
  IdCard,
  FileInput,
  PenLine,
  BookText,
  FileStack,
  Lightbulb,
  Sparkles,
} from 'lucide-react'
import type { FieldDescriptor, NodeKind, NodeSpec } from './types'

const PROVIDER_OPTIONS = [
  { label: '★ Claude Code — subscription, no key (recommended)', value: 'claude-code' },
  { label: 'Codex — ChatGPT/Codex subscription (CLI)', value: 'codex' },
  { label: 'Anthropic Harness — API key, no CLI', value: 'anthropic-harness' },
  { label: 'OpenRouter — agent (tool-capable models)', value: 'openrouter-agent' },
  { label: 'OpenRouter — chat (no tools/skills)', value: 'openrouter' },
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
      kind: 'text',
      group: 'Prompt',
      placeholder: 'skill name',
      help: 'Claude Code skill this node leans on.',
    },
    {
      key: 'workingDir',
      label: 'Working dir',
      kind: 'path',
      group: 'Execution',
      help: 'Defaults to the paper version directory.',
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
})

export const NODE_SPECS: Record<NodeKind, NodeSpec> = {
  idea: {
    kind: 'idea',
    label: 'Idea',
    description: 'Your raw idea or rough draft — the seed Forge turns into a prototype. No file needed.',
    color: '#8b5cf6',
    icon: Lightbulb,
    inputs: [],
    outputs: [{ id: 'idea', type: 'idea', label: 'idea' }],
    fields: [
      {
        key: 'text',
        label: 'Idea',
        kind: 'textarea',
        group: 'Idea',
        rows: 8,
        help: 'Describe your model / result / mechanism in plain words. Forge takes it from here.',
      },
    ],
    defaultConfig: { text: '' },
    reactFlowType: 'ftNode',
  },

  infocard: {
    kind: 'infocard',
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
    description: 'A file or folder staged into the run’s inputs/.',
    color: '#94a3b8',
    icon: FileInput,
    inputs: [],
    outputs: [{ id: 'file', type: 'file', label: 'file' }],
    fields: [
      { key: 'path', label: 'File', kind: 'path', group: 'File', pickFile: true, help: 'Choose a file to feed into Forge’s inputs/.' },
      {
        key: 'stageAs',
        label: 'Stage as (optional)',
        kind: 'text',
        group: 'File',
        placeholder: 'inputs/<name>',
        help: 'Filename inside the run’s inputs/ (defaults to the chosen file’s name).',
      },
    ],
    defaultConfig: { path: '', stageAs: '' },
    reactFlowType: 'ftNode',
  },

  forge: {
    kind: 'forge',
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
      'Freely-wireable agent — your name, prompt, provider/model, tool scope, file input. Drops anywhere, including onto the Forge↔Temper loop.',
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
        group: 'Agent',
        help: 'Pick an icon for this agent — it shows on the node and in this panel.',
      },
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
        ],
        help: 'Which tools this agent may use (bypassPermissions still applies).',
      },
    ],
    defaultConfig: {
      ...agentDefaults(''),
      symbol: 'Sparkles',
      prompt: '',
      toolScope: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    },
    reactFlowType: 'ftNode',
  },

  body: {
    kind: 'body',
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
    label: 'Assemble',
    description: 'Concatenates preamble + body + theorems + lit + bib into a compilable main.tex.',
    color: '#64748b',
    icon: FileStack,
    inputs: [
      { id: 'section', type: 'section', label: 'sections' },
      { id: 'verified', type: 'verified', label: 'verified' },
      { id: 'bib', type: 'bib', label: 'bib' },
    ],
    outputs: [{ id: 'tex', type: 'file', label: 'main.tex' }],
    fields: [
      { key: 'outputPath', label: 'Output path', kind: 'path', group: 'Output', placeholder: 'main.tex' },
      { key: 'runLatexmk', label: 'Compile (latexmk)', kind: 'boolean', group: 'Output' },
    ],
    defaultConfig: { outputPath: 'main.tex', runLatexmk: true },
    reactFlowType: 'ftNode',
  },
}

export const ALL_KINDS = Object.keys(NODE_SPECS) as NodeKind[]
export const getSpec = (kind: NodeKind): NodeSpec => NODE_SPECS[kind]
