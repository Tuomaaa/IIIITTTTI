// One-line capture syntax, e.g.
//   改 intro #论文 明天            -> todo
//   组会 @14-15:30 #surf周会        -> time block
//   写 related work #论文 3d >11/5 ! -> task (hard deadline)
import { addDays, fromMinutes, weekStart, weekday } from './date'
import type { Block, ISODate, Plan, Task, Todo } from './types'

export type QuickResult =
  | { kind: 'todo'; todo: Omit<Todo, 'id'> }
  | { kind: 'block'; block: Omit<Block, 'id'> }
  | { kind: 'task'; task: Omit<Task, 'id'> }
  | { kind: 'error'; msg: string }

const WD: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }

export function parseDay(tok: string, today: ISODate): ISODate | undefined {
  const rel: Record<string, number> = { 今天: 0, 今: 0, 明天: 1, 明: 1, 后天: 2, 大后天: 3 }
  if (tok in rel) return addDays(today, rel[tok])
  let m = tok.match(/^(下)?(?:周|星期|礼拜)([一二三四五六日天])$/)
  if (m) {
    const target = WD[m[2]]
    if (m[1]) return addDays(weekStart(addDays(today, 7)), (target + 6) % 7)
    return addDays(today, (target - weekday(today) + 7) % 7)
  }
  m = tok.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = tok.match(/^(\d{1,2})[/.-](\d{1,2})$/)
  if (m) {
    let year = Number(today.slice(0, 4))
    const d = `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
    // "1/5" typed in late December means next January.
    if (d < addDays(today, -60)) year++
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  m = tok.match(/^\+(\d+)$/)
  if (m) return addDays(today, Number(m[1]))
  return undefined
}

function parseClock(s: string): number | undefined {
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 24 || min > 59) return undefined
  return h * 60 + min
}

export function findTrack(plan: Plan, q: string) {
  const s = q.toLowerCase()
  return (
    plan.tracks.find((t) => t.id.toLowerCase() === s) ??
    plan.tracks.find((t) => t.name.toLowerCase() === s) ??
    plan.tracks.find((t) => t.name.toLowerCase().includes(s) || t.id.toLowerCase().includes(s))
  )
}

export function parseQuick(input: string, plan: Plan, today: ISODate): QuickResult {
  const words: string[] = []
  let date: ISODate | undefined
  let end: ISODate | undefined
  let dur: number | undefined
  let hard = false
  let est: number | undefined
  let time: { s: number; e?: number } | undefined
  let trackId: string | undefined
  let backlog = false

  for (const tok of input.trim().split(/\s+/).filter(Boolean)) {
    let m: RegExpMatchArray | null
    if (tok.startsWith('#') && tok.length > 1) {
      const tr = findTrack(plan, tok.slice(1))
      if (!tr) return { kind: 'error', msg: `没有叫「${tok.slice(1)}」的线程` }
      trackId = tr.id
    } else if (tok === '!' || tok === '！') hard = true
    else if (tok === '?' || tok === '？') backlog = true
    else if ((m = tok.match(/^(\d+)[dD天]$/))) dur = Number(m[1])
    else if ((m = tok.match(/^~(\d+(?:\.\d+)?)(m|min|h)$/))) est = Math.round(Number(m[1]) * (m[2] === 'h' ? 60 : 1))
    else if ((m = tok.match(/^[@＠](\d{1,2}(?::\d{2})?)(?:-(\d{1,2}(?::\d{2})?))?$/))) {
      const s = parseClock(m[1])
      const e = m[2] ? parseClock(m[2]) : undefined
      if (s === undefined || (m[2] && e === undefined)) return { kind: 'error', msg: `看不懂时间 ${tok}` }
      time = { s, e }
    } else if (tok.startsWith('>') || tok.startsWith('＞')) {
      end = parseDay(tok.slice(1), today)
      if (!end) return { kind: 'error', msg: `看不懂截止日 ${tok}` }
    } else {
      const d = parseDay(tok, today)
      if (d && !date) date = d
      else words.push(tok)
    }
  }

  const title = words.join(' ')
  if (!title) return { kind: 'error', msg: '缺标题' }

  if (dur !== undefined || end) {
    if (!trackId) return { kind: 'error', msg: '建 task 需要指定 #线程' }
    const start = date ?? today
    const taskEnd = end ?? addDays(start, Math.max(1, dur ?? 1) - 1)
    if (taskEnd < start) return { kind: 'error', msg: '截止日早于开始日' }
    const task: Omit<Task, 'id'> = { trackId, title, start, end: taskEnd }
    if (hard) task.hard = true
    if (dur && end) task.focus = Array.from({ length: Math.min(dur, 60) }, (_, i) => addDays(start, i)).filter((d) => d <= taskEnd)
    return { kind: 'task', task }
  }

  if (time) {
    const e = time.e ?? Math.min(24 * 60, time.s + (est ?? 60))
    if (e <= time.s) return { kind: 'error', msg: '结束时间要晚于开始时间' }
    const block: Omit<Block, 'id'> = {
      date: date ?? today,
      start: fromMinutes(time.s),
      end: fromMinutes(e),
      title,
      kind: 'focus',
    }
    if (trackId) block.trackId = trackId
    return { kind: 'block', block }
  }

  const todo: Omit<Todo, 'id'> = { title }
  if (!backlog) todo.date = date ?? today
  if (trackId) todo.trackId = trackId
  if (est) todo.est = est
  return { kind: 'todo', todo }
}

export function describeQuick(r: QuickResult, plan: Plan): string {
  const tn = (id?: string) => (id ? plan.tracks.find((t) => t.id === id)?.name ?? id : '')
  switch (r.kind) {
    case 'error':
      return r.msg
    case 'todo':
      return `todo · ${r.todo.date ?? 'backlog'}${r.todo.trackId ? ` · ${tn(r.todo.trackId)}` : ''}${r.todo.est ? ` · ${r.todo.est}min` : ''}`
    case 'block':
      return `时间块 · ${r.block.date} ${r.block.start}-${r.block.end}${r.block.trackId ? ` · ${tn(r.block.trackId)}` : ''}`
    case 'task':
      return `task · ${tn(r.task.trackId)} · ${r.task.start} → ${r.task.end}${r.task.hard ? ' · 硬ddl' : ''}`
  }
}
