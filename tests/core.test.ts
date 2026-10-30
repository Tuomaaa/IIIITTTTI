import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CmdError, parseArgv, runCommand } from '../src/core/commands'
import { addDays, diffDays, isoWeek, isValidDate, isValidTime, todayIn, weekStart } from '../src/core/date'
import { archivedTrackView, buildView, layoutBlocks, pressureOf, taskPhase } from '../src/core/derive'
import { packRow } from '../src/core/layout'
import { formatJSON } from '../src/core/format'
import { addTask, OpError, pushTask, remove, rollover, setTrackFlags, suggestPush, toggleTodo } from '../src/core/ops'
import { parseDay, parseQuick } from '../src/core/quickadd'
import type { Plan, Task } from '../src/core/types'
import { validatePlan } from '../src/core/validate'

const TODAY = '2026-10-29' // Thursday

function base(): Plan {
  return {
    version: 1,
    meta: {},
    tracks: [
      { id: 'a', name: 'SURF · 实验', color: '#10b981' },
      { id: 'b', name: '课程', color: '#f97316' },
    ],
    tasks: [],
    milestones: [],
    todos: [],
    blocks: [],
  }
}

function task(p: Partial<Task> & Pick<Task, 'id'>): Task {
  return { trackId: 'a', title: p.id, start: '2026-10-26', end: '2026-10-30', ...p }
}

describe('date', () => {
  it('does calendar math across month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(diffDays('2026-10-29', '2026-11-04')).toBe(6)
    expect(weekStart('2026-10-29')).toBe('2026-10-26')
    expect(isoWeek('2026-10-29')).toBe(44)
  })
  it('validates formats', () => {
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026-02-28')).toBe(true)
    expect(isValidTime('24:00')).toBe(true)
    expect(isValidTime('24:30')).toBe(false)
  })
  it('computes today in a time zone', () => {
    const at = new Date('2026-10-29T03:00:00Z')
    expect(todayIn('America/Indiana/Indianapolis', at)).toBe('2026-10-28')
    expect(todayIn('Asia/Shanghai', at)).toBe('2026-10-29')
  })
})

describe('derive', () => {
  it('classifies phases', () => {
    expect(taskPhase(task({ id: 't' }), TODAY)).toBe('active')
    expect(taskPhase(task({ id: 't', end: '2026-10-28' }), TODAY)).toBe('overdue')
    expect(taskPhase(task({ id: 't', start: '2026-11-01', end: '2026-11-02' }), TODAY)).toBe('upcoming')
    expect(taskPhase(task({ id: 't', end: '2026-10-28', done: true }), TODAY)).toBe('done')
    expect(taskPhase(task({ id: 't', end: '2026-10-28', parked: true }), TODAY)).toBe('parked')
  })

  it('escalates pressure with pushes and overdue days', () => {
    expect(pressureOf(0, 0, false)).toBe(0)
    expect(pressureOf(1, 0, false)).toBe(1)
    expect(pressureOf(2, 0, false)).toBe(2)
    expect(pressureOf(0, 1, false)).toBe(2)
    expect(pressureOf(3, 0, false)).toBe(3)
    expect(pressureOf(0, 3, false)).toBe(3)
    expect(pressureOf(0, 1, true)).toBe(3)
  })

  it('unions focus days from the task, its blocks and its dated todos; derives progress from todos', () => {
    const p = base()
    p.tasks.push(task({ id: 't', focus: ['2026-10-27'] }))
    p.blocks.push({ id: 'b1', date: '2026-10-29', start: '09:00', end: '10:00', title: 'x', taskId: 't' })
    p.todos.push({ id: 'd1', title: 'x', date: '2026-10-30', taskId: 't', done: true })
    p.todos.push({ id: 'd2', title: 'y', taskId: 't' })
    const tv = buildView(p, TODAY).taskById.get('t')!
    expect(tv.focus).toEqual(['2026-10-27', '2026-10-29', '2026-10-30'])
    expect(tv.focusToday).toBe(true)
    expect(tv.progress).toBe(0.5)
  })

  it('rolls unfinished past todos onto today and marks them stale after 3 days', () => {
    const p = base()
    p.todos.push({ id: 'd1', title: 'old', date: '2026-10-26' })
    p.todos.push({ id: 'd2', title: 'yesterday', date: '2026-10-28' })
    p.todos.push({ id: 'd3', title: 'rolled before', date: '2026-10-29', origDate: '2026-10-25' })
    const v = buildView(p, TODAY)
    const byId = Object.fromEntries(v.todos.map((t) => [t.todo.id, t]))
    expect(byId.d1.showOn).toBe(TODAY)
    expect(byId.d1.age).toBe(3)
    expect(byId.d1.stale).toBe(true)
    expect(byId.d2.stale).toBe(false)
    expect(byId.d3.age).toBe(4)
    expect(byId.d3.stale).toBe(true)
    expect(v.inbox.filter((i) => i.kind === 'todo-stale').map((i) => i.id).sort()).toEqual(['d1', 'd3'])
  })

  it('does not count rescheduled-to-later or backlog todos as stale', () => {
    const p = base()
    p.todos.push({ id: 'later', title: 'x', date: '2026-10-30', origDate: '2026-10-20' })
    p.todos.push({ id: 'parked', title: 'y', origDate: '2026-10-20' })
    const v = buildView(p, TODAY)
    expect(v.todos.every((t) => !t.stale)).toBe(true)
    const tomorrow = buildView(p, '2026-10-30').todos.find((t) => t.todo.id === 'later')!
    expect(tomorrow.stale).toBe(true)
    expect(tomorrow.age).toBe(10)
  })

  it('puts overdue, over-pushed, unscheduled and soon-hard items in the inbox', () => {
    const p = base()
    p.tasks.push(task({ id: 'over', end: '2026-10-27' }))
    p.tasks.push(task({ id: 'pushed', slips: [1, 2, 3].map(() => ({ at: TODAY, from: TODAY, to: TODAY })) }))
    p.tasks.push(task({ id: 'noplan' }))
    p.tasks.push(task({ id: 'hard', hard: true, end: '2026-10-30', focus: ['2026-10-30'] }))
    const kinds = buildView(p, TODAY).inbox.map((i) => `${i.kind}:${i.id}`)
    expect(kinds).toContain('task-overdue:over')
    expect(kinds).toContain('task-pushed:pushed')
    expect(kinds).toContain('unscheduled:noplan')
    expect(kinds).toContain('deadline-soon:hard')
    expect(kinds).not.toContain('unscheduled:hard')
  })

  it('packs tasks into shared lanes and tucks milestones into gaps', () => {
    const p = base()
    p.tasks.push(task({ id: 'x', start: '2026-10-20', end: '2026-10-25', done: true }))
    p.tasks.push(task({ id: 'y', start: '2026-10-26', end: '2026-10-30' }))
    p.tasks.push(task({ id: 'z', start: '2026-10-28', end: '2026-11-02' }))
    // At y's end with free space after it -> shares lane 0 (diamond sits on y's last cell).
    p.milestones.push({ id: 'm1', trackId: 'a', title: 'M1', date: '2026-10-30' })
    // In the middle of z (lane 1) and over y's free tail -> lane 0 is free after 10-30.
    p.milestones.push({ id: 'm2', trackId: 'a', title: 'M2', date: '2026-11-08' })
    const tv = buildView(p, TODAY).tracks.find((t) => t.track.id === 'a')!
    const r = packRow(tv.tasks, tv.milestones, '2026-10-01', '2026-12-31', 30)
    expect(r.lanes.map((l) => l.map((t) => t.task.id))).toEqual([['x', 'y'], ['z']])
    expect(r.ms.every((x) => x.label)).toBe(true)
    expect(r.ms.map((x) => [x.m.id, x.lane])).toEqual([
      ['m1', 0],
      ['m2', 0],
    ])
    expect(r.laneCount).toBe(2)
  })

  it('draws just the diamond on a bar end when the label has no room', () => {
    const p = base()
    p.tasks.push(task({ id: 'a1', start: '2026-10-26', end: '2026-11-04' }))
    p.tasks.push(task({ id: 'a2', start: '2026-11-05', end: '2026-11-14' }))
    p.milestones.push({ id: 'm', trackId: 'a', title: 'Milestone 1：baseline 跑通', date: '2026-11-04' })
    const tv = buildView(p, TODAY).tracks.find((t) => t.track.id === 'a')!
    const r = packRow(tv.tasks, tv.milestones, '2026-10-01', '2026-12-31', 30)
    expect(r.ms).toMatchObject([{ lane: 0, label: false }])
    expect(r.laneCount).toBe(1)
  })

  it('opens a new lane for a milestone only when no lane has room', () => {
    const p = base()
    p.tasks.push(task({ id: 'long', start: '2026-10-20', end: '2026-11-20' }))
    p.milestones.push({ id: 'mid', trackId: 'a', title: '中途检查', date: '2026-11-01' })
    const tv = buildView(p, TODAY).tracks.find((t) => t.track.id === 'a')!
    const r = packRow(tv.tasks, tv.milestones, '2026-10-01', '2026-12-31', 30)
    expect(r.ms[0].lane).toBe(1)
    expect(r.laneCount).toBe(2)
  })

  it('lays out overlapping blocks side by side', () => {
    const laid = layoutBlocks([
      { id: '1', date: TODAY, start: '14:30', end: '15:30', title: 'a' },
      { id: '2', date: TODAY, start: '15:00', end: '15:30', title: 'b' },
      { id: '3', date: TODAY, start: '16:00', end: '17:00', title: 'c' },
    ])
    const byId = Object.fromEntries(laid.map((l) => [l.block.id, l]))
    expect(byId['1'].cols).toBe(2)
    expect(byId['2'].col).toBe(1)
    expect(byId['3'].cols).toBe(1)
  })
})

describe('ops', () => {
  it('push records a slip, keeps the first baseline and adds focus days', () => {
    let p = base()
    p.tasks.push(task({ id: 't', end: '2026-10-27' }))
    p = pushTask(p, 't', '2026-10-30', { today: TODAY, reason: 'r', by: 'agent' })
    p = pushTask(p, 't', '2026-11-01', { today: TODAY })
    const t = p.tasks[0]
    expect(t.end).toBe('2026-11-01')
    expect(t.baseline).toBe('2026-10-27')
    expect(t.slips).toHaveLength(2)
    expect(t.slips![0]).toMatchObject({ from: '2026-10-27', to: '2026-10-30', reason: 'r', by: 'agent' })
    expect(t.focus).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
  })

  it('refuses to push hard deadlines or move ends backwards', () => {
    const p = base()
    p.tasks.push(task({ id: 'h', hard: true }), task({ id: 's' }))
    expect(() => pushTask(p, 'h', '2026-11-05', { today: TODAY })).toThrow(OpError)
    expect(() => pushTask(p, 's', '2026-10-30', { today: TODAY })).toThrow(OpError)
  })

  it('suggests small pushes and flags big remaining work', () => {
    const p = base()
    p.tasks.push(task({ id: 'small', end: '2026-10-27', start: '2026-10-24', progress: 0.75 }))
    p.tasks.push(task({ id: 'big', end: '2026-10-27', start: '2026-10-18', progress: 0.1 }))
    const v = buildView(p, TODAY)
    expect(suggestPush(v.taskById.get('small')!, TODAY, 2)).toEqual({ to: TODAY, remaining: 1, fits: true })
    const big = suggestPush(v.taskById.get('big')!, TODAY, 2)
    expect(big.fits).toBe(false)
    expect(big.to).toBe('2026-10-30')
  })

  it('does not mutate its input', () => {
    const p = base()
    p.todos.push({ id: 'd', title: 'x', date: '2026-10-27' })
    const before = JSON.stringify(p)
    toggleTodo(p, 'd', TODAY)
    rollover(p, TODAY)
    expect(JSON.stringify(p)).toBe(before)
  })

  it('toggling a rolled-over todo moves it to the day it was done', () => {
    const p = base()
    p.todos.push({ id: 'd', title: 'x', date: '2026-10-27' })
    const t = toggleTodo(p, 'd', TODAY).todos[0]
    expect(t).toMatchObject({ done: true, doneAt: TODAY, date: TODAY, origDate: '2026-10-27' })
  })

  it('rollover keeps origDate', () => {
    const p = base()
    p.todos.push({ id: 'd', title: 'x', date: '2026-10-27' }, { id: 'e', title: 'y', date: '2026-10-28', origDate: '2026-10-20' })
    const { plan, moved } = rollover(p, TODAY)
    expect(moved).toEqual(['d', 'e'])
    expect(plan.todos[0]).toMatchObject({ date: TODAY, origDate: '2026-10-27' })
    expect(plan.todos[1]).toMatchObject({ date: TODAY, origDate: '2026-10-20' })
  })

  it('validates references when adding and removing', () => {
    const p = base()
    expect(() => addTask(p, { trackId: 'nope', title: 'x', start: TODAY, end: TODAY })).toThrow(OpError)
    expect(() => remove(p, 'nope')).toThrow(OpError)
  })
})

describe('archive', () => {
  it('hides archived threads and everything on them, but keeps them restorable', () => {
    let p = base()
    p.tasks.push(task({ id: 'gone', trackId: 'b', end: '2026-10-27' }), task({ id: 'kept' }))
    p.todos.push({ id: 'd1', title: 'x', date: '2026-10-20', taskId: 'gone' }, { id: 'd2', title: 'y', date: TODAY, trackId: 'b' })
    p.milestones.push({ id: 'm', trackId: 'b', title: 'm', date: '2026-10-20' })
    p = setTrackFlags(p, 'b', { archived: true }, TODAY)
    expect(p.tracks[1]).toMatchObject({ archived: true, archivedAt: TODAY })
    const v = buildView(p, TODAY)
    expect(v.tracks.map((t) => t.track.id)).toEqual(['a'])
    expect(v.archived.map((t) => t.id)).toEqual(['b'])
    expect(v.taskById.has('gone')).toBe(false)
    expect(v.inbox.some((i) => i.id === 'gone' || i.id === 'd1' || i.id === 'm')).toBe(false)
    expect(v.todos.map((t) => t.todo.id)).toEqual([])
    expect(archivedTrackView(p, 'b', TODAY)?.tasks.map((t) => t.task.id)).toEqual(['gone'])
    const back = setTrackFlags(p, 'b', { archived: false }, TODAY)
    expect(back.tracks[1].archived).toBeUndefined()
    expect(buildView(back, TODAY).taskById.has('gone')).toBe(true)
  })
})

describe('quick add', () => {
  const p = base()
  it('parses relative days', () => {
    expect(parseDay('明天', TODAY)).toBe('2026-10-30')
    expect(parseDay('周五', TODAY)).toBe('2026-10-30')
    expect(parseDay('周四', TODAY)).toBe(TODAY)
    expect(parseDay('下周一', TODAY)).toBe('2026-11-02')
    expect(parseDay('11/5', TODAY)).toBe('2026-11-05')
    expect(parseDay('1/5', '2026-12-20')).toBe('2027-01-05')
    expect(parseDay('+3', TODAY)).toBe('2026-11-01')
  })
  it('makes todos, blocks and tasks', () => {
    expect(parseQuick('改 intro #实验 明天 ~30m', p, TODAY)).toEqual({
      kind: 'todo',
      todo: { title: '改 intro', date: '2026-10-30', trackId: 'a', est: 30 },
    })
    expect(parseQuick('组会 @14-15:30 #实验', p, TODAY)).toMatchObject({
      kind: 'block',
      block: { title: '组会', date: TODAY, start: '14:00', end: '15:30', trackId: 'a' },
    })
    expect(parseQuick('写 related work #课程 3d >11/5 !', p, TODAY)).toMatchObject({
      kind: 'task',
      task: { title: '写 related work', trackId: 'b', start: TODAY, end: '2026-11-05', hard: true },
    })
    expect(parseQuick('整理 Zotero ?', p, TODAY)).toEqual({ kind: 'todo', todo: { title: '整理 Zotero' } })
  })
  it('reports errors', () => {
    expect(parseQuick('x 3d', p, TODAY).kind).toBe('error')
    expect(parseQuick('x #没有', p, TODAY).kind).toBe('error')
    expect(parseQuick('#实验', p, TODAY).kind).toBe('error')
  })
})

describe('format + validate', () => {
  it('formats compactly and round-trips', () => {
    const v = { a: [1, 2], b: { c: 'x'.repeat(200) } }
    const s = formatJSON(v, 40)
    expect(JSON.parse(s)).toEqual(v)
    expect(s).toContain('"a": [1, 2]')
  })

  it('flags broken references and bad dates', () => {
    const p = base()
    p.tasks.push(task({ id: 't', trackId: 'zzz', end: '2026-10-20' }))
    p.todos.push({ id: 't', title: 'dup id', date: '2026-13-01' })
    const msgs = validatePlan(p).filter((i) => i.level === 'error').map((i) => i.msg)
    expect(msgs.some((m) => m.includes('zzz'))).toBe(true)
    expect(msgs.some((m) => m.includes('晚于'))).toBe(true)
    expect(msgs.some((m) => m.includes('重复'))).toBe(true)
    expect(msgs.some((m) => m.includes('YYYY-MM-DD'))).toBe(true)
  })

  it('the committed data file is valid and stably formatted', () => {
    const text = readFileSync('data/plan.json', 'utf8')
    const plan = JSON.parse(text) as Plan
    expect(validatePlan(plan).filter((i) => i.level === 'error')).toEqual([])
    expect(formatJSON(plan)).toBe(text)
  })
})

describe('commands', () => {
  const run = (p: Plan, ...argv: string[]) => runCommand(p, [...argv, '--today', TODAY])

  it('parses options like node:util parseArgs', () => {
    expect(parseArgv(['push', 't', '--days', '2', '--no-focus', '--reason=a b'])).toEqual({
      opt: { days: '2', 'no-focus': true, reason: 'a b' },
      positionals: ['push', 't'],
    })
    expect(() => parseArgv(['--nope'])).toThrow(CmdError)
    expect(() => parseArgv(['--to'])).toThrow(CmdError)
  })

  it('read commands return text and no plan', () => {
    const p = base()
    p.tasks.push(task({ id: 't' }))
    const r = run(p, 'summary')
    expect(r.next).toBeUndefined()
    expect(r.out[0]).toContain(TODAY)
    expect(r.out.join('\n')).toContain('(t)')
  })

  it('write commands return a validated plan and leave the input alone', () => {
    const p = base()
    p.tasks.push(task({ id: 't' }))
    const r = run(p, 'push', 't', '--days', '1', '--reason', 'x')
    expect(r.next?.tasks[0].end).toBe('2026-10-31')
    expect(r.next?.tasks[0].slips).toHaveLength(1)
    expect(r.what).toContain('推后 t')
    expect(p.tasks[0].end).toBe('2026-10-30')
  })

  it('rejects writes that break validation and unknown ids', () => {
    const p = base()
    p.tasks.push(task({ id: 't' }))
    expect(() => run(p, 'set', 't', 'trackId="zzz"')).toThrow(/校验失败/)
    expect(() => run(p, 'done', 'nope')).toThrow(CmdError)
  })
})
