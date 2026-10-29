import { useEffect, useState } from 'react'
import { addDays, diffDays, md, mdw, relDay, weekday, WEEKDAY_ZH } from '../core/date'
import { settings, type InboxItem, type PlanView } from '../core/derive'
import { pushTask, remove, setMilestoneDone, setTaskDone, setTodoDate, suggestPush, toggleTodo } from '../core/ops'
import type { ISODate } from '../core/types'
import { fetchCommits, type CommitInfo } from '../data/github'
import { useStore } from '../data/store'
import { useUI } from '../data/ui'
import { levelColor, tint } from '../lib/ui'

export function SidePanel({ view }: { view: PlanView }) {
  return (
    <div className="space-y-2">
      <Inbox view={view} />
      <Upcoming view={view} />
      <Slips view={view} />
      <Changes />
    </div>
  )
}

const KIND_ZH: Record<InboxItem['kind'], string> = {
  'task-overdue': '过期',
  'milestone-overdue': '◆ 过期',
  'todo-stale': '拖延',
  'task-pushed': '推太多',
  'deadline-soon': '快到期',
  unscheduled: '没排期',
}

export function Inbox({ view }: { view: PlanView }) {
  const items = view.inbox
  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <span className="section-title">需处理</span>
        <span className="num rounded px-1.5 text-[10.5px] font-semibold" style={{ background: items.length ? 'var(--red-soft)' : 'var(--panel-2)', color: items.length ? 'var(--red)' : 'var(--muted)' }}>
          {items.length}
        </span>
      </header>
      {!items.length && (
        <div className="px-3 pb-3 text-[11px]" style={{ color: 'var(--muted)' }}>
          全部在轨道上 ✓
        </div>
      )}
      <ul>
        {items.map((it) => (
          <InboxRow key={`${it.kind}:${it.id}`} it={it} view={view} />
        ))}
      </ul>
    </section>
  )
}

function InboxRow({ it, view }: { it: InboxItem; view: PlanView }) {
  const openTask = useUI((s) => s.openTask)
  const apply = useStore((s) => s.apply)
  const [pushing, setPushing] = useState(false)
  const track = it.trackId ? view.trackById.get(it.trackId) : undefined
  const tv = view.taskById.get(it.id)
  const c = levelColor(it.level)
  const isTask = !!tv && it.kind !== 'todo-stale'

  return (
    <li className="relative border-t px-3 py-1.5" style={{ borderColor: 'var(--line-2)' }}>
      <div className="absolute top-0 bottom-0 left-0" style={{ width: 3, background: c }} />
      <div className="flex items-baseline gap-1.5">
        <span className="shrink-0 text-[10px] font-semibold" style={{ color: c }}>
          {KIND_ZH[it.kind]}
        </span>
        <button className="min-w-0 truncate text-left font-medium" onClick={() => isTask && openTask(it.id)}>
          {it.title}
        </button>
      </div>
      <div className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--muted)' }}>
        {track && <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: track.color }} />}
        <span className="truncate">
          {track?.name ? `${track.name} · ` : ''}
          {it.detail}
        </span>
      </div>
      {it.kind === 'task-overdue' && tv && !tv.task.hard && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {!pushing ? (
            <>
              <button className="btn" onClick={() => setPushing(true)}>
                推后…
              </button>
              <button className="btn" onClick={() => apply(`完成「${tv.task.title}」`, (p) => setTaskDone(p, tv.task.id, true, view.today))}>
                完成
              </button>
            </>
          ) : (
            <PushForm id={tv.task.id} view={view} onDone={() => setPushing(false)} />
          )}
        </div>
      )}
      {it.kind === 'todo-stale' && (
        <div className="mt-1 flex flex-wrap gap-1">
          <button className="btn" onClick={() => apply(`完成 todo「${it.title}」`, (p) => toggleTodo(p, it.id, view.today))}>
            ✓ 完成
          </button>
          <button className="btn" onClick={() => apply(`todo「${it.title}」改到明天`, (p) => setTodoDate(p, it.id, addDays(view.today, 1)))}>
            明天
          </button>
          <button className="btn" onClick={() => apply(`todo「${it.title}」放回 backlog`, (p) => setTodoDate(p, it.id, undefined))}>
            扔 backlog
          </button>
          <button className="btn" style={{ color: 'var(--red)' }} onClick={() => apply(`删除 todo「${it.title}」`, (p) => remove(p, it.id))}>
            删除
          </button>
        </div>
      )}
      {it.kind === 'milestone-overdue' && (
        <div className="mt-1 flex gap-1">
          <button className="btn" onClick={() => apply(`完成 milestone「${it.title}」`, (p) => setMilestoneDone(p, it.id, true))}>
            标记完成
          </button>
        </div>
      )}
      {it.kind === 'task-overdue' && tv?.task.hard && (
        <div className="mt-1 flex gap-1">
          <button className="btn" onClick={() => apply(`完成「${tv.task.title}」`, (p) => setTaskDone(p, tv.task.id, true, view.today))}>
            完成
          </button>
          <span className="self-center text-[10px]" style={{ color: 'var(--muted)' }}>
            硬 ddl 不能推
          </span>
        </div>
      )}
      {it.kind === 'task-pushed' && (
        <div className="mt-0.5 text-[10px]" style={{ color: 'var(--faint)' }}>
          建议：拆成更小的 task，或者砍掉一部分 scope
        </div>
      )}
    </li>
  )
}

export function PushForm({ id, view, onDone }: { id: string; view: PlanView; onDone: () => void }) {
  const apply = useStore((s) => s.apply)
  const plan = useStore((s) => s.plan)
  const tv = view.taskById.get(id)!
  const maxPush = settings(plan).maxPushDays
  const sug = suggestPush(tv, view.today, maxPush)
  const [to, setTo] = useState<ISODate>(sug.to)
  const [reason, setReason] = useState('')
  const days = diffDays(tv.task.end, to)
  const big = diffDays(view.today, to) + 1 > maxPush
  return (
    <div className="w-full space-y-1 rounded-md p-1.5" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
      <div className="text-[10.5px]" style={{ color: 'var(--muted)' }}>
        估计还剩 {sug.remaining} 天工作量。
        {sug.fits ? `建议推到 ${md(sug.to)}。` : `超过单次上限 ${maxPush} 天，建议先拆小或砍 scope，再推。`}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {[1, 2, 3].map((n) => {
          const d = addDays(view.today, n - 1)
          return (
            <button key={n} className="btn" aria-pressed={to === d} onClick={() => setTo(d)}>
              到{relDay(d, view.today)}
            </button>
          )
        })}
        <input type="date" className="btn" value={to} min={addDays(tv.task.end, 1)} onChange={(e) => e.target.value && setTo(e.target.value)} />
      </div>
      <input
        className="w-full rounded border px-1.5 py-1 text-[11px]"
        style={{ borderColor: big && !reason ? 'var(--orange)' : 'var(--line)', background: 'var(--panel)' }}
        placeholder={big ? '推这么多，写一下原因（必填）' : '原因（选填，会记进推迟记录）'}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex items-center gap-1">
        <button
          className="btn"
          style={{ background: 'var(--orange)', color: 'white', borderColor: 'var(--orange)' }}
          disabled={days <= 0 || (big && !reason.trim())}
          onClick={() => {
            if (apply(`推后「${tv.task.title}」到 ${to}`, (p) => pushTask(p, id, to, { today: view.today, reason: reason.trim() || undefined, by: 'user' }))) onDone()
          }}
        >
          推 {days} 天
        </button>
        <button className="btn btn-ghost" onClick={onDone}>
          取消
        </button>
        <span className="ml-auto text-[10px]" style={{ color: 'var(--muted)' }}>
          这会是第 {tv.pushCount + 1} 次
        </span>
      </div>
    </div>
  )
}

function Upcoming({ view }: { view: PlanView }) {
  const plan = useStore((s) => s.plan)
  const setHover = useUI((s) => s.setHover)
  const horizon = addDays(view.today, 30)
  const ms = plan.milestones
    .filter((m) => !m.done && m.date >= view.today && m.date <= horizon)
    .sort((a, b) => a.date.localeCompare(b.date))
  return (
    <section className="panel overflow-hidden">
      <header className="px-3 pt-2.5 pb-1.5">
        <span className="section-title">◆ 接下来 30 天</span>
      </header>
      {!ms.length && (
        <div className="px-3 pb-3 text-[11px]" style={{ color: 'var(--muted)' }}>
          没有 milestone
        </div>
      )}
      <ul className="pb-1.5">
        {ms.map((m) => {
          const track = view.trackById.get(m.trackId)
          const left = diffDays(view.today, m.date)
          const linked = plan.tasks.filter((t) => t.milestoneId === m.id).map((t) => view.taskById.get(t.id)!)
          const behind = linked.some((t) => t.phase === 'overdue' || t.task.end > m.date)
          return (
            <li
              key={m.id}
              className="flex items-center gap-2 px-3 py-[3px]"
              onMouseEnter={(e) =>
                setHover({
                  x: e.clientX,
                  y: e.clientY,
                  content: (
                    <div className="space-y-0.5">
                      <div className="font-semibold">{m.title}</div>
                      <div style={{ color: 'var(--muted)' }}>
                        {track?.name} · {mdw(m.date)}
                      </div>
                      {linked.map((t) => (
                        <div key={t.task.id}>
                          ← {t.task.title} · {Math.round((t.progress ?? 0) * 100)}%
                        </div>
                      ))}
                    </div>
                  ),
                })
              }
              onMouseLeave={() => setHover(null)}
            >
              <span className="num w-[34px] shrink-0 text-right text-[11px] font-semibold" style={{ color: left <= 3 ? (m.hard ? 'var(--red)' : 'var(--orange)') : 'var(--text)' }}>
                {left === 0 ? '今天' : `${left}d`}
              </span>
              <span style={{ color: m.hard ? 'var(--red)' : track?.color, fontSize: 10 }}>◆</span>
              <span className="min-w-0 flex-1 truncate">{m.title}</span>
              {behind && (
                <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'var(--orange)' }} title="关联 task 的 end 晚于 milestone 或已过期">
                  落后
                </span>
              )}
              <span className="num shrink-0 text-[10px]" style={{ color: 'var(--faint)' }}>
                {md(m.date)}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Slips({ view }: { view: PlanView }) {
  const plan = useStore((s) => s.plan)
  const openTask = useUI((s) => s.openTask)
  const since = addDays(view.today, -13)
  const recent = plan.tasks
    .flatMap((t) => (t.slips ?? []).map((s) => ({ s, t })))
    .filter(({ s }) => s.at >= since)
    .sort((a, b) => b.s.at.localeCompare(a.s.at))
  const byTrack = view.tracks
    .filter((t) => t.slipDays > 0)
    .sort((a, b) => b.slipDays - a.slipDays)
  const max = Math.max(1, ...byTrack.map((t) => t.slipDays))
  const { weekSlips, totalSlipDays, weekDone, doneByDay } = view.stats
  const maxDone = Math.max(1, ...doneByDay.map((d) => d.todos))

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-baseline gap-2 px-3 pt-2.5 pb-1">
        <span className="section-title">最近 7 天</span>
        <span className="num text-[10.5px]" style={{ color: 'var(--green)' }}>
          完成 {weekDone.todos} todo · {weekDone.tasks} task
        </span>
        <span className="num ml-auto text-[10.5px]" style={{ color: weekSlips.count ? 'var(--orange)' : 'var(--muted)' }}>
          推迟 {weekSlips.count} 次 / {weekSlips.days} 天
        </span>
      </header>
      <div className="flex items-end gap-[3px] px-3 pb-2" aria-label="每天完成的 todo 数和推迟次数">
        {doneByDay.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-[2px]" title={`${md(d.date)}：完成 ${d.todos} 个 todo，推迟 ${d.slips} 次`}>
            <div className="flex h-[26px] w-full items-end justify-center gap-[2px]">
              <div className="w-[60%] rounded-t-[2px]" style={{ height: `${(d.todos / maxDone) * 100}%`, minHeight: d.todos ? 3 : 1, background: d.todos ? 'var(--green)' : 'var(--line)' }} />
              {d.slips > 0 && <div className="w-[3px] rounded-t-[1px]" style={{ height: Math.min(26, d.slips * 9), background: 'var(--orange)' }} />}
            </div>
            <span className="num text-[9px]" style={{ color: d.date === view.today ? 'var(--accent)' : 'var(--faint)' }}>
              {WEEKDAY_ZH[weekday(d.date)]}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-baseline px-3 pb-1">
        <span className="section-title">推迟记录</span>
        <span className="num ml-auto text-[10.5px]" style={{ color: 'var(--muted)' }}>
          累计 {totalSlipDays} 天
        </span>
      </div>
      {byTrack.length > 0 && (
        <div className="space-y-[3px] px-3 pb-2">
          {byTrack.map((t) => (
            <div key={t.track.id} className="flex items-center gap-1.5 text-[10.5px]">
              <span className="w-[78px] shrink-0 truncate" style={{ color: 'var(--muted)' }}>
                {t.track.name}
              </span>
              <span className="h-[7px] rounded-[2px]" style={{ width: `${(t.slipDays / max) * 100}%`, maxWidth: 'calc(100% - 120px)', background: tint(t.track.color, 70) }} />
              <span className="num shrink-0 font-semibold">{t.slipDays}d</span>
              <span className="num shrink-0" style={{ color: 'var(--faint)' }}>
                ×{t.pushCount}
              </span>
            </div>
          ))}
        </div>
      )}
      <ul className="pb-1.5">
        {recent.map(({ s, t }, i) => {
          const track = view.trackById.get(t.trackId)
          return (
            <li key={i} className="border-t px-3 py-1" style={{ borderColor: 'var(--line-2)' }}>
              <button className="flex w-full items-baseline gap-1.5 text-left" onClick={() => openTask(t.id)}>
                <span className="h-[6px] w-[6px] shrink-0 self-center rounded-full" style={{ background: track?.color }} />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="num shrink-0 text-[10.5px] font-semibold" style={{ color: 'var(--orange)' }}>
                  +{diffDays(s.from, s.to)}d
                </span>
              </button>
              <div className="num pl-3 text-[10px]" style={{ color: 'var(--muted)' }}>
                {md(s.at)} 决定 · {md(s.from)}→{md(s.to)}
                {s.by === 'agent' ? ' · agent' : ''}
                {s.reason ? ` · ${s.reason}` : ''}
              </div>
            </li>
          )
        })}
        {!recent.length && (
          <li className="px-3 pb-2 text-[11px]" style={{ color: 'var(--muted)' }}>
            最近两周没推过 ✓
          </li>
        )}
      </ul>
    </section>
  )
}

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  if (min < 24 * 60) return `${Math.round(min / 60)} 小时前`
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** Recent commits to the data file, so it's visible what the agent (or another device) changed. */
function Changes() {
  const source = useStore((s) => s.source)
  const lastSync = useStore((s) => s.lastSync)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CommitInfo[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    let alive = true
    fetchCommits(source)
      .then((c) => alive && (setItems(c), setErr(null)))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [open, source, lastSync])
  return (
    <section className="panel overflow-hidden">
      <button className="flex w-full items-center gap-2 px-3 py-2.5" onClick={() => setOpen(!open)}>
        <span className="section-title">{open ? '▾' : '▸'} 最近改动</span>
        <span className="text-[10.5px]" style={{ color: 'var(--faint)' }}>
          谁改了什么（git 记录）
        </span>
      </button>
      {open && (
        <ul className="pb-1.5">
          {err && (
            <li className="px-3 pb-2 text-[11px]" style={{ color: 'var(--red)' }}>
              {err}
            </li>
          )}
          {!items && !err && (
            <li className="px-3 pb-2 text-[11px]" style={{ color: 'var(--muted)' }}>
              读取中…
            </li>
          )}
          {items?.map((c) => {
            const [title, ...rest] = c.message.split('\n')
            const body = rest.filter((l) => l.startsWith('- ')).slice(0, 4)
            return (
              <li key={c.sha} className="border-t px-3 py-1" style={{ borderColor: 'var(--line-2)' }}>
                <a href={c.url} target="_blank" rel="noreferrer" className="flex items-baseline gap-1.5">
                  <span
                    className="shrink-0 rounded px-1 text-[9.5px] font-semibold"
                    style={{ background: c.agent ? 'var(--accent-soft)' : 'var(--panel-2)', color: c.agent ? 'var(--accent)' : 'var(--muted)' }}
                  >
                    {c.agent ? 'Claude' : '网页/手动'}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{title.replace(/^plan:\s*/, '')}</span>
                  <span className="num shrink-0 text-[10px]" style={{ color: 'var(--faint)' }}>
                    {ago(c.date)}
                  </span>
                </a>
                {body.map((l, i) => (
                  <div key={i} className="truncate pl-1 text-[10.5px]" style={{ color: 'var(--muted)' }}>
                    {l}
                  </div>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
