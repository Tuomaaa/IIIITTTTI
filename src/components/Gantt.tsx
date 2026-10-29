import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { addDays, daysBetween, diffDays, md, relDay, weekday, WEEKDAY_ZH } from '../core/date'
import { packLanes, settings, type PlanView, type TaskView, type TrackView } from '../core/derive'
import type { ISODate, Milestone } from '../core/types'
import { useStore } from '../data/store'
import { useUI, type Zoom } from '../data/ui'
import { pastel, stickerStyle } from '../lib/ui'
import { MilestoneTip, TaskTip } from './Tooltip'

const LANE_H = 21
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

interface Badge {
  text: string
  level: 1 | 2 | 3 | 'overdue'
}

/** Stickers drawn after a bar: days overdue, then total slip (+days × pushes). */
function badges(t: TaskView): Badge[] {
  const out: Badge[] = []
  if (t.phase === 'overdue') out.push({ text: `过期${t.overdueDays}d`, level: 'overdue' })
  if (t.pushCount) out.push({ text: `+${t.slipDays}d×${t.pushCount}`, level: (t.pushCount >= 3 ? 3 : t.pushCount) as 1 | 2 | 3 })
  return out
}

/** Approx. pixel width of the stickers, so lane packing leaves room for them. */
function badgeWidth(t: TaskView): number {
  const textW = (s: string) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? 10 : 6), 0)
  const bs = badges(t)
  return bs.length ? bs.reduce((w, b) => w + textW(b.text) + 14, 5) : 0
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
    <div className="sticky top-0 z-20 flex" style={{ height: HEAD_H, background: 'var(--panel)', borderBottom: '2px solid var(--ink)' }}>
      <div
        className="sticky left-0 z-30 flex shrink-0 flex-col justify-end px-2 pb-1"
        style={{ width: labelW, background: 'var(--panel)', borderRight: '2px solid var(--ink)' }}
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
            <div key={d} className="display absolute top-0 pl-1 text-[11px] font-bold" style={{ left: i * dw, height: HEAD_MONTH, color: 'var(--text)', borderLeft: i ? '1.5px solid var(--ink)' : undefined }}>
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
                className="num flex flex-col items-center rounded-[4px] leading-[11px]"
                style={{
                  width: dw - 2,
                  height: HEAD_DAY - 2,
                  paddingTop: 1,
                  background: isToday ? 'var(--hl)' : undefined,
                  border: isToday ? '1.5px solid var(--bar-ink)' : selected === d ? '1.5px dashed var(--ink)' : '1.5px solid transparent',
                  color: isToday ? 'var(--bar-ink)' : wd === 0 || wd === 6 ? 'var(--faint)' : 'var(--text)',
                  fontWeight: isToday ? 700 : undefined,
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
                className="num mt-[1px] flex items-center justify-center text-[9.5px] font-bold"
                style={{
                  width: dw - 4,
                  height: HEAD_LOAD - 3,
                  borderRadius: 3,
                  background: n ? (over ? 'var(--sticker-red)' : `color-mix(in srgb, var(--accent) ${Math.min(70, 10 + n * 14)}%, var(--panel))`) : undefined,
                  border: over ? '1.5px solid var(--bar-ink)' : undefined,
                  color: over ? '#fff' : n >= 3 ? '#fff' : n ? 'var(--text)' : 'transparent',
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
              background: isToday ? 'var(--hl-soft)' : wd === 0 || wd === 6 ? 'var(--weekend)' : undefined,
              borderLeft: wd === 1 ? '1px dashed var(--line)' : undefined,
            }}
          />
        )
      })}
      <div className="absolute top-0 bottom-0" style={{ left: diffDays(days[0], today) * dw - 1, width: 2, background: 'var(--ink)' }} />
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
    <div className="relative flex" style={{ height: h, borderBottom: '1px solid var(--line)', opacity: track.paused ? 0.5 : 1 }}>
      <Label tv={tv} labelW={labelW} today={today} compact={compact} />
      <div className="relative flex-1">
        {lanes.map((lane, li) =>
          lane.map((t) => <Bar key={t.task.id} tv={t} left={x(t.task.start)} top={ROW_PAD + li * LANE_H} dw={dw} today={today} stick={labelW + 4} />),
        )}
        {ms.map((m) => {
          const overdue = !m.done && m.date < today
          const fill = m.done ? 'transparent' : m.hard || overdue ? 'var(--sticker-red)' : track.color
          return (
            <div
              key={m.id}
              className="absolute flex items-center gap-[4px] whitespace-nowrap"
              style={{ left: x(m.date) + dw / 2 - 5, top: msTop, height: MS_STRIP }}
              onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, content: <MilestoneTip m={m} track={track} today={today} /> })}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className="inline-block"
                style={{
                  width: 9,
                  height: 9,
                  transform: 'rotate(45deg)',
                  background: fill,
                  border: `1.5px solid ${m.done ? 'var(--faint)' : 'var(--ink)'}`,
                  boxShadow: m.done ? undefined : '1.5px 1.5px 0 var(--ink)',
                }}
              />
              <span className="text-[10px] font-semibold" style={{ color: m.hard || overdue ? 'var(--red)' : 'var(--text)', textDecoration: m.done ? 'line-through' : undefined, opacity: m.done ? 0.5 : 1 }}>
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
  const openTrack = useUI((s) => s.openTrack)
  return (
    <button
      className="sticky left-0 z-10 flex shrink-0 overflow-hidden text-left hover:bg-[var(--panel-2)]"
      style={{ width: labelW, background: 'var(--panel)', borderRight: '2px solid var(--ink)' }}
      title={track.note ?? `${track.name}：点开看这条线的全部内容`}
      onClick={() => openTrack(track.id)}
    >
      <div className="shrink-0" style={{ width: 6, background: track.color, borderRight: '1.5px solid var(--ink)' }} />
      <div className="min-w-0 flex-1 px-1.5 pt-[3px]">
        <div className="flex items-center gap-1">
          <span className="truncate font-bold" style={{ fontSize: compact ? 11 : 12 }}>
            {track.name}
          </span>
          {track.paused && (
            <span className="shrink-0 text-[9.5px]" style={{ color: 'var(--muted)' }}>
              暂停
            </span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {tv.overdueCount > 0 && (
              <span className="sticker" style={stickerStyle('overdue')} title={`${tv.overdueCount} 个过期 task`}>
                !{tv.overdueCount}
              </span>
            )}
            {!compact && tv.slipDays > 0 && (
              <span className="sticker" style={stickerStyle(tv.pushCount >= 3 ? 3 : 2)} title={`这条线累计推迟 ${tv.slipDays} 天`}>
                +{tv.slipDays}d
              </span>
            )}
          </span>
        </div>
        {!compact && tv.next && (
          <div className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--muted)' }}>
            <span className="truncate">→ {tv.next.title}</span>
            {tv.next.date ? (
              <span className="num ml-auto shrink-0 font-semibold" style={{ color: tv.next.date < today ? 'var(--orange)' : tv.next.date === today ? 'var(--accent)' : 'var(--faint)' }}>
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
    </button>
  )
}

export const Bar = memo(function Bar({ tv, left, top, dw, today, stick }: { tv: TaskView; left: number; top: number; dw: number; today: ISODate; stick: number }) {
  const setHover = useUI((s) => s.setHover)
  const openTask = useUI((s) => s.openTask)
  const { task } = tv
  const color = tv.track?.color ?? '#888888'
  const span = diffDays(task.start, task.end) + 1
  const winW = span * dw
  const width = (diffDays(task.start, tv.visualEnd) + 1) * dw
  const done = tv.phase === 'done'
  const parked = tv.phase === 'parked'
  const overdue = tv.phase === 'overdue'
  // In-progress work "pops" with a hard shadow; future, done and parked bars stay flat.
  const lifted = tv.phase === 'active' || overdue
  const at = (d: ISODate) => diffDays(task.start, d) * dw
  const ink = 'var(--bar-ink)'

  return (
    <div
      className="absolute cursor-pointer"
      style={{ left, top, width, height: BAR_H, opacity: done ? 0.45 : parked ? 0.6 : 1 }}
      onClick={() => openTask(task.id)}
      onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, content: <TaskTip tv={tv} today={today} /> })}
      onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, content: <TaskTip tv={tv} today={today} /> })}
      onMouseLeave={() => setHover(null)}
    >
      {/* overdue tail: caution tape glued to the end of the window */}
      {overdue && (
        <div
          className="tape absolute top-0 bottom-0 rounded-r-[4px]"
          style={{ left: winW - 4, width: tv.overdueDays * dw + 4, border: `1.5px solid ${ink}`, boxShadow: '2px 2px 0 var(--bar-shadow)' }}
        />
      )}
      {/* window + focus days, clipped by the outline */}
      <div
        className="absolute top-0 bottom-0 left-0 overflow-hidden rounded-[4px]"
        style={{
          width: winW,
          background: parked ? 'transparent' : done ? '#e4e0d6' : pastel(color),
          border: `1.5px ${parked ? 'dashed' : 'solid'} ${ink}`,
          boxShadow: lifted && !overdue ? '2px 2px 0 var(--bar-shadow)' : undefined,
        }}
      >
        {!parked &&
          !done &&
          tv.focus.map((d) => (
            <div
              key={d}
              className="absolute top-0 bottom-0"
              style={{ left: at(d) - 1.5, width: dw, background: d < today ? pastel(color, 62) : color }}
            />
          ))}
        {/* progress */}
        {tv.progress != null && tv.progress > 0 && !done && (
          <div className="absolute bottom-0 left-0" style={{ width: Math.max(3, winW * tv.progress), height: 3, background: ink }} />
        )}
        {/* hard deadline cap */}
        {task.hard && !done && <div className="absolute top-0 right-0 bottom-0" style={{ width: 5, background: 'var(--sticker-red)', borderLeft: `1.5px solid ${ink}` }} />}
      </div>
      {/* baseline: where it was originally supposed to end */}
      {task.baseline && task.baseline < task.end && (
        <div className="absolute" style={{ left: at(task.baseline) + dw - 1, top: -3, bottom: -3, borderLeft: `2px dotted ${ink}` }} />
      )}
      {/* title: only over the planned window (never over the tail); sticks to the viewport edge */}
      <div className="pointer-events-none absolute top-0 bottom-0 left-0" style={{ width: winW - (task.hard ? 6 : 1), overflow: 'clip', zIndex: 2 }}>
        <div
          className="sticky inline-block max-w-full truncate px-[5px] align-top text-[11px] font-semibold"
          style={{ left: stick, lineHeight: `${BAR_H}px`, color: ink, textDecoration: done ? 'line-through' : undefined }}
        >
          {done ? '✓ ' : parked ? '⏸ ' : ''}
          {task.title}
        </div>
      </div>
      {/* stickers */}
      {badges(tv).length > 0 && (
        <div className="pointer-events-none absolute top-0 flex items-center gap-[3px] pl-[5px]" style={{ left: width, height: BAR_H }}>
          {badges(tv).map((b) => (
            <span key={b.text} className="sticker" style={stickerStyle(b.level)}>
              {b.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})
