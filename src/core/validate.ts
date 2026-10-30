// Semantic checks that JSON Schema can't express: references, date order, duplicates.
import { isValidDate, isValidTime } from './date'
import type { Plan } from './types'

export interface Issue {
  level: 'error' | 'warn'
  path: string
  msg: string
}

export function validatePlan(plan: Plan): Issue[] {
  const issues: Issue[] = []
  const err = (path: string, msg: string) => issues.push({ level: 'error', path, msg })
  const warn = (path: string, msg: string) => issues.push({ level: 'warn', path, msg })

  if (plan?.version !== 1) err('version', 'version 必须是 1')
  for (const key of ['tracks', 'tasks', 'milestones', 'todos', 'blocks'] as const)
    if (!Array.isArray(plan?.[key])) err(key, `${key} 必须是数组`)
  if (issues.length) return issues

  const ids = new Map<string, string>()
  const claim = (id: unknown, path: string) => {
    if (typeof id !== 'string' || !id) return err(path, 'id 缺失')
    const prev = ids.get(id)
    if (prev) err(path, `id「${id}」和 ${prev} 重复`)
    else ids.set(id, path)
  }
  const date = (v: unknown, path: string, optional = false) => {
    if (v === undefined && optional) return
    if (!isValidDate(v)) err(path, `日期格式应为 YYYY-MM-DD，实际是 ${JSON.stringify(v)}`)
  }

  const trackIds = new Set(plan.tracks.map((t) => t.id))
  const taskIds = new Set(plan.tasks.map((t) => t.id))
  const msIds = new Set(plan.milestones.map((t) => t.id))
  const todoIds = new Set(plan.todos.map((t) => t.id))

  plan.tracks.forEach((t, i) => {
    const p = `tracks[${i}]`
    claim(t.id, p)
    if (!t.name) err(`${p}.name`, '缺 name')
    if (!/^#[0-9a-fA-F]{6}$/.test(t.color ?? '')) err(`${p}.color`, 'color 应为 #rrggbb')
    date(t.archivedAt, `${p}.archivedAt`, true)
  })

  plan.tasks.forEach((t, i) => {
    const p = `tasks[${i}]`
    claim(t.id, p)
    if (!t.title) err(`${p}.title`, '缺 title')
    if (!trackIds.has(t.trackId)) err(`${p}.trackId`, `track「${t.trackId}」不存在`)
    date(t.start, `${p}.start`)
    date(t.end, `${p}.end`)
    if (t.start > t.end) err(p, `start ${t.start} 晚于 end ${t.end}`)
    const arr = <T>(v: T[] | undefined, key: string) => {
      if (v === undefined || Array.isArray(v)) return v
      err(`${p}.${key}`, `${key} 必须是数组，实际是 ${JSON.stringify(v)}（用 plan focus 命令，或 set ${key}='[...]'）`)
    }
    const focus = arr(t.focus, 'focus')
    const slips = arr(t.slips, 'slips')
    focus?.forEach((d, j) => date(d, `${p}.focus[${j}]`))
    if (t.progress !== undefined && !(t.progress >= 0 && t.progress <= 1))
      err(`${p}.progress`, 'progress 应在 0..1')
    if (t.milestoneId && !msIds.has(t.milestoneId)) err(`${p}.milestoneId`, `milestone「${t.milestoneId}」不存在`)
    date(t.baseline, `${p}.baseline`, true)
    date(t.doneAt, `${p}.doneAt`, true)
    slips?.forEach((s, j) => {
      date(s.at, `${p}.slips[${j}].at`)
      date(s.from, `${p}.slips[${j}].from`)
      date(s.to, `${p}.slips[${j}].to`)
    })
    if (slips?.length && !t.baseline) warn(`${p}.baseline`, '有 slips 但没有 baseline')
    if (t.hard && slips?.length) warn(p, '硬 ddl 不应该被推')
    const outside = focus?.filter((d) => d < t.start || d > t.end) ?? []
    if (outside.length) warn(`${p}.focus`, `focus 日 ${outside.join(', ')} 在 start..end 之外`)
  })

  plan.milestones.forEach((m, i) => {
    const p = `milestones[${i}]`
    claim(m.id, p)
    if (!m.title) err(`${p}.title`, '缺 title')
    if (!trackIds.has(m.trackId)) err(`${p}.trackId`, `track「${m.trackId}」不存在`)
    date(m.date, `${p}.date`)
  })

  plan.todos.forEach((t, i) => {
    const p = `todos[${i}]`
    claim(t.id, p)
    if (!t.title) err(`${p}.title`, '缺 title')
    date(t.date, `${p}.date`, true)
    date(t.origDate, `${p}.origDate`, true)
    date(t.doneAt, `${p}.doneAt`, true)
    if (t.trackId && !trackIds.has(t.trackId)) err(`${p}.trackId`, `track「${t.trackId}」不存在`)
    if (t.taskId && !taskIds.has(t.taskId)) err(`${p}.taskId`, `task「${t.taskId}」不存在`)
    if (t.taskId && t.trackId) {
      const task = plan.tasks.find((x) => x.id === t.taskId)
      if (task && task.trackId !== t.trackId) warn(p, 'trackId 和所属 task 的 track 不一致')
    }
  })

  plan.blocks.forEach((b, i) => {
    const p = `blocks[${i}]`
    claim(b.id, p)
    if (!b.title) err(`${p}.title`, '缺 title')
    date(b.date, `${p}.date`)
    if (!isValidTime(b.start)) err(`${p}.start`, 'start 应为 HH:MM')
    if (!isValidTime(b.end)) err(`${p}.end`, 'end 应为 HH:MM')
    if (b.start >= b.end) err(p, `start ${b.start} 不早于 end ${b.end}`)
    if (b.trackId && !trackIds.has(b.trackId)) err(`${p}.trackId`, `track「${b.trackId}」不存在`)
    if (b.taskId && !taskIds.has(b.taskId)) err(`${p}.taskId`, `task「${b.taskId}」不存在`)
    if (b.todoId && !todoIds.has(b.todoId)) err(`${p}.todoId`, `todo「${b.todoId}」不存在`)
  })

  return issues
}
