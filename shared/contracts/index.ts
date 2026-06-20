import { z } from 'zod'

export * from './common'
export * from './infoCard'
export * from './forge'
export * from './temper'
export * from './prose'
export * from './run'

/**
 * Convert a Zod schema to a JSON Schema for the Agent SDK's
 * `outputFormat: { type: 'json_schema', schema }`. Single helper so the SAME
 * contract drives Inspector forms (frontend) and structured-output enforcement
 * (backend).
 */
export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>
}
