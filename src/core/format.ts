// Stable, compact JSON: a value stays on one line when it fits in `width`,
// otherwise objects/arrays break one entry per line. Keeps plan.json diffs small
// (usually one line per changed record) and easy for an agent to read.
export function formatJSON(value: unknown, width = 160): string {
  return fmt(value, '', 0, width) + '\n'
}

function fmt(v: unknown, indent: string, prefix: number, width: number): string {
  const inline = oneLine(v)
  if (v === null || typeof v !== 'object' || indent.length + prefix + inline.length <= width) return inline
  const inner = indent + '  '
  if (Array.isArray(v)) {
    if (!v.length) return '[]'
    return `[\n${v.map((x) => inner + fmt(x, inner, 0, width)).join(',\n')}\n${indent}]`
  }
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined)
  if (!entries.length) return '{}'
  return `{\n${entries
    .map(([k, x]) => {
      const key = `${JSON.stringify(k)}: `
      return inner + key + fmt(x, inner, key.length, width)
    })
    .join(',\n')}\n${indent}}`
}

function oneLine(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return `[${v.map(oneLine).join(', ')}]`
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined)
  if (!entries.length) return '{}'
  return `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${oneLine(x)}`).join(', ')} }`
}
