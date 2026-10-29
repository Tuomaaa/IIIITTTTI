// Pure, read-only views over a Plan for a given "today". Shared by the web UI and the CLI.
import { addDays, daysBetween, diffDays, toMinutes } from './date'
import type { Block, ISODate, Milestone, Plan, Task, Todo, Track } from './types'

export const DEFAULTS = {
  dayStart: '08:00',
  dayEnd: '24:00',
  maxParallel: 4,
  staleAfterDays: 3,
  maxPushDays: 2,
} as const

export function settings(plan: Plan) {
  return { ...DEFAULTS, ...stripUndefined(plan.meta) }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

export type Phase = 'done' | 'parked' | 'overdue' | 'active' | 'upcoming'

/** 0 = fine, 1 = pushed once, 2 = pushed twice or just overdue, 3 = needs a decision. */
export type Pressure = 0 | 1 | 2 | 3

export interface TaskView {
  task: Task
  track?: Track
  milestone?: Milestone
  phase: Phase
  /** Days past `end`; only > 0 when overdue. */
  overdueDays: number
  pushCount: number
  /** Total days the end date moved across all pushes. */
  slipDays: number
  pressure: Pressure
  /** Sorted union of planned focus days, block days and dated linked todos. */
  focus: ISODate[]
  focusToday: boolean
  nextFocus?: ISODate
  /** Active or overdue, but nothing planned from today on. */
  unscheduled: boolean
  progress: number | null
  todoDone: number
  todoTotal: number
  /** Last day the bar is drawn to: `end`, or today while overdue. */
  visualEnd: ISODate
}

export interface TodoView {
  todo: Todo
  track?: Track
  task?: Task
  /** Day it shows up on: unfinished past todos roll over to today. */
  showOn?: ISODate
  /** Days since it was first planned, when unfinished and in the past. */
  age: number
  rolled: boolean
  stale: boolean
}

export interface TrackView {
  track: Track
  tasks: TaskView[]
  lanes: TaskView[][]
  milestones: Milestone[]
  /** Next concrete thing to do on this thread. */
  next?: { title: string; date?: ISODate; kind: 'todo' | 'task' }
  activeCount: number
  overdueCount: number
  slipDays: number
  pushCount: number
  /** Sort key: lower = more relevant right now. */
  rank: number
  nextMilestone?: Milestone
}

export interface DayLoad {
  /** Distinct tasks with a focus on this day. */
  tasks: string[]
  /** Minutes of scheduled blocks. */
  blockMin: number
  todos: number
}

export type InboxKind =
  | 'task-overdue'
  | 'milestone-overdue'
  | 'todo-stale'
  | 'task-pushed'
  | 'deadline-soon'
  | 'unscheduled'

export interface InboxItem {
  kind: InboxKind
  level: 1 | 2 | 3
  id: string
  title: string
  detail: string
  trackId?: string
  date?: ISODate
}

export interface PlanView {
  today: ISODate
  tracks: TrackView[]
  taskById: Map<string, TaskView>
  trackById: Map<string, Track>
  todos: TodoView[]
  load: Map<ISODate, DayLoad>
  inbox: InboxItem[]
  stats: Stats
}

export interface Stats {
  active: number
  focusToday: number
  todosToday: { done: number; total: number }
  overdue: number
  stale: number
  /** Pushes decided in the last 7 days. */
  weekSlips: { count: number; days: number }
  totalSlipDays: number
  nextMilestone?: Milestone
}

export function slipDaysOf(task: Task): number {
  return (task.slips ?? []).reduce((s, x) => s + Math.max(0, diffDays(x.from, x.to)), 0)
}

export function taskPhase(task: Task, today: ISODate): Phase {
  if (task.done) return 'done'
  if (task.parked) return 'parked'
  if (task.end < today) return 'overdue'
  if (task.start <= today) return 'active'
  return 'upcoming'
}

export function pressureOf(pushCount: number, overdueDays: number, hard: boolean): Pressure {
  if (pushCount >= 3 || overdueDays >= 3 || (hard && overdueDays > 0)) return 3
  if (pushCount === 2 || overdueDays > 0) return 2
  if (pushCount === 1) return 1
  return 0
}

export function todoView(todo: Todo, today: ISODate, staleAfter: number, plan?: Plan): TodoView {
  const task = todo.taskId ? plan?.tasks.find((t) => t.id === todo.taskId) : undefined
  const trackId = todo.trackId ?? task?.trackId
  const track = trackId ? plan?.tracks.find((t) => t.id === trackId) : undefined
  const first = todo.origDate ?? todo.date
  const late = !todo.done && !!todo.date && todo.date < today
  const age = !todo.done && first && first < today ? diffDays(first, today) : 0
  return {
    todo,
    task,
    track,
    showOn: late ? today : todo.date,
    age,
    rolled: late || (!todo.done && !!todo.origDate && todo.origDate < (todo.date ?? today)),
    stale: age >= staleAfter,
  }
}

export function buildView(plan: Plan, today: ISODate): PlanView {
  const cfg = settings(plan)
  const trackById = new Map(plan.tracks.map((t) => [t.id, t]))
  const msById = new Map(plan.milestones.map((m) => [m.id, m]))

  const todosByTask = groupBy(plan.todos.filter((t) => t.taskId), (t) => t.taskId!)
  const blocksByTask = groupBy(plan.blocks.filter((b) => b.taskId), (b) => b.taskId!)

  const taskById = new Map<string, TaskView>()
  for (const task of plan.tasks) {
    const phase = taskPhase(task, today)
    const overdueDays = phase === 'overdue' ? diffDays(task.end, today) : 0
    const pushCount = task.slips?.length ?? 0
    const linked = todosByTask.get(task.id) ?? []
    const focusSet = new Set<ISODate>(task.focus ?? [])
    for (const b of blocksByTask.get(task.id) ?? []) focusSet.add(b.date)
    for (const t of linked) if (t.date) focusSet.add(t.date)
    const focus = [...focusSet].sort()
    const todoDone = linked.filter((t) => t.done).length
    const progress =
      task.done ? 1 : task.progress ?? (linked.length ? todoDone / linked.length : null)
    const nextFocus = focus.find((d) => d >= today)
    const live = phase === 'active' || phase === 'overdue'
    taskById.set(task.id, {
      task,
      track: trackById.get(task.trackId),
      milestone: task.milestoneId ? msById.get(task.milestoneId) : undefined,
      phase,
      overdueDays,
      pushCount,
      slipDays: slipDaysOf(task),
      pressure: phase === 'done' || phase === 'parked' ? 0 : pressureOf(pushCount, overdueDays, !!task.hard),
      focus,
      focusToday: live && focusSet.has(today),
      nextFocus,
      unscheduled: live && !nextFocus,
      progress,
      todoDone,
      todoTotal: linked.length,
      visualEnd: phase === 'overdue' ? today : task.end,
    })
  }

  const todos = plan.todos.map((t) => todoView(t, today, cfg.staleAfterDays, plan))

  const tracks = plan.tracks
    .filter((t) => !t.archived)
    .map((track) => trackView(track, plan, taskById, todos, today))
    .sort((a, b) => a.rank - b.rank || plan.tracks.indexOf(a.track) - plan.tracks.indexOf(b.track))

  const load = dayLoad(plan, taskById, todos)
  const inbox = buildInbox(plan, taskById, todos, today)
  const stats = buildStats(plan, taskById, todos, inbox, today)
  return { today, tracks, taskById, trackById, todos, load, inbox, stats }
}

function trackView(
  track: Track,
  plan: Plan,
  taskById: Map<string, TaskView>,
  todos: TodoView[],
  today: ISODate,
): TrackView {
  const tasks = plan.tasks
    .filter((t) => t.trackId === track.id)
    .map((t) => taskById.get(t.id)!)
    .sort((a, b) => a.task.start.localeCompare(b.task.start) || a.task.end.localeCompare(b.task.end))
  const milestones = plan.milestones
    .filter((m) => m.trackId === track.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  const live = tasks.filter((t) => t.phase === 'active' || t.phase === 'overdue')
  const trackTodos = todos
    .filter((t) => !t.todo.done && (t.track?.id === track.id))
    .sort((a, b) => (a.showOn ?? '9999').localeCompare(b.showOn ?? '9999'))

  let next: TrackView['next']
  const nt = trackTodos[0]
  if (nt) next = { title: nt.todo.title, date: nt.showOn, kind: 'todo' }
  else {
    const nextTask =
      [...live].sort((a, b) => (a.nextFocus ?? '9999').localeCompare(b.nextFocus ?? '9999'))[0] ??
      tasks.find((t) => t.phase === 'upcoming')
    if (nextTask)
      next = {
        title: nextTask.task.title,
        date: nextTask.nextFocus ?? (nextTask.phase === 'upcoming' ? nextTask.task.start : undefined),
        kind: 'task',
      }
  }

  const soonFocus = tasks.some((t) => t.nextFocus && diffDays(today, t.nextFocus) <= 3 && t.phase !== 'done')
  const upcoming = tasks.some((t) => t.phase === 'upcoming')
  const rank = track.paused
    ? 5
    : live.some((t) => t.focusToday || t.phase === 'overdue')
      ? 0
      : live.length
        ? 1
        : soonFocus
          ? 2
          : upcoming
            ? 3
            : 4

  return {
    track,
    tasks,
    lanes: packLanes(tasks),
    milestones,
    next,
    activeCount: live.length,
    overdueCount: tasks.filter((t) => t.phase === 'overdue').length,
    slipDays: tasks.reduce((s, t) => s + t.slipDays, 0),
    pushCount: tasks.reduce((s, t) => s + t.pushCount, 0),
    rank,
    nextMilestone: milestones.find((m) => !m.done && m.date >= today),
  }
}

/**
 * Greedy interval packing so non-overlapping tasks share a row.
 * `pad` reserves extra days after a task (e.g. for a badge drawn past its end).
 */
export function packLanes(tasks: TaskView[], pad: (t: TaskView) => number = () => 0): TaskView[][] {
  const lanes: TaskView[][] = []
  const laneEnd: ISODate[] = []
  for (const t of tasks) {
    const start = t.focus[0] && t.focus[0] < t.task.start ? t.focus[0] : t.task.start
    let i = laneEnd.findIndex((e) => e < start)
    if (i === -1) {
      i = lanes.length
      lanes.push([])
      laneEnd.push('')
    }
    lanes[i].push(t)
    const lastFocus = t.focus[t.focus.length - 1]
    const end = lastFocus && lastFocus > t.visualEnd ? lastFocus : t.visualEnd
    laneEnd[i] = addDays(end, pad(t))
  }
  return lanes
}

function dayLoad(plan: Plan, taskById: Map<string, TaskView>, todos: TodoView[]): Map<ISODate, DayLoad> {
  const load = new Map<ISODate, DayLoad>()
  const at = (d: ISODate) => {
    let l = load.get(d)
    if (!l) load.set(d, (l = { tasks: [], blockMin: 0, todos: 0 }))
    return l
  }
  for (const tv of taskById.values()) {
    if (tv.phase === 'done' || tv.phase === 'parked') continue
    for (const d of tv.focus) at(d).tasks.push(tv.task.id)
  }
  for (const b of plan.blocks) at(b.date).blockMin += Math.max(0, toMinutes(b.end) - toMinutes(b.start))
  for (const t of todos) if (t.showOn && !t.todo.done) at(t.showOn).todos++
  return load
}

function buildInbox(
  plan: Plan,
  taskById: Map<string, TaskView>,
  todos: TodoView[],
  today: ISODate,
): InboxItem[] {
  const items: InboxItem[] = []
  for (const tv of taskById.values()) {
    const { task } = tv
    if (tv.phase === 'overdue') {
      items.push({
        kind: 'task-overdue',
        level: tv.pressure >= 3 ? 3 : 2,
        id: task.id,
        title: task.title,
        detail: `${task.hard ? '硬 ddl ' : ''}过期 ${tv.overdueDays} 天${tv.pushCount ? `，已推 ${tv.pushCount} 次` : ''}`,
        trackId: task.trackId,
        date: task.end,
      })
    } else if (tv.pushCount >= 3 && tv.phase !== 'done' && tv.phase !== 'parked') {
      items.push({
        kind: 'task-pushed',
        level: 3,
        id: task.id,
        title: task.title,
        detail: `已推 ${tv.pushCount} 次共 ${tv.slipDays} 天，需要拆小或砍 scope`,
        trackId: task.trackId,
        date: task.end,
      })
    }
    if (tv.unscheduled && tv.phase === 'active') {
      items.push({
        kind: 'unscheduled',
        level: 1,
        id: task.id,
        title: task.title,
        detail: `进行中但今天起没有排任何一天，${diffDays(today, task.end)} 天后到期`,
        trackId: task.trackId,
        date: task.end,
      })
    }
    if (task.hard && (tv.phase === 'active' || tv.phase === 'upcoming')) {
      const left = diffDays(today, task.end)
      if (left <= 3)
        items.push({
          kind: 'deadline-soon',
          level: left <= 1 ? 2 : 1,
          id: task.id,
          title: task.title,
          detail: `硬 ddl ${left === 0 ? '就是今天' : `还剩 ${left} 天`}`,
          trackId: task.trackId,
          date: task.end,
        })
    }
  }
  for (const m of plan.milestones) {
    if (m.done) continue
    const left = diffDays(today, m.date)
    if (left < 0)
      items.push({
        kind: 'milestone-overdue',
        level: m.hard ? 3 : 2,
        id: m.id,
        title: m.title,
        detail: `${m.hard ? '硬 ddl' : 'milestone'} 已过 ${-left} 天，还没标完成`,
        trackId: m.trackId,
        date: m.date,
      })
    else if (m.hard && left <= 3)
      items.push({
        kind: 'deadline-soon',
        level: left <= 1 ? 2 : 1,
        id: m.id,
        title: m.title,
        detail: `硬 ddl ${left === 0 ? '就是今天' : `还剩 ${left} 天`}`,
        trackId: m.trackId,
        date: m.date,
      })
  }
  for (const t of todos) {
    if (!t.stale) continue
    items.push({
      kind: 'todo-stale',
      level: t.age >= 7 ? 3 : 2,
      id: t.todo.id,
      title: t.todo.title,
      detail: `todo 拖了 ${t.age} 天（从 ${t.todo.origDate ?? t.todo.date} 起）`,
      trackId: t.track?.id,
      date: t.todo.origDate ?? t.todo.date,
    })
  }
  return items.sort((a, b) => b.level - a.level || (a.date ?? '').localeCompare(b.date ?? ''))
}

function buildStats(
  plan: Plan,
  taskById: Map<string, TaskView>,
  todos: TodoView[],
  inbox: InboxItem[],
  today: ISODate,
): Stats {
  const tvs = [...taskById.values()]
  const weekAgo = addDays(today, -6)
  let count = 0
  let days = 0
  for (const t of plan.tasks)
    for (const s of t.slips ?? [])
      if (s.at >= weekAgo && s.at <= today) {
        count++
        days += Math.max(0, diffDays(s.from, s.to))
      }
  const todayTodos = todos.filter((t) => t.showOn === today || (t.todo.done && t.todo.doneAt === today))
  return {
    active: tvs.filter((t) => t.phase === 'active' || t.phase === 'overdue').length,
    focusToday: tvs.filter((t) => t.focusToday).length,
    todosToday: { done: todayTodos.filter((t) => t.todo.done).length, total: todayTodos.length },
    overdue: inbox.filter((i) => i.kind === 'task-overdue' || i.kind === 'milestone-overdue').length,
    stale: inbox.filter((i) => i.kind === 'todo-stale').length,
    weekSlips: { count, days },
    totalSlipDays: tvs.reduce((s, t) => s + t.slipDays, 0),
    nextMilestone: plan.milestones
      .filter((m) => !m.done && m.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0],
  }
}

export function blocksOn(plan: Plan, date: ISODate): Block[] {
  return plan.blocks.filter((b) => b.date === date).sort((a, b) => a.start.localeCompare(b.start))
}

/** Lay out overlapping blocks in side-by-side columns. */
export function layoutBlocks(blocks: Block[]): { block: Block; col: number; cols: number }[] {
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end))
  const out: { block: Block; col: number; cols: number }[] = []
  let cluster: { block: Block; col: number; cols: number }[] = []
  let clusterEnd = -1
  const colEnds: number[] = []
  const flush = () => {
    const n = Math.max(1, ...cluster.map((c) => c.col + 1))
    for (const c of cluster) c.cols = n
    out.push(...cluster)
    cluster = []
    colEnds.length = 0
  }
  for (const block of sorted) {
    const s = toMinutes(block.start)
    const e = toMinutes(block.end)
    if (s >= clusterEnd && cluster.length) flush()
    let col = colEnds.findIndex((end) => end <= s)
    if (col === -1) col = colEnds.length
    colEnds[col] = e
    cluster.push({ block, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, e)
  }
  if (cluster.length) flush()
  return out
}

/** Days a task's window covers, for rendering. */
export function taskDays(tv: TaskView): ISODate[] {
  return daysBetween(tv.task.start, tv.visualEnd)
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    const arr = m.get(k)
    if (arr) arr.push(x)
    else m.set(k, [x])
  }
  return m
}
