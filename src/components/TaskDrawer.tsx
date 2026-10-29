import { useState } from 'react'
import { daysBetween, diffDays, md, mdw, weekday, WEEKDAY_ZH } from '../core/date'
import type { PlanView } from '../core/derive'
import { setParked, setProgress, setTaskDone } from '../core/ops'
import { useStore } from '../data/store'
import { useUI } from '../data/ui'
import { pct, pressureColor, tint } from '../lib/ui'
import { TodoRow } from './DayPanel'
import { PushForm } from './SidePanel'

const PHASE = {
  done: ['已完成', 'var(--green)'],
  parked: ['暂停', 'var(--muted)'],
  overdue: ['过期', 'var(--red)'],
  active: ['进行中', 'var(--accent)'],
  upcoming: ['未开始', 'var(--muted)'],
} as const

export function TaskDrawer({ view, mobile }: { view: PlanView; mobile: boolean }) {
  const id = useUI((s) => s.taskId)
  const openTask = useUI((s) => s.openTask)
  const apply = useStore((s) => s.apply)
  const plan = useStore((s) => s.plan)
  const [pushing, setPushing] = useState(false)
  const tv = id ? view.taskById.get(id) : undefined
  if (!tv) return null
  const { task, track } = tv
  const color = track?.color ?? '#888'
  const { today } = view
  const todos = view.todos.filter((t) => t.todo.taskId === task.id).sort((a, b) => (a.todo.date ?? '9').localeCompare(b.todo.date ?? '9'))
  const blocks = plan.blocks.filter((b) => b.taskId === task.id).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const winStart = tv.focus[0] && tv.focus[0] < task.start ? tv.focus[0] : task.start
  const lastFocus = tv.focus.at(-1)
  const winEnd = lastFocus && lastFocus > tv.visualEnd ? lastFocus : tv.visualEnd
  const span = daysBetween(winStart, winEnd)
  const [label, labelColor] = PHASE[tv.phase]

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,.18)' }} onClick={() => openTask(null)} />
      <aside
        className="fade-in scroll-thin fixed z-50 overflow-y-auto"
        style={
          mobile
            ? { left: 0, right: 0, bottom: 0, maxHeight: '82vh', background: 'var(--panel)', borderTop: '1px solid var(--line)', borderRadius: '12px 12px 0 0', boxShadow: 'var(--shadow)' }
            : { top: 8, right: 8, bottom: 8, width: 380, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: 'var(--shadow)' }
        }
      >
        <div className="sticky top-0 z-10 flex items-start gap-2 px-4 pt-3 pb-2" style={{ background: 'var(--panel)', borderBottom: '1px solid var(--line-2)' }}>
          <div className="mt-1 h-3 w-3 shrink-0 rounded-[3px]" style={{ background: color }} />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold leading-snug">{task.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              <span>{track?.name}</span>
              <span className="rounded px-1 font-semibold" style={{ color: labelColor, background: 'var(--panel-2)' }}>
                {label}
                {tv.phase === 'overdue' && ` ${tv.overdueDays}d`}
              </span>
              {task.hard && (
                <span className="rounded px-1 font-semibold" style={{ color: 'var(--red)', background: 'var(--red-soft)' }}>
                  硬 ddl
                </span>
              )}
              <span className="mono text-[10px]" style={{ color: 'var(--faint)' }}>
                {task.id}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => openTask(null)} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            <Fact k="窗口" v={`${md(task.start)} → ${md(task.end)}`} sub={`${diffDays(task.start, task.end) + 1} 天`} />
            <Fact k="进度" v={pct(tv.progress)} sub={tv.todoTotal ? `todo ${tv.todoDone}/${tv.todoTotal}` : task.progress != null ? '手动' : '无数据'} />
            <Fact
              k="推迟"
              v={tv.pushCount ? `+${tv.slipDays}d` : '0'}
              sub={tv.pushCount ? `${tv.pushCount} 次 · 原定 ${md(task.baseline ?? task.end)}` : '没推过'}
              color={tv.pushCount ? pressureColor(tv.pressure) : undefined}
            />
          </div>

          <div>
            <div className="section-title mb-1">排期 · 实心 = 打算做的日子</div>
            <div className="flex flex-wrap gap-[2px]">
              {span.map((d) => {
                const inWin = d >= task.start && d <= task.end
                const f = tv.focus.includes(d)
                const tail = d > task.end && d <= tv.visualEnd
                return (
                  <div
                    key={d}
                    className="num flex h-[30px] w-[26px] flex-col items-center justify-center rounded-[3px] text-[9.5px] leading-[11px]"
                    style={{
                      background: f ? tint(color, d < today ? 45 : 80) : tail ? 'var(--red-soft)' : inWin ? tint(color, 14) : 'transparent',
                      border: d === today ? '1.5px solid var(--text)' : `1px solid ${tail ? 'var(--red)' : inWin ? tint(color, 40) : 'var(--line)'}`,
                      color: weekday(d) % 6 === 0 ? 'var(--muted)' : undefined,
                    }}
                    title={d}
                  >
                    <span>{WEEKDAY_ZH[weekday(d)]}</span>
                    <span className="font-semibold">{Number(d.slice(8))}</span>
                  </div>
                )
              })}
            </div>
            {tv.unscheduled && (
              <div className="mt-1 text-[11px]" style={{ color: 'var(--orange)' }}>
                今天之后没有排任何一天。
              </div>
            )}
          </div>

          {tv.milestone && (
            <div className="text-[12px]">
              <span className="section-title mr-2">通向</span>
              <span style={{ color: tv.milestone.hard ? 'var(--red)' : color }}>◆</span> {tv.milestone.title} · {mdw(tv.milestone.date)}
              {task.end > tv.milestone.date && (
                <span className="ml-1 font-semibold" style={{ color: 'var(--orange)' }}>
                  task 结束晚于 milestone {diffDays(tv.milestone.date, task.end)} 天
                </span>
              )}
            </div>
          )}

          {(task.slips?.length ?? 0) > 0 && (
            <div>
              <div className="section-title mb-1">推迟记录</div>
              <ol className="space-y-1 border-l pl-3" style={{ borderColor: 'var(--line)' }}>
                {task.slips!.map((s, i) => (
                  <li key={i} className="relative text-[11.5px]">
                    <span className="absolute top-[5px] -left-[16px] h-[7px] w-[7px] rounded-full" style={{ background: pressureColor(Math.min(3, i + 1) as 1 | 2 | 3) }} />
                    <span className="num font-semibold" style={{ color: pressureColor(Math.min(3, i + 1) as 1 | 2 | 3) }}>
                      第 {i + 1} 次 +{diffDays(s.from, s.to)}d
                    </span>
                    <span className="num" style={{ color: 'var(--muted)' }}>
                      {' '}
                      {md(s.from)} → {md(s.to)} · {md(s.at)} {s.by === 'agent' ? 'agent 推' : s.by === 'auto' ? '自动' : '手动'}
                    </span>
                    {s.reason && <div style={{ color: 'var(--muted)' }}>{s.reason}</div>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {todos.length > 0 && (
            <div>
              <div className="section-title mb-1">
                todo {tv.todoDone}/{tv.todoTotal}
              </div>
              <ul>
                {todos.map((t) => (
                  <TodoRow key={t.todo.id} t={{ ...t, task: undefined, track: undefined }} today={today} showDate />
                ))}
              </ul>
            </div>
          )}

          {blocks.length > 0 && (
            <div>
              <div className="section-title mb-1">时间块</div>
              <ul className="space-y-0.5 text-[11.5px]">
                {blocks.map((b) => (
                  <li key={b.id} className="num flex gap-2" style={{ color: b.date < today ? 'var(--muted)' : undefined }}>
                    <span className="w-[74px] shrink-0">{mdw(b.date)}</span>
                    <span className="w-[76px] shrink-0">
                      {b.start}–{b.end}
                    </span>
                    <span className="truncate">{b.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {task.note && (
            <div>
              <div className="section-title mb-1">备注</div>
              <div className="whitespace-pre-wrap text-[12px]">{task.note}</div>
            </div>
          )}

          <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--line-2)' }}>
            <div className="flex flex-wrap gap-1">
              {tv.phase !== 'done' ? (
                <button className="btn" onClick={() => apply(`完成「${task.title}」`, (p) => setTaskDone(p, task.id, true, today))}>
                  ✓ 完成
                </button>
              ) : (
                <button className="btn" onClick={() => apply(`重开「${task.title}」`, (p) => setTaskDone(p, task.id, false, today))}>
                  重开
                </button>
              )}
              {!task.hard && tv.phase !== 'done' && (
                <button className="btn" onClick={() => setPushing(!pushing)}>
                  推后…
                </button>
              )}
              <button className="btn" onClick={() => apply(`${task.parked ? '恢复' : '暂停'}「${task.title}」`, (p) => setParked(p, task.id, !task.parked))}>
                {task.parked ? '恢复' : '⏸ 暂停'}
              </button>
              {task.progress != null && tv.phase !== 'done' && (
                <>
                  <button className="btn" onClick={() => apply(`进度「${task.title}」`, (p) => setProgress(p, task.id, (task.progress ?? 0) - 0.1))}>
                    −10%
                  </button>
                  <button className="btn" onClick={() => apply(`进度「${task.title}」`, (p) => setProgress(p, task.id, (task.progress ?? 0) + 0.1))}>
                    +10%
                  </button>
                </>
              )}
            </div>
            {pushing && <PushForm id={task.id} view={view} onDone={() => setPushing(false)} />}
            <div className="text-[10.5px]" style={{ color: 'var(--faint)' }}>
              想改得更多？直接跟 Claude 说「把 {task.id} …」就行。
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function Fact({ k, v, sub, color }: { k: string; v: string; sub: string; color?: string }) {
  return (
    <div className="rounded-md px-2 py-1.5" style={{ background: 'var(--panel-2)' }}>
      <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
        {k}
      </div>
      <div className="num text-[13px] font-semibold" style={{ color }}>
        {v}
      </div>
      <div className="num truncate text-[10px]" style={{ color: 'var(--muted)' }}>
        {sub}
      </div>
    </div>
  )
}
