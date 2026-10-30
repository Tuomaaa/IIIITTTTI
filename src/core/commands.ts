// The plan CLI's commands as a pure function: argv in, text + next Plan out.
// Shared by scripts/plan.ts (reads/writes the file) and the MCP endpoint (reads/writes GitHub).
import { addDays, diffDays, isValidDate, md, mdw, todayIn, toMinutes, isoWeek } from './date'
import { blocksOn, buildView, settings, type PlanView, type TaskView } from './derive'
import * as ops from './ops'
import { describeQuick, parseQuick } from './quickadd'
import type { Block, ISODate, Plan } from './types'
import { validatePlan } from './validate'

export const HELP = `用法：npm run plan -- <命令> [参数]   （全局：--file data/plan.json  --today YYYY-MM-DD  --dry）

读：
  summary [--days 14]            今日简报：需处理 / 聚焦 / 时间块 / todo / 进行中 / milestone / 推迟
  show <id>                      打印一条记录和它的派生状态（JSON）
  validate                       JSON Schema + 引用/日期检查，有 error 时退出码为 1
  suggest <taskId>               推后建议（剩余工作量 / 建议新 end）

写（自动校验 + 格式化，加 --dry 只预览）：
  add "<快速语法>"               和网页快速添加同一套语法，例：add "改 intro #文献 明天"
  add-task  --track T --title X --start D --end D [--hard] [--focus D,D] [--milestone M] [--progress 0.3] [--note ..]
  add-todo  --title X [--date D] [--track T] [--task K] [--est 30]
  add-block --date D --start HH:MM --end HH:MM --title X [--track T] [--task K] [--kind focus|event|routine]
  add-milestone --track T --title X --date D [--hard]
  add-track --name N --color #rrggbb [--id ID] [--group G]
  push <taskId> (--days N | --to D) [--reason ..] [--by agent|user] [--no-focus]
  done <id> / undone <id>        task、todo、milestone 都行
  progress <taskId> <0.4 | 40%>
  focus <taskId> D [D ...] [--set | --remove]   默认是追加
  park <taskId> / unpark <taskId>
  pause <trackId> / unpause <trackId>       暂停整条线程（甘特图里收进「暂停」组）
  archive <trackId> / unarchive <trackId>   归档整条线程（从甘特图、需处理、统计里消失，网页「已归档」里能找回）
  set <id> key=value [key=value ...]   改任意字段（值按 JSON 解析，解析失败就当字符串；key= 留空表示删除）
  rollover                       把过去没完成的 todo 移到今天（保留 origDate）
  rm <id>
  fmt                            重新格式化 plan.json
`

const OPTIONS = {
  file: 'string',
  today: 'string',
  dry: 'boolean',
  days: 'string',
  to: 'string',
  reason: 'string',
  by: 'string',
  'no-focus': 'boolean',
  track: 'string',
  title: 'string',
  name: 'string',
  color: 'string',
  group: 'string',
  id: 'string',
  start: 'string',
  end: 'string',
  date: 'string',
  hard: 'boolean',
  focus: 'string',
  milestone: 'string',
  progress: 'string',
  note: 'string',
  task: 'string',
  est: 'string',
  kind: 'string',
  set: 'boolean',
  remove: 'boolean',
  help: 'boolean',
} as const

type Options = {
  [K in keyof typeof OPTIONS]?: (typeof OPTIONS)[K] extends 'boolean' ? boolean : string
}

/** A command failed; nothing should be written. */
export class CmdError extends Error {}

export interface CmdResult {
  cmd: string
  opt: Options
  out: string[]
  warn: string[]
  /** Non-empty means the command failed (validate found errors). */
  errors: string[]
  /** Plan to write back, already validated. Absent for read-only commands. */
  next?: Plan
  /** One-line description of the write, used for output and commit messages. */
  what?: string
}

export interface CmdEnv {
  /** Extra checks (the CLI plugs in JSON Schema here); returns error messages. */
  schemaIssues?: (p: Plan) => string[]
  /** Overrides `--today` and the plan's time zone. */
  today?: ISODate
}

/** Strict `--key value` / `--key=value` parser over OPTIONS, like node:util parseArgs. */
export function parseArgv(argv: string[]): { opt: Options; positionals: string[] } {
  const opt: Record<string, string | boolean> = {}
  const positionals: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') {
      positionals.push(...argv.slice(i + 1))
      break
    }
    if (a === '-h') {
      opt.help = true
      continue
    }
    if (!a.startsWith('--') || a === '--') {
      positionals.push(a)
      continue
    }
    const eq = a.indexOf('=')
    const key = eq > 0 ? a.slice(2, eq) : a.slice(2)
    const type = (OPTIONS as Record<string, string>)[key]
    if (!type) throw new CmdError(`未知参数 --${key}`)
    if (type === 'boolean') {
      if (eq > 0) throw new CmdError(`--${key} 不带值`)
      opt[key] = true
    } else if (eq > 0) {
      opt[key] = a.slice(eq + 1)
    } else {
      const v = argv[i + 1]
      if (v === undefined || v.startsWith('--')) throw new CmdError(`--${key} 需要一个值`)
      opt[key] = v
      i++
    }
  }
  return { opt: opt as Options, positionals }
}

function fail(msg: string): never {
  throw new CmdError(msg)
}

function need(v: string | undefined, name: string): string {
  if (!v) fail(`缺少 ${name}`)
  return v
}

function dateArg(v: string | undefined, name: string): ISODate {
  const d = need(v, name)
  if (!isValidDate(d)) fail(`${name} 应为 YYYY-MM-DD：${d}`)
  return d
}

function findAny(plan: Plan, id: string) {
  return (
    plan.tasks.find((x) => x.id === id) ??
    plan.todos.find((x) => x.id === id) ??
    plan.milestones.find((x) => x.id === id) ??
    plan.blocks.find((x) => x.id === id) ??
    plan.tracks.find((x) => x.id === id)
  )
}

export function checkPlan(p: Plan, schemaIssues?: (p: Plan) => string[]): { errors: string[]; warns: string[] } {
  const sem = validatePlan(p)
  return {
    errors: [...(schemaIssues?.(p) ?? []).map((m) => `schema ${m}`), ...sem.filter((i) => i.level === 'error').map((i) => `${i.path}: ${i.msg}`)],
    warns: sem.filter((i) => i.level === 'warn').map((i) => `${i.path}: ${i.msg}`),
  }
}

// ---------- summary ----------

function taskLine(tv: TaskView, v: PlanView): string {
  const t = tv.task
  const bits = [`${t.title} (${t.id})`, tv.track?.name ?? t.trackId, `${md(t.start)}→${md(t.end)}`]
  if (tv.progress != null) bits.push(`${Math.round(tv.progress * 100)}%`)
  if (tv.phase === 'overdue') bits.push(`过期${tv.overdueDays}d`)
  if (t.hard) bits.push('硬ddl')
  if (tv.pushCount) bits.push(`推${tv.pushCount}次/+${tv.slipDays}d`)
  if (tv.nextFocus) bits.push(`下次聚焦 ${tv.nextFocus === v.today ? '今天' : md(tv.nextFocus)}`)
  else if (tv.unscheduled) bits.push('之后没排')
  return bits.join(' · ')
}

function blockLine(b: Block, v: PlanView): string {
  const tr = b.trackId ? v.trackById.get(b.trackId)?.name : b.taskId ? v.taskById.get(b.taskId)?.track?.name : ''
  return `${b.start}-${b.end} ${b.title}${b.kind && b.kind !== 'focus' ? ` [${b.kind}]` : ''}${tr ? ` · ${tr}` : ''}${b.taskId ? ` → ${b.taskId}` : ''}`
}

export function summary(plan: Plan, today: ISODate, horizon = 14): string[] {
  const v = buildView(plan, today)
  const out: string[] = []
  const s = v.stats
  out.push(`# ${mdw(today)} ${today} · W${isoWeek(today)}${plan.meta.tz ? ` · ${plan.meta.tz}` : ''}${plan.meta.demo ? ' · ⚠ 示例数据' : ''}`)
  out.push(`进行中 ${s.active} · 今日聚焦 ${s.focusToday} · todo ${s.todosToday.done}/${s.todosToday.total} · 过期 ${s.overdue} · 拖延todo ${s.stale} · 7天内完成 ${s.weekDone.todos} todo/${s.weekDone.tasks} task · 7天内推迟 ${s.weekSlips.count}次/${s.weekSlips.days}天 · 累计推迟 ${s.totalSlipDays}天`)

  out.push('', `## 需处理 (${v.inbox.length})`)
  for (const it of v.inbox) out.push(`- ${'!'.repeat(it.level)} [${it.kind}] ${it.title} (${it.id}) · ${it.detail}`)

  const focus = (v.load.get(today)?.tasks ?? []).map((id) => v.taskById.get(id)!)
  out.push('', `## 今日聚焦 (${focus.length})`)
  for (const tv of focus) out.push(`- ${taskLine(tv, v)}`)

  const blocks = blocksOn(plan, today)
  const mins = blocks.reduce((a, b) => a + toMinutes(b.end) - toMinutes(b.start), 0)
  out.push('', `## 今天的时间块 (${blocks.length}, ${(mins / 60).toFixed(1)}h)`)
  for (const b of blocks) out.push(`- ${blockLine(b, v)}`)

  const todos = v.todos.filter((t) => t.showOn === today || (t.todo.done && t.todo.doneAt === today))
  out.push('', `## 今天的 todo (${todos.filter((t) => t.todo.done).length}/${todos.length})`)
  for (const t of todos.sort((a, b) => Number(!!a.todo.done) - Number(!!b.todo.done) || b.age - a.age))
    out.push(
      `- [${t.todo.done ? 'x' : ' '}] ${t.todo.title} (${t.todo.id})${t.rolled && !t.todo.done ? ` ↻${t.age}d${t.stale ? ' STALE' : ''}` : ''}${t.task ? ` → ${t.task.id}` : t.track ? ` · ${t.track.name}` : ''}`,
    )
  const backlog = v.todos.filter((t) => !t.todo.date && !t.todo.done)
  if (backlog.length) out.push(`- backlog ${backlog.length} 条：${backlog.map((t) => `${t.todo.title} (${t.todo.id})`).join('；')}`)

  const live = [...v.taskById.values()].filter((t) => t.phase === 'active' || t.phase === 'overdue')
  out.push('', `## 进行中 (${live.length})`)
  for (const tv of live.sort((a, b) => a.task.end.localeCompare(b.task.end))) out.push(`- ${taskLine(tv, v)}`)

  const soon = [...v.taskById.values()].filter((t) => t.phase === 'upcoming' && diffDays(today, t.task.start) <= horizon)
  out.push('', `## ${horizon} 天内开始 (${soon.length})`)
  for (const tv of soon.sort((a, b) => a.task.start.localeCompare(b.task.start))) out.push(`- ${taskLine(tv, v)}`)

  const ms = plan.milestones.filter((m) => !m.done && m.date <= addDays(today, horizon)).sort((a, b) => a.date.localeCompare(b.date))
  out.push('', `## Milestone（${horizon} 天内及已过未完成）`)
  for (const m of ms) {
    const d = diffDays(today, m.date)
    out.push(`- ${m.hard ? '◆硬' : '◇'} ${md(m.date)} ${d >= 0 ? `还有${d}d` : `已过${-d}d`} · ${m.title} (${m.id}) · ${v.trackById.get(m.trackId)?.name}`)
  }

  const recent = plan.tasks.flatMap((t) => (t.slips ?? []).map((sl) => ({ sl, t }))).filter(({ sl }) => sl.at >= addDays(today, -6))
  out.push('', `## 最近 7 天的推迟 (${recent.length})`)
  for (const { sl, t } of recent.sort((a, b) => b.sl.at.localeCompare(a.sl.at)))
    out.push(`- ${md(sl.at)} ${t.title} (${t.id}) ${md(sl.from)}→${md(sl.to)} +${diffDays(sl.from, sl.to)}d ${sl.by ?? ''}${sl.reason ? ` · ${sl.reason}` : ''}`)

  const load = [...Array(7)].map((_, i) => {
    const d = addDays(today, i)
    const l = v.load.get(d)
    return `${md(d)}:${l?.tasks.length ?? 0}`
  })
  out.push('', `## 未来 7 天并行数（上限 ${settings(plan).maxParallel}）`, load.join('  '))
  if (v.archived.length) out.push('', `已归档线程 ${v.archived.length} 条：${v.archived.map((t) => `${t.name} (${t.id})`).join('、')}`)
  return out
}

// ---------- dispatch ----------

/** Run one CLI command against `plan`. Throws CmdError on bad input or a write that fails validation. */
export function runCommand(plan: Plan, argv: string[], env: CmdEnv = {}): CmdResult {
  const { opt, positionals } = parseArgv(argv)
  const [cmd = 'help', ...args] = positionals
  const today: ISODate = env.today ?? opt.today ?? todayIn(plan.meta.tz)
  if (!isValidDate(today)) fail(`--today 格式不对：${today}`)

  const res: CmdResult = { cmd, opt, out: [], warn: [], errors: [] }

  const save = (next: Plan, what: string) => {
    const { errors, warns } = checkPlan(next, env.schemaIssues)
    res.warn.push(...warns)
    if (errors.length) fail(`校验失败，没有写入：\n  ${errors.join('\n  ')}`)
    res.next = next
    res.what = what
  }

  const run = (fn: () => Plan, what: string) => {
    let next: Plan
    try {
      next = fn()
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e))
    }
    save(next, what)
  }

  switch (cmd) {
    case 'help':
      res.out.push(HELP)
      break
    case 'summary':
      res.out.push(...summary(plan, today, Number(opt.days ?? 14)))
      break
    case 'validate': {
      const { errors, warns } = checkPlan(plan, env.schemaIssues)
      res.warn.push(...warns)
      res.errors.push(...errors)
      if (!errors.length)
        res.out.push(`✓ ${opt.file ?? 'data/plan.json'} 通过校验（${plan.tracks.length} 线程 / ${plan.tasks.length} task / ${plan.todos.length} todo / ${plan.blocks.length} 时间块 / ${plan.milestones.length} milestone${warns.length ? ` / ${warns.length} 个警告` : ''}）`)
      break
    }
    case 'fmt':
      save(plan, '重新格式化')
      break
    case 'show': {
      const id = need(args[0], 'id')
      const rec = findAny(plan, id)
      if (!rec) fail(`找不到 ${id}`)
      const v = buildView(plan, today)
      const tv = v.taskById.get(id)
      const derived = tv
        ? { phase: tv.phase, overdueDays: tv.overdueDays, pushCount: tv.pushCount, slipDays: tv.slipDays, pressure: tv.pressure, focus: tv.focus, progress: tv.progress, todo: `${tv.todoDone}/${tv.todoTotal}`, unscheduled: tv.unscheduled }
        : undefined
      res.out.push(JSON.stringify({ record: rec, derived }, null, 2))
      break
    }
    case 'suggest': {
      const id = need(args[0], 'taskId')
      const v = buildView(plan, today)
      const tv = v.taskById.get(id) ?? fail(`找不到 task ${id}`)
      const sug = ops.suggestPush(tv, today, settings(plan).maxPushDays)
      res.out.push(
        `${tv.task.title}：end ${tv.task.end}${tv.phase === 'overdue' ? `（过期 ${tv.overdueDays} 天）` : ''}，已推 ${tv.pushCount} 次。估计剩 ${sug.remaining} 天工作量 → 建议推到 ${sug.to}（+${diffDays(tv.task.end, sug.to)}d）${sug.fits ? '' : `；超过单次上限 ${settings(plan).maxPushDays} 天，建议先拆小或砍 scope`}${tv.task.hard ? '。⚠ 硬 ddl，不能推' : ''}`,
      )
      break
    }
    case 'add': {
      const text = need(args.join(' '), '快速添加文本')
      const r = parseQuick(text, plan, today)
      if (r.kind === 'error') fail(r.msg)
      const id = opt.id ?? ops.newId(r.kind === 'todo' ? 'td' : r.kind === 'block' ? 'bk' : 'tk', plan)
      run(
        () => (r.kind === 'todo' ? ops.addTodo(plan, { ...r.todo, id }) : r.kind === 'block' ? ops.addBlock(plan, { ...r.block, id }) : ops.addTask(plan, { ...r.task, id })),
        `加 ${id}：${describeQuick(r, plan)}`,
      )
      break
    }
    case 'add-task': {
      const start = dateArg(opt.start, '--start')
      const end = dateArg(opt.end, '--end')
      const id = opt.id ?? ops.newId('tk', plan)
      const focus = opt.focus?.split(',').map((d) => d.trim()).filter(Boolean)
      run(
        () =>
          ops.addTask(plan, {
            id,
            trackId: need(opt.track, '--track'),
            title: need(opt.title, '--title'),
            start,
            end,
            ...(focus?.length ? { focus } : {}),
            ...(opt.hard ? { hard: true } : {}),
            ...(opt.milestone ? { milestoneId: opt.milestone } : {}),
            ...(opt.progress ? { progress: Number(opt.progress) } : {}),
            ...(opt.note ? { note: opt.note } : {}),
          }),
        `加 task ${id}`,
      )
      break
    }
    case 'add-todo': {
      const id = opt.id ?? ops.newId('td', plan)
      run(
        () =>
          ops.addTodo(plan, {
            id,
            title: need(opt.title, '--title'),
            ...(opt.date ? { date: dateArg(opt.date, '--date') } : {}),
            ...(opt.track ? { trackId: opt.track } : {}),
            ...(opt.task ? { taskId: opt.task } : {}),
            ...(opt.est ? { est: Number(opt.est) } : {}),
            ...(opt.note ? { note: opt.note } : {}),
          }),
        `加 todo ${id}`,
      )
      break
    }
    case 'add-block': {
      const id = opt.id ?? ops.newId('bk', plan)
      run(
        () =>
          ops.addBlock(plan, {
            id,
            date: dateArg(opt.date, '--date'),
            start: need(opt.start, '--start'),
            end: need(opt.end, '--end'),
            title: need(opt.title, '--title'),
            ...(opt.track ? { trackId: opt.track } : {}),
            ...(opt.task ? { taskId: opt.task } : {}),
            ...(opt.kind ? { kind: opt.kind as Block['kind'] } : {}),
          }),
        `加时间块 ${id}`,
      )
      break
    }
    case 'add-milestone': {
      const id = opt.id ?? ops.newId('ms', plan)
      run(
        () => ops.addMilestone(plan, { id, trackId: need(opt.track, '--track'), title: need(opt.title, '--title'), date: dateArg(opt.date, '--date'), ...(opt.hard ? { hard: true } : {}) }),
        `加 milestone ${id}`,
      )
      break
    }
    case 'add-track': {
      const id = opt.id ?? ops.newId('tr', plan)
      run(
        () => ops.addTrack(plan, { id, name: need(opt.name, '--name'), color: need(opt.color, '--color'), ...(opt.group ? { group: opt.group } : {}) }),
        `加线程 ${id}`,
      )
      break
    }
    case 'push': {
      const id = need(args[0], 'taskId')
      const task = plan.tasks.find((t) => t.id === id) ?? fail(`找不到 task ${id}`)
      const to = opt.to ? dateArg(opt.to, '--to') : opt.days ? addDays(task.end < today ? addDays(today, -1) : task.end, Number(opt.days)) : fail('需要 --days N 或 --to D')
      const by = (opt.by ?? 'agent') as 'agent' | 'user'
      run(() => ops.pushTask(plan, id, to, { today, reason: opt.reason, by, focus: !opt['no-focus'] }), `推后 ${id}：${task.end} → ${to}（第 ${(task.slips?.length ?? 0) + 1} 次）`)
      break
    }
    case 'done':
    case 'undone': {
      const id = need(args[0], 'id')
      const done = cmd === 'done'
      if (plan.tasks.some((t) => t.id === id)) run(() => ops.setTaskDone(plan, id, done, today), `${done ? '完成' : '重开'} task ${id}`)
      else if (plan.milestones.some((m) => m.id === id)) run(() => ops.setMilestoneDone(plan, id, done), `${done ? '完成' : '重开'} milestone ${id}`)
      else {
        const t = plan.todos.find((x) => x.id === id) ?? fail(`找不到 ${id}`)
        if (!!t.done === done) fail(`todo ${id} 已经是${done ? '完成' : '未完成'}状态`)
        run(() => ops.toggleTodo(plan, id, today), `${done ? '完成' : '重开'} todo ${id}`)
      }
      break
    }
    case 'progress': {
      const id = need(args[0], 'taskId')
      const raw = need(args[1], '进度')
      const p = raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw)
      if (!(p >= 0 && p <= 1)) fail(`进度应在 0..1 或 0%..100%：${raw}`)
      run(() => ops.setProgress(plan, id, p), `进度 ${id} = ${Math.round(p * 100)}%`)
      break
    }
    case 'focus': {
      const id = need(args[0], 'taskId')
      const days = args.slice(1)
      for (const d of days) if (!isValidDate(d)) fail(`日期格式不对：${d}`)
      const task = plan.tasks.find((t) => t.id === id) ?? fail(`找不到 task ${id}`)
      const cur = task.focus ?? []
      const next = opt.set ? days : opt.remove ? cur.filter((d) => !days.includes(d)) : [...cur, ...days]
      run(() => ops.setFocus(plan, id, next), `focus ${id} = ${[...new Set(next)].sort().join(', ') || '（空）'}`)
      break
    }
    case 'park':
    case 'unpark': {
      const id = need(args[0], 'taskId')
      run(() => ops.setParked(plan, id, cmd === 'park'), `${cmd === 'park' ? '暂停' : '恢复'} ${id}`)
      break
    }
    case 'pause':
    case 'unpause':
    case 'archive':
    case 'unarchive': {
      const id = need(args[0], 'trackId')
      const track = plan.tracks.find((t) => t.id === id) ?? fail(`找不到线程 ${id}`)
      if (cmd === 'archive') {
        const open = plan.tasks.filter((t) => t.trackId === id && !t.done).length
        if (open) res.warn.push(`${track.name} 还有 ${open} 个没完成的 task，归档后它们不会再出现在甘特图和需处理里`)
      }
      const flags = cmd === 'pause' ? { paused: true } : cmd === 'unpause' ? { paused: false } : cmd === 'archive' ? { archived: true } : { archived: false }
      const verb = { pause: '暂停', unpause: '恢复', archive: '归档', unarchive: '取消归档' }[cmd]
      run(() => ops.setTrackFlags(plan, id, flags, today), `${verb}线程 ${id}（${track.name}）`)
      break
    }
    case 'set': {
      const id = need(args[0], 'id')
      if (!findAny(plan, id)) fail(`找不到 ${id}`)
      const next = structuredClone(plan)
      const target = [next.tasks, next.todos, next.milestones, next.blocks, next.tracks].flat().find((x) => x.id === id) as unknown as Record<string, unknown>
      const changes: string[] = []
      for (const kv of args.slice(1)) {
        const i = kv.indexOf('=')
        if (i <= 0) fail(`应为 key=value：${kv}`)
        const k = kv.slice(0, i)
        const raw = kv.slice(i + 1)
        if (k === 'id') fail('不能改 id')
        if (raw === '') {
          delete target[k]
          changes.push(`删 ${k}`)
          continue
        }
        let val: unknown
        try {
          val = JSON.parse(raw)
        } catch {
          val = raw
        }
        target[k] = val
        changes.push(`${k}=${JSON.stringify(val)}`)
      }
      next.meta.updatedAt = new Date().toISOString()
      save(next, `改 ${id}：${changes.join(', ')}`)
      break
    }
    case 'rollover': {
      const { plan: next, moved } = ops.rollover(plan, today)
      if (!moved.length) res.out.push('没有需要滚动的 todo')
      else save(next, `${moved.length} 条 todo 滚到 ${today}：${moved.join(', ')}`)
      break
    }
    case 'rm': {
      const id = need(args[0], 'id')
      run(() => ops.remove(plan, id), `删除 ${id}`)
      break
    }
    default:
      fail(`未知命令 ${cmd}\n${HELP}`)
  }
  return res
}
