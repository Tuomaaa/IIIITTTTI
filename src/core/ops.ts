// Pure edits on a Plan. Every op returns a new Plan and never mutates its input.
// The web UI replays ops on top of the latest remote copy when a write conflicts,
// so ops must be written in terms of ids, not array positions.
import { addDays, daysBetween, diffDays } from './date'
import { DEFAULTS, type TaskView } from './derive'
import type { Block, ISODate, Milestone, Plan, Slip, Task, Todo, Track } from './types'

export class OpError extends Error {}

function clone(plan: Plan): Plan {
  return structuredClone(plan)
}

function touch(plan: Plan): Plan {
  plan.meta.updatedAt = new Date().toISOString()
  return plan
}

export function newId(prefix: string, plan: Plan): string {
  const taken = new Set([
    ...plan.tracks.map((x) => x.id),
    ...plan.tasks.map((x) => x.id),
    ...plan.milestones.map((x) => x.id),
    ...plan.todos.map((x) => x.id),
    ...plan.blocks.map((x) => x.id),
  ])
  for (;;) {
    const id = `${prefix}-${Math.random().toString(36).slice(2, 6)}`
    if (!taken.has(id)) return id
  }
}

function findTask(plan: Plan, id: string): Task {
  const t = plan.tasks.find((x) => x.id === id)
  if (!t) throw new OpError(`找不到 task ${id}`)
  return t
}

function findTodo(plan: Plan, id: string): Todo {
  const t = plan.todos.find((x) => x.id === id)
  if (!t) throw new OpError(`找不到 todo ${id}`)
  return t
}

export function toggleTodo(plan: Plan, id: string, today: ISODate): Plan {
  const p = clone(plan)
  const t = findTodo(p, id)
  t.done = !t.done
  if (t.done) {
    t.doneAt = today
    // A rolled-over todo counts as done on the day it was actually done.
    if (t.date && t.date < today) {
      t.origDate ??= t.date
      t.date = today
    }
  } else delete t.doneAt
  return touch(p)
}

export function addTodo(plan: Plan, todo: Omit<Todo, 'id'> & { id?: string }): Plan {
  const p = clone(plan)
  const { id, ...rest } = todo
  p.todos.push({ id: id ?? newId('td', p), ...rest })
  return touch(p)
}

export function addTask(plan: Plan, task: Omit<Task, 'id'> & { id?: string }): Plan {
  const p = clone(plan)
  if (!p.tracks.some((t) => t.id === task.trackId)) throw new OpError(`找不到 track ${task.trackId}`)
  if (task.end < task.start) throw new OpError('end 早于 start')
  const { id, ...rest } = task
  p.tasks.push({ id: id ?? newId('tk', p), ...rest })
  return touch(p)
}

export function addBlock(plan: Plan, block: Omit<Block, 'id'> & { id?: string }): Plan {
  const p = clone(plan)
  if (block.end <= block.start) throw new OpError('block 的 end 要晚于 start')
  const { id, ...rest } = block
  p.blocks.push({ id: id ?? newId('bk', p), ...rest })
  return touch(p)
}

export function addMilestone(plan: Plan, m: Omit<Milestone, 'id'> & { id?: string }): Plan {
  const p = clone(plan)
  const { id, ...rest } = m
  p.milestones.push({ id: id ?? newId('ms', p), ...rest })
  return touch(p)
}

export function addTrack(plan: Plan, t: Omit<Track, 'id'> & { id?: string }): Plan {
  const p = clone(plan)
  const { id, ...rest } = t
  p.tracks.push({ id: id ?? newId('tr', p), ...rest })
  return touch(p)
}

export interface PushSuggestion {
  /** Proposed new end. */
  to: ISODate
  /** Days of work we think are left. */
  remaining: number
  /** Whether `remaining` fits in a small push; if not, the task should be re-planned or split. */
  fits: boolean
}

/**
 * How far to push an overdue (or about to be overdue) task.
 * Remaining work = planned days x (1 - progress), at least 1. A small push covers at most
 * `maxPushDays` of it, counted from today; anything bigger is flagged for re-planning.
 */
export function suggestPush(tv: TaskView, today: ISODate, maxPushDays: number = DEFAULTS.maxPushDays): PushSuggestion {
  const { task } = tv
  const planned = tv.focus.length || diffDays(task.start, task.end) + 1
  const remaining = Math.max(1, Math.ceil(planned * (1 - (tv.progress ?? 0))))
  const days = Math.min(remaining, maxPushDays)
  const from = task.end < today ? today : addDays(task.end, 1)
  return { to: addDays(from, days - 1), remaining, fits: remaining <= maxPushDays }
}

export interface PushOptions {
  today: ISODate
  reason?: string
  by?: Slip['by']
  /** Mark the newly added days as focus days. Default true. */
  focus?: boolean
}

export function pushTask(plan: Plan, id: string, to: ISODate, opts: PushOptions): Plan {
  const p = clone(plan)
  const t = findTask(p, id)
  if (t.hard) throw new OpError(`「${t.title}」是硬 ddl，不能推。只能完成、砍 scope 或标记 missed。`)
  if (to <= t.end) throw new OpError(`新的 end ${to} 不晚于当前 end ${t.end}`)
  t.baseline ??= t.end
  t.slips = [...(t.slips ?? []), { at: opts.today, from: t.end, to, ...(opts.reason ? { reason: opts.reason } : {}), by: opts.by ?? 'user' }]
  if (opts.focus !== false) {
    const first = t.end < opts.today ? opts.today : addDays(t.end, 1)
    if (first <= to) t.focus = [...new Set([...(t.focus ?? []), ...daysBetween(first, to)])].sort()
  }
  t.end = to
  return touch(p)
}

export function setProgress(plan: Plan, id: string, progress: number): Plan {
  const p = clone(plan)
  findTask(p, id).progress = Math.max(0, Math.min(1, Math.round(progress * 100) / 100))
  return touch(p)
}

export function setTaskDone(plan: Plan, id: string, done: boolean, today: ISODate): Plan {
  const p = clone(plan)
  const t = findTask(p, id)
  t.done = done
  if (done) {
    t.doneAt = today
    t.progress = 1
  } else delete t.doneAt
  return touch(p)
}

export function setParked(plan: Plan, id: string, parked: boolean): Plan {
  const p = clone(plan)
  const t = findTask(p, id)
  if (parked) t.parked = true
  else delete t.parked
  return touch(p)
}

export function setFocus(plan: Plan, id: string, days: ISODate[]): Plan {
  const p = clone(plan)
  findTask(p, id).focus = [...new Set(days)].sort()
  return touch(p)
}

export function setMilestoneDone(plan: Plan, id: string, done: boolean): Plan {
  const p = clone(plan)
  const m = p.milestones.find((x) => x.id === id)
  if (!m) throw new OpError(`找不到 milestone ${id}`)
  m.done = done
  return touch(p)
}

/** Reschedule a todo; `date` undefined moves it to the backlog. The first planned day is kept in `origDate`. */
export function setTodoDate(plan: Plan, id: string, date: ISODate | undefined): Plan {
  const p = clone(plan)
  const t = findTodo(p, id)
  if (t.date && t.date !== date) t.origDate ??= t.date
  if (date) t.date = date
  else delete t.date
  return touch(p)
}

/** Move unfinished past todos to `today`, keeping their first planned day in `origDate`. */
export function rollover(plan: Plan, today: ISODate): { plan: Plan; moved: string[] } {
  const p = clone(plan)
  const moved: string[] = []
  for (const t of p.todos) {
    if (!t.done && t.date && t.date < today) {
      t.origDate ??= t.date
      t.date = today
      moved.push(t.id)
    }
  }
  return { plan: moved.length ? touch(p) : plan, moved }
}

export function remove(plan: Plan, id: string): Plan {
  const p = clone(plan)
  const before =
    p.tracks.length + p.tasks.length + p.milestones.length + p.todos.length + p.blocks.length
  p.tracks = p.tracks.filter((x) => x.id !== id)
  p.tasks = p.tasks.filter((x) => x.id !== id)
  p.milestones = p.milestones.filter((x) => x.id !== id)
  p.todos = p.todos.filter((x) => x.id !== id)
  p.blocks = p.blocks.filter((x) => x.id !== id)
  const after =
    p.tracks.length + p.tasks.length + p.milestones.length + p.todos.length + p.blocks.length
  if (before === after) throw new OpError(`找不到 ${id}`)
  return touch(p)
}
