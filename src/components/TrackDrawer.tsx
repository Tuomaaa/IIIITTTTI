import { diffDays, md, relDay } from '../core/date'
import type { PlanView, TaskView } from '../core/derive'
import { useUI } from '../data/ui'
import { pastel, pct, pressureColor } from '../lib/ui'
import { TodoRow } from './DayPanel'
import { Sheet } from './Sheet'

const PHASE_ORDER = { overdue: 0, active: 1, upcoming: 2, parked: 3, done: 4 } as const
const PHASE_ZH = { overdue: '过期', active: '进行中', upcoming: '未开始', parked: '暂停', done: '完成' } as const

/** Everything on one thread: tasks by phase, milestones, open todos, slip total. */
export function TrackDrawer({ view, mobile }: { view: PlanView; mobile: boolean }) {
  const id = useUI((s) => s.trackId)
  const openTrack = useUI((s) => s.openTrack)
  const openTask = useUI((s) => s.openTask)
  const tv = view.tracks.find((t) => t.track.id === id)
  if (!tv) return null
  const { track } = tv
  const { today } = view
  const tasks = [...tv.tasks].sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.task.end.localeCompare(b.task.end))
  const todos = view.todos
    .filter((t) => t.track?.id === track.id && !t.todo.done)
    .sort((a, b) => (a.showOn ?? '9999').localeCompare(b.showOn ?? '9999'))
  const doneTodos = view.todos.filter((t) => t.track?.id === track.id && t.todo.done).length

  return (
    <Sheet mobile={mobile} onClose={() => openTrack(null)}>
      <div className="sticky top-0 z-10 flex items-start gap-2 px-4 pt-3 pb-2" style={{ background: 'var(--panel)', borderBottom: '1px solid var(--line-2)' }}>
        <div className="mt-1 h-3 w-3 shrink-0 rounded-[3px]" style={{ background: track.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{track.name}</div>
          <div className="num mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
            {tv.activeCount} 进行中 · {tasks.filter((t) => t.phase === 'upcoming').length} 未开始 · {tasks.filter((t) => t.phase === 'done').length} 完成 · todo {doneTodos}/{doneTodos + todos.length}
            {tv.slipDays > 0 && <span style={{ color: 'var(--orange)' }}> · 累计推迟 {tv.slipDays} 天</span>}
            {track.paused && ' · 暂停中'}
            <span className="mono ml-1.5 text-[10px]" style={{ color: 'var(--faint)' }}>
              {track.id}
            </span>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => openTrack(null)} aria-label="关闭">
          ✕
        </button>
      </div>

      <div className="space-y-4 px-4 py-3">
        {track.note && <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{track.note}</div>}

        {tv.milestones.length > 0 && (
          <div>
            <div className="section-title mb-1">Milestone</div>
            <ul className="space-y-0.5">
              {tv.milestones.map((m) => {
                const left = diffDays(today, m.date)
                return (
                  <li key={m.id} className="flex items-center gap-2 text-[12px]" style={{ opacity: m.done ? 0.5 : 1 }}>
                    <span style={{ color: m.hard ? 'var(--red)' : track.color, fontSize: 10 }}>{m.done ? '◇' : '◆'}</span>
                    <span className={m.done ? 'line-through' : undefined}>{m.title}</span>
                    <span className="num ml-auto text-[11px]" style={{ color: !m.done && left < 0 ? 'var(--red)' : 'var(--muted)' }}>
                      {md(m.date)} · {m.done ? '完成' : relDay(m.date, today)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div>
          <div className="section-title mb-1">Task · {tasks.length}</div>
          <ul className="space-y-1">
            {tasks.map((t) => (
              <TaskRow key={t.task.id} tv={t} today={today} onOpen={() => openTask(t.task.id)} color={track.color} />
            ))}
            {!tasks.length && (
              <li className="text-[11px]" style={{ color: 'var(--faint)' }}>
                还没有 task
              </li>
            )}
          </ul>
        </div>

        <div>
          <div className="section-title mb-1">没完成的 todo · {todos.length}</div>
          <ul>
            {todos.map((t) => (
              <TodoRow key={t.todo.id} t={{ ...t, track: undefined, task: t.task }} today={today} showDate />
            ))}
            {!todos.length && (
              <li className="text-[11px]" style={{ color: 'var(--faint)' }}>
                没有
              </li>
            )}
          </ul>
        </div>
        <div className="text-[10.5px]" style={{ color: 'var(--faint)' }}>
          想调整这条线？跟 Claude 说「{track.id} 这条线…」就行。
        </div>
      </div>
    </Sheet>
  )
}

function TaskRow({ tv, today, onOpen, color }: { tv: TaskView; today: string; onOpen: () => void; color: string }) {
  const { task } = tv
  const c = tv.phase === 'overdue' ? 'var(--red)' : tv.phase === 'active' ? 'var(--accent)' : 'var(--muted)'
  return (
    <li>
      <button className="w-full rounded-md px-2 py-1.5 text-left hover:bg-[var(--panel-2)]" style={{ border: '1px solid var(--line-2)', opacity: tv.phase === 'done' ? 0.55 : 1 }} onClick={onOpen}>
        <div className="flex items-baseline gap-1.5">
          <span className="shrink-0 text-[10px] font-semibold" style={{ color: c }}>
            {PHASE_ZH[tv.phase]}
            {tv.phase === 'overdue' && ` ${tv.overdueDays}d`}
          </span>
          <span className={`min-w-0 flex-1 truncate text-[12px] font-medium ${tv.phase === 'done' ? 'line-through' : ''}`}>{task.title}</span>
          {task.hard && (
            <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'var(--red)' }}>
              硬
            </span>
          )}
          {tv.pushCount > 0 && (
            <span className="num shrink-0 text-[10px] font-semibold" style={{ color: pressureColor(tv.pressure) }}>
              +{tv.slipDays}d×{tv.pushCount}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="num w-[92px] shrink-0 text-[10.5px]" style={{ color: 'var(--muted)' }}>
            {md(task.start)} → {md(task.end)}
          </span>
          <span className="h-[8px] flex-1 overflow-hidden rounded-[3px]" style={{ background: pastel(color, 25), border: '1.5px solid var(--bar-ink)' }}>
            <span className="block h-full" style={{ width: pct(tv.progress ?? 0), background: color }} />
          </span>
          <span className="num w-[30px] shrink-0 text-right text-[10.5px]" style={{ color: 'var(--muted)' }}>
            {pct(tv.progress)}
          </span>
        </div>
        {(tv.nextFocus || tv.unscheduled) && tv.phase !== 'done' && (
          <div className="mt-0.5 text-[10.5px]" style={{ color: tv.unscheduled ? 'var(--orange)' : 'var(--muted)' }}>
            {tv.unscheduled ? '之后没排时间' : `下次做：${relDay(tv.nextFocus!, today)}`}
            {tv.milestone && ` · → ◆ ${tv.milestone.title}`}
          </div>
        )}
      </button>
    </li>
  )
}
