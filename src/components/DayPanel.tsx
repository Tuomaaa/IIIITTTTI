import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { addDays, diffDays, mdw, nowMinutes, relDay, toMinutes } from '../core/date'
import { blocksOn, layoutBlocks, settings, type PlanView, type TodoView } from '../core/derive'
import { toggleTodo } from '../core/ops'
import type { Block, ISODate } from '../core/types'
import { useStore } from '../data/store'
import { useUI } from '../data/ui'
import { cx, pct, tint } from '../lib/ui'
import { MonthMini } from './MonthMini'

function todosOn(view: PlanView, day: ISODate): TodoView[] {
  const { today } = view
  return view.todos.filter((t) => t.showOn === day || (day === today && t.todo.done && t.todo.doneAt === today && t.showOn !== today))
}

/** Day header + focus chips + hour grid. On mobile the todo list sits between chips and grid. */
export function DayPanel({ view, mobile = false }: { view: PlanView; mobile?: boolean }) {
  const sel = useUI((s) => s.day)
  const setDay = useUI((s) => s.setDay)
  const plan = useStore((s) => s.plan)
  const { today } = view
  const day = sel ?? today
  const blocks = blocksOn(plan, day)
  const blockMin = blocks.reduce((s, b) => s + toMinutes(b.end) - toMinutes(b.start), 0)
  const focus = (view.load.get(day)?.tasks ?? []).map((id) => view.taskById.get(id)!).filter(Boolean)
  const gridBox = useRef<HTMLDivElement>(null)
  const [boxH, setBoxH] = useState(0)
  useLayoutEffect(() => {
    const el = gridBox.current
    if (!el || mobile) return
    const ro = new ResizeObserver(() => setBoxH(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [mobile])
  const cfg = settings(plan)
  const range = hourRange(blocks, cfg.dayStart, cfg.dayEnd)
  const hours = (range[1] - range[0]) / 60
  const hourH = mobile ? 30 : Math.max(20, Math.min(44, Math.floor((boxH - 20) / hours)))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-1.5">
        <button className="btn btn-ghost px-1.5" onClick={() => setDay(addDays(day, -1) === today ? null : addDays(day, -1))} aria-label="前一天">
          ‹
        </button>
        <div className="num text-[13px] font-semibold">{mdw(day)}</div>
        <button className="btn btn-ghost px-1.5" onClick={() => setDay(addDays(day, 1) === today ? null : addDays(day, 1))} aria-label="后一天">
          ›
        </button>
        <span className="text-[11px]" style={{ color: day === today ? 'var(--accent)' : 'var(--muted)' }}>
          {relDay(day, today)}
        </span>
        {day !== today && (
          <button className="btn ml-1" onClick={() => setDay(null)}>
            回到今天
          </button>
        )}
        <span className="num ml-auto text-[10.5px]" style={{ color: 'var(--muted)' }}>
          {(blockMin / 60).toFixed(1)}h 已排
        </span>
      </div>

      <MonthMini view={view} cellH={mobile ? 34 : 30} />

      {focus.length > 0 && (
        <div className="px-3 pb-2">
          <div className="section-title mb-1">{day === today ? '今日聚焦' : '当天聚焦'} · {focus.length}</div>
          <div className="flex flex-wrap gap-1">
            {focus.map((tv) => (
              <FocusChip key={tv.task.id} id={tv.task.id} title={tv.task.title} color={tv.track?.color ?? '#888'} progress={tv.progress} overdue={tv.phase === 'overdue'} hard={!!tv.task.hard} endIn={diffDays(day, tv.task.end)} />
            ))}
          </div>
        </div>
      )}

      <div ref={gridBox} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {mobile && <DayTodos view={view} bare />}
        <HourGrid blocks={blocks} day={day} today={today} hourH={hourH} view={view} range={range} />
      </div>
    </div>
  )
}

function hourRange(blocks: Block[], dayStart: string, dayEnd: string): [number, number] {
  return [
    Math.min(toMinutes(dayStart), ...blocks.map((b) => Math.floor(toMinutes(b.start) / 60) * 60)),
    Math.max(toMinutes(dayEnd), ...blocks.map((b) => Math.ceil(toMinutes(b.end) / 60) * 60)),
  ]
}

/** Todo list for the selected day (plus backlog when it is today). */
export function DayTodos({ view, bare = false }: { view: PlanView; bare?: boolean }) {
  const sel = useUI((s) => s.day)
  const day = sel ?? view.today
  const todos = todosOn(view, day)
  const body = (
    <>
      <TodoList todos={todos} view={view} day={day} />
      {day === view.today && <Backlog view={view} />}
    </>
  )
  if (bare) return <div className="pt-1">{body}</div>
  return <section className="panel overflow-hidden pt-2.5">{body}</section>
}

function FocusChip(props: { id: string; title: string; color: string; progress: number | null; overdue: boolean; hard: boolean; endIn: number }) {
  const openTask = useUI((s) => s.openTask)
  return (
    <button
      className="flex max-w-full items-center gap-1 overflow-hidden rounded-[4px] py-[2px] pr-1.5 pl-0 text-[11px]"
      style={{ background: tint(props.color, 14), border: `1px solid ${tint(props.color, 40)}` }}
      onClick={() => openTask(props.id)}
    >
      <span className="self-stretch" style={{ width: 3, background: props.color }} />
      <span className="truncate">{props.title}</span>
      {props.progress != null && (
        <span className="num shrink-0 text-[10px]" style={{ color: 'var(--muted)' }}>
          {pct(props.progress)}
        </span>
      )}
      {props.overdue ? (
        <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'var(--red)' }}>
          过期
        </span>
      ) : props.endIn <= 1 ? (
        <span className="shrink-0 text-[10px] font-semibold" style={{ color: props.hard ? 'var(--red)' : 'var(--orange)' }}>
          {props.endIn === 0 ? '今天截止' : '明天截止'}
        </span>
      ) : null}
    </button>
  )
}

function HourGrid({ blocks, day, today, hourH, view, range }: { blocks: Block[]; day: ISODate; today: ISODate; hourH: number; view: PlanView; range: [number, number] }) {
  const openTask = useUI((s) => s.openTask)
  const setHover = useUI((s) => s.setHover)
  const [now, setNow] = useState(() => nowMinutes())
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 60_000)
    return () => clearInterval(t)
  }, [])
  const [startMin, endMin] = range
  const hours: number[] = []
  for (let m = startMin; m < endMin; m += 60) hours.push(m)
  const y = (min: number) => ((min - startMin) / 60) * hourH
  const laid = layoutBlocks(blocks)
  const GUTTER = 30

  return (
    <div className="relative mx-3 mt-2 mb-3" style={{ height: hours.length * hourH }}>
      {hours.map((m) => (
        <div key={m} className="absolute right-0 left-0 flex" style={{ top: y(m), height: hourH, borderTop: '1px solid var(--line-2)' }}>
          <span className="num -mt-[6px] w-[30px] pr-1 text-right text-[9.5px]" style={{ color: 'var(--faint)', background: 'var(--panel)', height: 11 }}>
            {m / 60}
          </span>
        </div>
      ))}
      {laid.map(({ block: b, col, cols }) => {
        const top = y(toMinutes(b.start))
        const h = Math.max(12, y(toMinutes(b.end)) - top - 1)
        const track = b.trackId ? view.trackById.get(b.trackId) : b.taskId ? view.taskById.get(b.taskId)?.track : undefined
        const color = track?.color ?? '#888'
        const kind = b.kind ?? 'focus'
        const tv = b.taskId ? view.taskById.get(b.taskId) : undefined
        return (
          <div
            key={b.id}
            className={cx('absolute overflow-hidden rounded-[3px] px-1 text-[10.5px] leading-[12px]', b.taskId && 'cursor-pointer')}
            style={{
              top,
              height: h,
              left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${col / cols})`,
              width: `calc((100% - ${GUTTER}px) / ${cols} - 2px)`,
              background: kind === 'routine' ? 'var(--panel-2)' : tint(color, kind === 'event' ? 30 : 16),
              borderLeft: `3px solid ${kind === 'routine' ? 'var(--line)' : color}`,
              color: kind === 'routine' ? 'var(--muted)' : 'var(--text)',
              paddingTop: h > 20 ? 2 : 0,
            }}
            onClick={() => b.taskId && openTask(b.taskId)}
            onMouseEnter={(e) =>
              setHover({
                x: e.clientX,
                y: e.clientY,
                content: (
                  <div className="space-y-0.5">
                    <div className="font-semibold">{b.title}</div>
                    <div className="num" style={{ color: 'var(--muted)' }}>
                      {b.start}–{b.end} · {kind === 'event' ? '固定日程' : kind === 'routine' ? '日常' : '专注'}
                      {track && ` · ${track.name}`}
                    </div>
                    {tv && <div>→ {tv.task.title}</div>}
                  </div>
                ),
              })
            }
            onMouseLeave={() => setHover(null)}
          >
            <span className={cx(kind === 'event' && 'font-semibold')}>{b.title}</span>
            {h >= 24 && (
              <div className="num text-[9.5px]" style={{ color: 'var(--muted)' }}>
                {b.start}–{b.end}
              </div>
            )}
          </div>
        )
      })}
      {day === today && now >= startMin && now <= endMin && (
        <div className="pointer-events-none absolute right-0 z-10 flex items-center" style={{ top: y(now) - 4, left: GUTTER - 4 }}>
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--red)' }} />
          <span className="h-[1.5px] flex-1" style={{ background: 'var(--red)' }} />
        </div>
      )}
      {!blocks.length && (
        <div className="absolute inset-x-0 top-6 text-center text-[11px]" style={{ color: 'var(--faint)' }}>
          这天还没排时间块
        </div>
      )}
    </div>
  )
}

function TodoList({ todos, view, day }: { todos: TodoView[]; view: PlanView; day: ISODate }) {
  const sorted = [...todos].sort((a, b) => Number(!!a.todo.done) - Number(!!b.todo.done) || b.age - a.age)
  const done = todos.filter((t) => t.todo.done).length
  return (
    <div className="px-3 pb-3">
      <div className="section-title mb-1 flex items-center">
        {day === view.today ? '今天的 todo' : `${mdw(day)} 的 todo`}
        <span className="num ml-1">
          {done}/{todos.length}
        </span>
        {todos.length > 0 && (
          <span className="ml-2 h-[3px] flex-1 overflow-hidden rounded" style={{ background: 'var(--line-2)' }}>
            <span className="block h-full" style={{ width: `${(done / todos.length) * 100}%`, background: 'var(--green)' }} />
          </span>
        )}
      </div>
      {!todos.length && (
        <div className="py-1 text-[11px]" style={{ color: 'var(--faint)' }}>
          {day < view.today ? '这天没有 todo' : '没有 todo'}
        </div>
      )}
      <ul className="space-y-[1px]">
        {sorted.map((t) => (
          <TodoRow key={t.todo.id} t={t} today={view.today} />
        ))}
      </ul>
    </div>
  )
}

export function TodoRow({ t, today, showDate = false }: { t: TodoView; today: ISODate; showDate?: boolean }) {
  const apply = useStore((s) => s.apply)
  const openTask = useUI((s) => s.openTask)
  const { todo } = t
  const color = t.track?.color
  return (
    <li className="flex items-center gap-1.5 rounded px-1 py-[3px] hover:bg-[var(--panel-2)]">
      <button
        className="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[3px] text-[9px]"
        style={{
          border: `1.5px solid ${todo.done ? 'var(--green)' : t.stale ? 'var(--red)' : 'var(--faint)'}`,
          background: todo.done ? 'var(--green)' : undefined,
          color: 'var(--panel)',
        }}
        onClick={() => apply(`${todo.done ? '取消完成' : '完成'} todo「${todo.title}」`, (p) => toggleTodo(p, todo.id, today))}
        aria-label={todo.done ? '标记未完成' : '标记完成'}
      >
        {todo.done ? '✓' : ''}
      </button>
      <span className={cx('min-w-[40%] flex-1 truncate', todo.done && 'line-through')} style={{ color: todo.done ? 'var(--faint)' : undefined }} title={todo.title}>
        {todo.title}
      </span>
      {t.rolled && !todo.done && (
        <span
          className="num shrink-0 rounded px-1 text-[9.5px] font-semibold"
          style={{ color: t.stale ? 'var(--red)' : 'var(--orange)', background: t.stale ? 'var(--red-soft)' : 'var(--orange-soft)' }}
          title={`从 ${todo.origDate ?? todo.date} 拖到现在`}
        >
          ↻{t.age}d
        </span>
      )}
      {todo.est && (
        <span className="num shrink-0 text-[10px]" style={{ color: 'var(--faint)' }}>
          {todo.est >= 60 ? `${+(todo.est / 60).toFixed(1)}h` : `${todo.est}m`}
        </span>
      )}
      {showDate && t.showOn && (
        <span className="num shrink-0 text-[10px]" style={{ color: 'var(--faint)' }}>
          {relDay(t.showOn, today)}
        </span>
      )}
      {(t.task || t.track) && (
        <button
          className="flex min-w-0 shrink items-center gap-1 text-[10px]"
          style={{ color: 'var(--muted)', maxWidth: '42%' }}
          onClick={() => t.task && openTask(t.task.id)}
          title={t.task ? `${t.track?.name} / ${t.task.title}` : t.track?.name}
        >
          <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate">{t.task ? t.task.title : t.track?.name}</span>
        </button>
      )}
    </li>
  )
}

function Backlog({ view }: { view: PlanView }) {
  const [open, setOpen] = useState(false)
  const items = view.todos.filter((t) => !t.todo.date && !t.todo.done)
  if (!items.length) return null
  return (
    <div className="px-3 pb-4">
      <button className="section-title flex items-center gap-1" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} backlog <span className="num">{items.length}</span>
      </button>
      {open && (
        <ul className="mt-1 space-y-[1px]">
          {items.map((t) => (
            <TodoRow key={t.todo.id} t={t} today={view.today} />
          ))}
        </ul>
      )}
    </div>
  )
}
