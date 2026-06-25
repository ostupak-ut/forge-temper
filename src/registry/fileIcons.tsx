import {
  File as FileGeneric,
  FileText,
  FileCode2,
  FileJson,
  FileImage,
  FileVideo,
  FileSpreadsheet,
  FileArchive,
  FileType,
  Folder,
  Sigma,
  BookMarked,
  Table2,
  type LucideIcon,
} from 'lucide-react'

export interface Glyph {
  Icon: LucideIcon
  /** Tailwind-independent hex so it works inline in nodes and panels alike. */
  color: string
}

const FOLDER: Glyph = { Icon: Folder, color: '#fbbf24' }
const GENERIC: Glyph = { Icon: FileGeneric, color: '#94a3b8' }

// Extension → glyph. Kept flat so it's trivial to extend.
const BY_EXT: Record<string, Glyph> = {
  // documents
  pdf: { Icon: FileType, color: '#f87171' },
  md: { Icon: FileText, color: '#38bdf8' },
  markdown: { Icon: FileText, color: '#38bdf8' },
  txt: { Icon: FileText, color: '#94a3b8' },
  rtf: { Icon: FileText, color: '#94a3b8' },
  doc: { Icon: FileText, color: '#60a5fa' },
  docx: { Icon: FileText, color: '#60a5fa' },
  // LaTeX / bibliography
  tex: { Icon: Sigma, color: '#fb923c' },
  sty: { Icon: Sigma, color: '#fdba74' },
  cls: { Icon: Sigma, color: '#fdba74' },
  bib: { Icon: BookMarked, color: '#2dd4bf' },
  // code
  py: { Icon: FileCode2, color: '#a3e635' },
  ipynb: { Icon: FileCode2, color: '#fb923c' },
  js: { Icon: FileCode2, color: '#facc15' },
  jsx: { Icon: FileCode2, color: '#facc15' },
  ts: { Icon: FileCode2, color: '#38bdf8' },
  tsx: { Icon: FileCode2, color: '#38bdf8' },
  sh: { Icon: FileCode2, color: '#a3e635' },
  r: { Icon: FileCode2, color: '#60a5fa' },
  json: { Icon: FileJson, color: '#fbbf24' },
  yaml: { Icon: FileCode2, color: '#f472b6' },
  yml: { Icon: FileCode2, color: '#f472b6' },
  toml: { Icon: FileCode2, color: '#f472b6' },
  // data / tables
  csv: { Icon: Table2, color: '#4ade80' },
  tsv: { Icon: Table2, color: '#4ade80' },
  xlsx: { Icon: FileSpreadsheet, color: '#22c55e' },
  xls: { Icon: FileSpreadsheet, color: '#22c55e' },
  // images
  png: { Icon: FileImage, color: '#c084fc' },
  jpg: { Icon: FileImage, color: '#c084fc' },
  jpeg: { Icon: FileImage, color: '#c084fc' },
  gif: { Icon: FileImage, color: '#c084fc' },
  webp: { Icon: FileImage, color: '#c084fc' },
  bmp: { Icon: FileImage, color: '#c084fc' },
  svg: { Icon: FileImage, color: '#f0abfc' },
  avif: { Icon: FileImage, color: '#c084fc' },
  // video
  mp4: { Icon: FileVideo, color: '#fb7185' },
  webm: { Icon: FileVideo, color: '#fb7185' },
  mov: { Icon: FileVideo, color: '#fb7185' },
  m4v: { Icon: FileVideo, color: '#fb7185' },
  mkv: { Icon: FileVideo, color: '#fb7185' },
  avi: { Icon: FileVideo, color: '#fb7185' },
  // archives
  zip: { Icon: FileArchive, color: '#a8a29e' },
  tar: { Icon: FileArchive, color: '#a8a29e' },
  gz: { Icon: FileArchive, color: '#a8a29e' },
  '7z': { Icon: FileArchive, color: '#a8a29e' },
  rar: { Icon: FileArchive, color: '#a8a29e' },
}

function extOf(name: string): string {
  const base = name.split('/').pop() ?? name
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(i + 1).toLowerCase() : ''
}

/** Image extensions browsers render inline — the single source for previews/thumbnails. */
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico'] as const

/** True if a file name is a previewable image. */
export function isImage(name: string): boolean {
  return (IMAGE_EXTS as readonly string[]).includes(extOf(name))
}

/** Video extensions browsers play inline via <video> — the single source for previews. */
export const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'ogv'] as const

/** True if a file name is a previewable video. */
export function isVideo(name: string): boolean {
  return (VIDEO_EXTS as readonly string[]).includes(extOf(name))
}

/** Resolve an icon + color for a file name (or folder). The single source of truth. */
export function fileGlyph(name: string, isDir = false): Glyph {
  if (isDir) return FOLDER
  return BY_EXT[extOf(name)] ?? GENERIC
}

/**
 * A path with no recognizable extension is treated as a folder. Used where we
 * only have a path string (e.g. a Files node's saved `paths`) and no dir flag.
 */
export function looksLikeFolder(path: string): boolean {
  return !/\.[a-z0-9]+$/i.test(path.split('/').pop() ?? path)
}

/** Drop-in glyph component for the four file-list sites + the Files node. */
export function FileGlyphIcon({
  name,
  dir,
  className,
}: {
  name: string
  dir?: boolean
  className?: string
}) {
  const { Icon, color } = fileGlyph(name, dir ?? looksLikeFolder(name))
  return <Icon className={className} style={{ color }} />
}
