import type { Pressure } from '../core/derive'

/** Track color mixed toward the panel background; `pct` = share of the track color. */
export function tint(color: string, pct: number): string {
  return `color-mix(in oklab, ${color} ${pct}%, var(--panel))`
}

/** Light, theme-independent version of a track color for bar windows and blocks (always paired with dark ink). */
export function pastel(color: string, pct = 34): string {
  return `color-mix(in srgb, ${color} ${pct}%, #ffffff)`
}

/** Sticker fill + text color for a slip pressure level / overdue. */
export function stickerStyle(level: 1 | 2 | 3 | 'overdue'): { background: string; color: string } {
  if (level === 'overdue' || level === 3) return { background: 'var(--sticker-red)', color: '#fff' }
  if (level === 2) return { background: 'var(--sticker-orange)', color: 'var(--bar-ink)' }
  return { background: 'var(--sticker-yellow)', color: 'var(--bar-ink)' }
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
