import type { Pressure } from '../core/derive'

/** Track color mixed toward the panel background; `pct` = share of the track color. */
export function tint(color: string, pct: number): string {
  return `color-mix(in oklab, ${color} ${pct}%, var(--panel))`
}

export function pressureColor(p: Pressure | 1 | 2 | 3): string {
  return p >= 3 ? 'var(--red)' : p === 2 ? 'var(--orange)' : p === 1 ? 'var(--amber)' : 'var(--muted)'
}

export function levelColor(level: 1 | 2 | 3): string {
  return level === 3 ? 'var(--red)' : level === 2 ? 'var(--orange)' : 'var(--amber)'
}

export function pct(x: number | null | undefined): string {
  return x == null ? '–' : `${Math.round(x * 100)}%`
}

export function cx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ')
}
