/** Substitute {{var}} tokens from a context map; unknown vars become ''. */
export function resolvePrompt(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => ctx[key] ?? '')
}
