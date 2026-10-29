import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { addDays, daysBetween, diffDays, md, relDay, weekday, WEEKDAY_ZH } from '../core/date'
import { packLanes, settings, type PlanView, type TaskView, type TrackView } from '../core/derive'
import type { ISODate, Milestone } from '../core/types'
import { useStore } from '../data/store'
import { useUI, type Zoom } from '../data/ui'
import { cx, pressureColor, tint } from '../lib/ui'
import { MilestoneTip, TaskTip } from './Tooltip'

const LANE_H = 20
const BAR_H = 16
const ROW_PAD = 4
const MS_STRIP = 13
const HEAD_MONTH = 15
const HEAD_DAY = 26
const HEAD_LOAD = 16
const HEAD_H = HEAD_MONTH + HEAD_DAY + HEAD_LOAD
const PAST_DAYS = 21
const FUTURE_DAYS = 120

export const ZOOM_DAYS: Record<Zoom, number> = { w2: 14, w4: 21, w8: 42 }
export const ZOOM_LABEL: Record<Zoom, string> = { w2: '2 周', w4: '3 周', w8: '6 周' }

interface Props {
  view: PlanView
  compact?: boolean
}

export function Gantt({ view, compact = false }: Props) {
  const zoom = useUI((s) => s.zoom)
  const activeOnly = useUI((s) => s.activeOnly)
  const selected = useUI((s) => s.day)
  const plan = useStore((s) => s.plan)
  const scroller = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const { today } = view
  const labelW = compact ? 92 : 208
  const minRow = compact ? 30 : 36

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const visible = compact ? Math.min(ZOOM_DAYS[zoom], 10) : ZOOM_DAYS[zoom]
  const dw = Math.max(14, Math.floor((width - labelW) / visible))
  const from = addDays(today, -PAST_DAYS)
  const to = addDays(today, FUTURE_DAYS)
  const days = useMemo(() => daysBetween(from, to), [from, to])
  const x = (d: ISODate) => diffDays(from, d) * dw
  const maxParallel = settings(plan).maxParallel

  const scrollToToday = () => {
    const el = scroller.current
    if (el) el.scrollLeft = Math.max(0, (diffDays(from, today) - 2) * dw)
  }
  useEffect(scrollToToday, [dw, today]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = () => scrollToToday()
    window.addEventListener('gantt:today', h)
    return () => window.removeEventListener('gantt:today', h)
  })

  const tracks = activeOnly ? view.tracks.filter((t) => t.rank <= 2) : view.tracks
  const rows = tracks.map((tv) => {
    const badgeDays = (t: TaskView) => Math.ceil(badgeWidth(t) / dw)
    const lanes = packLanes(tv.tasks, badgeDays)
    const ms = tv.milestones.filter((m) => m.date >= from && m.date <= to)
    const h = Math.max(minRow, ROW_PAD * 2 + Math.max(1, lanes.length) * LANE_H + (ms.length ? MS_STRIP : 0))
    return { tv, lanes, ms, h }
  })
  const bodyH = rows.reduce((s, r) => s + r.h, 0)
  const totalW = labelW + days.length * dw

  return (
    <div ref={scroller} className="scroll-thin relative h-full overflow-auto" style={{ overscrollBehaviorX: 'contain' }}>
      <div className="relative" style={{ width: totalW, minHeight: HEAD_H + bodyH }}>
        <Header days={days} dw={dw} labelW={labelW} today={today} selected={selected} view={view} maxParallel={maxParallel} trackCount={tracks.length} compact={compact} />
        <Grid days={days} dw={dw} labelW={labelW} today={today} height={bodyH} />
        {rows.map(({ tv, lanes, ms, h }) => (
          <Row key={tv.track.id} tv={tv} lanes={lanes} ms={ms} h={h} x={x} dw={dw} labelW={labelW} today={today} compact={compact} />
        ))}
        {!rows.length && (
          <div className="p-6 text-center" style={{ color: 'var(--muted)' }}>
            没有进行中的线程
          </div>
        )}
      </div>
    </div>
  )
}

/** Approx. pixel width of the slip / overdue badge drawn after a bar. */
function badgeWidth(t: TaskView): number {
  const text = badgeText(t)
  return text ? text.length * 6.2 + 8 : 0
}

function badgeText(t: TaskView): string {
  const parts: string[] = []
  if (t.phase === 'overdue') parts.push(`过期${t.overdueDays}d`)
  if (t.pushCount) parts.push(`+${t.slipDays}d×${t.pushCount}`)
  return parts.join(' ')
}

const Header = memo(function Header({
  days,
  dw,
  labelW,
  today,
  selected,
  view,
  maxParallel,
  trackCount,
  compact,
}: {
  days: ISODate[]
  dw: number
  labelW: number
  today: ISODate
  selected: ISODate | null
  view: PlanView
  maxParallel: number
  trackCount: number
  compact: boolean
}) {
  const setDay = useUI((s) => s.setDay)
  const setHover = useUI((s) => s.setHover)
  const months = days.filter((d, i) => i === 0 || d.endsWith('-01'))
  return (
    <div className="sticky top-0 z-20 flex" style={{ height: HEAD_H, background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
      <div
        className="sticky left-0 z-30 flex shrink-0 flex-col justify-end px-2 pb-1"
        style={{ width: labelW, background: 'var(--panel)', borderRight: '1px solid var(--line)' }}
      >
        <div className="section-title">{compact ? '线程' : `线程 · ${trackCount}`}</div>
        <div className="text-[10px]" style={{ color: 'var(--faint)', height: HEAD_LOAD - 2 }}>
          {compact ? '负载' : '每日并行数'}
        </div>
      </div>
      <div className="relative" style={{ width: days.length * dw }}>
        {months.map((d) => {
          const i = days.indexOf(d)
          return (
            <div key={d} className="absolute top-0 pl-1 text-[10.5px] font-semibold" style={{ left: i * dw, height: HEAD_MONTH, color: 'var(--muted)', borderLeft: i ? '1px solid var(--line)' : undefined }}>
              {Number(d.slice(5, 7))}月
            </div>
          )
        })}
        {days.map((d, i) => {
          const isToday = d === today
          const wd = weekday(d)
          const load = view.load.get(d)
          const n = load?.tasks.length ?? 0
          const over = n > maxParallel
          return (
            <button
              key={d}
              className="absolute flex flex-col items-center justify-start"
              style={{ left: i * dw, top: HEAD_MONTH, width: dw, height: HEAD_DAY + HEAD_LOAD }}
              onClick={() => setDay(d === today ? null : d)}
              onMouseEnter={(e) =>
                load &&
                setHover({
                  x: e.clientX,
                  y: e.clientY,
                  content: <LoadTip d={d} view={view} />,
                })
              }
              onMouseLeave={() => setHover(null)}
              aria-label={`选择 ${d}`}
            >
              <div
                className={cx('num flex flex-col items-center rounded leading-[11px]')}
                style={{
                  width: dw - 2,
                  height: HEAD_DAY - 2,
                  paddingTop: 2,
                  background: isToday ? 'var(--accent)' : undefined,
                  color: isToday ? 'var(--panel)' : wd === 0 || wd === 6 ? 'var(--faint)' : 'var(--text)',
                  outline: selected === d && !isToday ? '1.5px solid var(--accent)' : undefined,
                }}
              >
                {dw >= 24 ? (
                  <>
                    <span className="text-[9.5px] opacity-80">{WEEKDAY_ZH[wd]}</span>
                    <span className="text-[11px] font-medium">{Number(d.slice(8))}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[9px] opacity-80">{wd === 1 ? '一' : '\u00a0'}</span>
                    <span className="text-[9.5px] font-medium tracking-tighter">{Number(d.slice(8))}</span>
                  </>
                )}
              </div>
              <div
                className="num mt-[1px] flex items-center justify-center text-[9.5px] font-semibold"
                style={{
                  width: dw - 2,
                  height: HEAD_LOAD - 3,
                  borderRadius: 2,
                  background: n ? (over ? 'var(--red-soft)' : `color-mix(in oklab, var(--accent) ${Math.min(40, 8 + n * 7)}%, transparent)`) : undefined,
                  color: over ? 'var(--red)' : n ? 'var(--text)' : 'transparent',
                }}
              >
                {n || ''}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
})

function LoadTip({ d, view }: { d: ISODate; view: PlanView }) {
  const load = view.load.get(d)!
  return (
    <div className="space-y-1">
      <div className="font-semibold">
        {md(d)} 周{WEEKDAY_ZH[weekday(d)]} · {relDay(d, view.today)}
      </div>
      <div style={{ color: 'var(--muted)' }}>
        聚焦 {load.tasks.length} 项 · 时间块 {(load.blockMin / 60).toFixed(1)}h · todo {load.todos}
      </div>
      {load.tasks.map((id) => {
        const tv = view.taskById.get(id)!
        return (
          <div key={id} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: tv.track?.color }} />
            {tv.task.title}
          </div>
        )
      })}
    </div>
  )
}

const Grid = memo(function Grid({ days, dw, labelW, today, height }: { days: ISODate[]; dw: number; labelW: number; today: ISODate; height: number }) {
  return (
    <div className="pointer-events-none absolute" style={{ left: labelW, top: HEAD_H, height, width: days.length * dw }}>
      {days.map((d, i) => {
        const wd = weekday(d)
        const isToday = d === today
        if (!isToday && wd !== 0 && wd !== 6 && wd !== 1) return null
        return (
          <div
            key={d}
            className="absolute top-0 bottom-0"
            style={{
              left: i * dw,
              width: dw,
              background: isToday ? 'var(--accent-soft)' : wd === 0 || wd === 6 ? 'var(--weekend)' : undefined,
              borderLeft: wd === 1 ? '1px solid var(--line-2)' : undefined,
            }}
          />
        )
      })}
      <div className="absolute top-0 bottom-0" style={{ left: diffDays(days[0], today) * dw, width: 1.5, background: 'var(--accent)', opacity: 0.6 }} />
    </div>
  )
})

function Row({
  tv,
  lanes,
  ms,
  h,
  x,
  dw,
  labelW,
  today,
  compact,
}: {
  tv: TrackView
  lanes: TaskView[][]
  ms: Milestone[]
  h: number
  x: (d: ISODate) => number
  dw: number
  labelW: number
  today: ISODate
  compact: boolean
}) {
  const { track } = tv
  const setHover = useUI((s) => s.setHover)
  const msTop = ROW_PAD + Math.max(1, lanes.length) * LANE_H - 2
  return (
    <div className="relative flex" style={{ height: h, borderBottom: '1px solid var(--line-2)', opacity: track.paused ? 0.5 : 1 }}>
      <Label tv={tv} labelW={labelW} today={today} compact={compact} />
      <div className="relative flex-1">
        {lanes.map((lane, li) =>
          lane.map((t) => <Bar key={t.task.id} tv={t} left={x(t.task.start)} top={ROW_PAD + li * LANE_H} dw={dw} today={today} stick={labelW + 4} />),
        )}
        {ms.map((m) => {
          const overdue = !m.done && m.date < today
          const c = m.done ? 'var(--faint)' : m.hard || overdue ? 'var(--red)' : track.color
          return (
            <div
              key={m.id}
              className="absolute flex items-center gap-[3px] whitespace-nowrap"
              style={{ left: x(m.date) + dw / 2 - 5, top: msTop, height: MS_STRIP }}
              onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, content: <MilestoneTip m={m} track={track} today={today} /> })}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className="inline-block"
                style={{
                  width: 8,
                  height: 8,
                  transform: 'rotate(45deg)',
                  background: m.done ? 'transparent' : c,
                  border: `1.5px solid ${m.done ? 'var(--faint)' : c}`,
                  boxShadow: '0 0 0 1.5px var(--panel)',
                }}
              />
              <span className="text-[10px] font-medium" style={{ color: m.hard ? 'var(--red)' : 'var(--muted)', textDecoration: m.done ? 'line-through' : undefined }}>
                {m.title}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Label({ tv, labelW, today, compact }: { tv: TrackView; labelW: number; today: ISODate; compact: boolean }) {
  const { track } = tv
  return (
    <div
      className="sticky left-0 z-10 flex shrink-0 overflow-hidden"
      style={{ width: labelW, background: 'var(--panel)', borderRight: '1px solid var(--line)' }}
      title={track.note}
    >
      <div className="shrink-0" style={{ width: 3, background: track.color }} />
      <div className="min-w-0 flex-1 px-1.5 pt-[3px]">
        <div className="flex items-center gap-1">
          <span className="truncate font-semibold" style={{ fontSize: compact ? 11 : 12 }}>
            {track.name}
          </span>
          {track.paused && (
            <span className="shrink-0 text-[9.5px]" style={{ color: 'var(--muted)' }}>
              暂停
            </span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-semibold num">
            {tv.overdueCount > 0 && <span style={{ color: 'var(--red)' }}>!{tv.overdueCount}</span>}
            {!compact && tv.slipDays > 0 && <span style={{ color: pressureColor(tv.pushCount >= 3 ? 3 : 2) }}>+{tv.slipDays}d</span>}
          </span>
        </div>
        {!compact && tv.next && (
          <div className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--muted)' }}>
            <span className="truncate">→ {tv.next.title}</span>
            {tv.next.date ? (
              <span className="num ml-auto shrink-0" style={{ color: tv.next.date < today ? 'var(--orange)' : tv.next.date === today ? 'var(--accent)' : 'var(--faint)' }}>
                {relDay(tv.next.date, today)}
              </span>
            ) : (
              tv.next.kind === 'task' && (
                <span className="ml-auto shrink-0" style={{ color: 'var(--orange)' }}>
                  没排
                </span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const Bar = memo(function Bar({ tv, left, top, dw, today, stick }: { tv: TaskView; left: number; top: number; dw: number; today: ISODate; stick: number }) {
  const setHover = useUI((s) => s.setHover)
  const openTask = useUI((s) => s.openTask)
  const { task } = tv
  const color = tv.track?.color ?? '#888'
  const span = diffDays(task.start, task.end) + 1
  const width = (diffDays(task.start, tv.visualEnd) + 1) * dw
  const done = tv.phase === 'done'
  const parked = tv.phase === 'parked'
  const badge = badgeText(tv)
  const at = (d: ISODate) => diffDays(task.start, d) * dw

  return (
    <div
      className="absolute cursor-pointer"
      style={{ left, top, width, height: BAR_H, opacity: done ? 0.5 : parked ? 0.55 : tv.phase === 'upcoming' ? 0.78 : 1 }}
      onClick={() => openTask(task.id)}
      onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, content: <TaskTip tv={tv} today={today} /> })}
      onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, content: <TaskTip tv={tv} today={today} /> })}
      onMouseLeave={() => setHover(null)}
    >
      {/* window */}
      <div
        className="absolute top-0 bottom-0 left-0 rounded-[3px]"
        style={{
          width: span * dw,
          background: parked ? 'transparent' : tint(color, done ? 14 : 18),
          border: `1px ${parked ? 'dashed' : 'solid'} ${tint(color, 55)}`,
        }}
      />
      {/* focus days */}
      {!parked &&
        tv.focus.map((d) => {
          const past = d < today
          const isToday = d === today
          return (
            <div
              key={d}
              className="absolute top-0 bottom-0 rounded-[2px]"
              style={{
                left: at(d) + 1,
                width: dw - 2,
                background: tint(color, done ? 40 : past ? 42 : 78),
                boxShadow: isToday ? `0 0 0 1.5px var(--panel), 0 0 0 3px ${color}` : undefined,
                zIndex: isToday ? 1 : undefined,
              }}
            />
          )
        })}
      {/* overdue tail */}
      {tv.phase === 'overdue' && (
        <div
          className="hatch-red absolute top-0 bottom-0 rounded-r-[3px]"
          style={{ left: span * dw, width: tv.overdueDays * dw, border: '1px solid var(--red)', borderLeft: 'none', background: 'var(--red-soft)' }}
        >
          <div className="hatch-red absolute inset-0" />
        </div>
      )}
      {/* progress */}
      {tv.progress != null && tv.progress > 0 && !done && (
        <div
          className="absolute bottom-0 left-0 rounded-bl-[3px]"
          style={{ width: Math.max(2, span * dw * tv.progress), height: 2.5, background: `color-mix(in oklab, ${color} 65%, var(--text))` }}
        />
      )}
      {/* baseline: where it was originally supposed to end */}
      {task.baseline && task.baseline < task.end && (
        <div
          className="absolute"
          style={{ left: at(task.baseline) + dw - 1, top: -2, bottom: -2, borderLeft: '1.5px dashed var(--text)', opacity: 0.55 }}
        />
      )}
      {/* hard deadline cap */}
      {task.hard && !done && (
        <div className="absolute top-[-1px] bottom-[-1px] rounded-r-[3px]" style={{ left: span * dw - 3, width: 3, background: 'var(--red)' }} />
      )}
      {/* title: sticks to the left edge of the viewport when the bar starts off-screen */}
      <div className="pointer-events-none absolute inset-0" style={{ overflow: 'clip', zIndex: 2 }}>
        <div
          className="halo sticky inline-block max-w-full truncate px-1 align-top text-[11px] font-medium"
          style={{ left: stick, lineHeight: `${BAR_H}px`, textDecoration: done ? 'line-through' : undefined }}
        >
          {done ? '✓ ' : parked ? '⏸ ' : ''}
          {task.title}
        </div>
      </div>
      {badge && (
        <div
          className="num pointer-events-none absolute top-0 flex items-center whitespace-nowrap pl-1 text-[10px] font-semibold"
          style={{ left: width, height: BAR_H, color: tv.phase === 'overdue' ? 'var(--red)' : pressureColor(tv.pressure) }}
        >
          {badge}
        </div>
      )}
    </div>
  )
})
