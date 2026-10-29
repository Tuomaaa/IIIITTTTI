import type { HHMM, ISODate } from './types'

const DAY = 86_400_000

/** Today as `YYYY-MM-DD`, in `tz` if given, else in the runtime's local zone. */
export function todayIn(tz?: string, now: Date = new Date()): ISODate {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(now)
}

/** Minutes since midnight in `tz` (or local). */
export function nowMinutes(tz?: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

function toUTC(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}

function fromUTC(t: number): ISODate {
  return new Date(t).toISOString().slice(0, 10)
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * DAY)
}

/** `b - a` in whole days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY)
}

/** Inclusive list of days from `a` to `b`. */
export function daysBetween(a: ISODate, b: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let t = toUTC(a), end = toUTC(b); t <= end; t += DAY) out.push(fromUTC(t))
  return out
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(d: ISODate): number {
  return new Date(toUTC(d)).getUTCDay()
}

export const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六']

/** Monday of the week containing `d`. */
export function weekStart(d: ISODate): ISODate {
  return addDays(d, -((weekday(d) + 6) % 7))
}

/** ISO-8601 week number. */
export function isoWeek(d: ISODate): number {
  const t = toUTC(d)
  const dow = (weekday(d) + 6) % 7
  const thursday = t + (3 - dow) * DAY
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1)
  return 1 + Math.floor((thursday - yearStart) / (7 * DAY))
}

export function isValidDate(d: unknown): d is ISODate {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && fromUTC(toUTC(d)) === d
}

export function isValidTime(t: unknown): t is HHMM {
  if (typeof t !== 'string' || !/^\d{2}:\d{2}$/.test(t)) return false
  const [h, m] = t.split(':').map(Number)
  return (h < 24 && m < 60) || (h === 24 && m === 0)
}

export function toMinutes(t: HHMM): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(min: number): HHMM {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** `10/29` */
export function md(d: ISODate): string {
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
}

/** `10/29 周四` */
export function mdw(d: ISODate): string {
  return `${md(d)} 周${WEEKDAY_ZH[weekday(d)]}`
}

/** Human relative label: 今天 / 明天 / 3天后 / 2天前. */
export function relDay(d: ISODate, today: ISODate): string {
  const n = diffDays(today, d)
  if (n === 0) return '今天'
  if (n === 1) return '明天'
  if (n === 2) return '后天'
  if (n === -1) return '昨天'
  return n > 0 ? `${n}天后` : `${-n}天前`
}
