import type { FieldOption } from '@/registry/types'

/** Checkbox group for a string[] config value (e.g. a custom agent's tool scope). */
export function MultiSelectField({
  value,
  options,
  onChange,
}: {
  value: string[]
  options: FieldOption[]
  onChange: (v: string[]) => void
}) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }
  return (
    <div className="grid grid-cols-2 gap-1">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <label
            key={o.value}
            className={
              'flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ' +
              (on
                ? 'border-temper/50 bg-temper/15 text-white/90'
                : 'border-white/10 bg-black/30 text-white/55 hover:border-white/20')
            }
          >
            <input
              type="checkbox"
              className="size-3 accent-temper"
              checked={on}
              onChange={() => toggle(o.value)}
            />
            {o.label}
          </label>
        )
      })}
    </div>
  )
}
