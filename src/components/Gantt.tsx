import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { addDays, daysBetween, diffDays, md, relDay, weekday, WEEKDAY_ZH } from '../core/date'
import { settings, type PlanView, type TaskView, type TrackView } from '../core/derive'
import type { ISODate, Milestone, Track } from '../core/types'
import { useStore } from '../data/store'
import { useUI, type Hover, type Zoom } from '../data/ui'
import { packRow, textWidth, type PackedRow } from '../core/layout'
import { pastel, stickerStyle } from '../lib/ui'
import { MilestoneTip, TaskTip } from './Tooltip'

const LANE_H = 28
const BAR_H = 22
/** Height of the focus-day band at the bottom of a bar. */
const BAND_H = 6
const ROW_PAD = 3
const MINI_LANE = 9
const GROUP_H = 26
const HEAD_MONTH = 15
const HEAD_DAY = 26
const HEAD_LOAD = 16
const HEAD_H = HEAD_MONTH + HEAD_DAY + HEAD_LOAD
const PAST_DAYS = 21
const FUTURE_DAYS = 120
const PAUSED = '__paused'

export const ZOOM_DAYS: Record<Zoom, number> = { w2: 14, w4: 21, w8: 42 }
export const ZOOM_LABEL: Record<Zoom, string> = { w2: '2 周', w4: '3 周', w8: '6 周' }

interface Props {
  view: PlanView
  compact?: boolean
}

type GroupSection = { kind: 'group'; key: string; name: string; tracks: TrackView[]; collapsed: boolean }
type Section = GroupSection | { kind: 'track'; tv: TrackView; inGroup: boolean }

export function Gantt({ view, compact = false }: Props) {
  const zoom = useUI((s) => s.zoom)
  const activeOnly = useUI((s) => s.activeOnly)
  const selected = useUI((s) => s.day)
  const collapsed = useUI((s) => s.collapsed)
  const setModal = useUI((s) => s.setModal)
  const plan = useStore((s) => s.plan)
  const scroller = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const { today } = view
  const labelW = compact ? 96 : 212

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

  const rows = buildSections(view.tracks, activeOnly, collapsed).map((s) => {
    if (s.kind === 'group') {
      const tasks = s.tracks.flatMap((t) => t.tasks).sort((a, b) => a.task.start.localeCompare(b.task.start))
      const mini = s.collapsed ? packMini(tasks) : []
      return { s, h: s.collapsed ? Math.max(GROUP_H, mini.length * MINI_LANE + 8) : GROUP_H, mini, packed: undefined }
    }
    const packed = packRow(s.tv.tasks, s.tv.milestones, from, to, dw, badgeWidth)
    return { s, h: ROW_PAD * 2 + packed.laneCount * LANE_H + 1, mini: [] as TaskView[][], packed }
  })
  const bodyH = rows.reduce((n, r) => n + r.h, 0) + (view.archived.length ? GROUP_H : 0)
  const totalW = labelW + days.length * dw

  return (
    <div ref={scroller} className="scroll-thin relative h-full overflow-auto" style={{ overscrollBehaviorX: 'contain' }}>
      <div className="relative" style={{ width: totalW, minHeight: HEAD_H + bodyH }}>
        <Header days={days} dw={dw} labelW={labelW} today={today} selected={selected} view={view} maxParallel={maxParallel} trackCount={view.tracks.length} compact={compact} />
        <Grid days={days} dw={dw} labelW={labelW} today={today} height={bodyH} />
        {rows.map(({ s, h, mini, packed }) =>
          s.kind === 'group' ? (
            <GroupRow key={s.key} s={s} h={h} mini={mini} x={x} dw={dw} labelW={labelW} today={today} compact={compact} />
          ) : (
            <Row key={s.tv.track.id} tv={s.tv} inGroup={s.inGroup} packed={packed!} h={h} x={x} dw={dw} labelW={labelW} today={today} compact={compact} />
          ),
        )}
        {view.archived.length > 0 && (
          <div className="relative flex" style={{ height: GROUP_H }}>
            <button
              className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 px-2 text-left text-[11px] font-semibold hover:bg-[var(--panel-2)]"
              style={{ width: labelW, background: 'var(--panel)', borderRight: '2px solid var(--ink)', color: 'var(--muted)' }}
              onClick={() => setModal('archive')}
            >
              已归档 <span className="num">{view.archived.length}</span> 条 →
            </button>
          </div>
        )}
        {!rows.length && (
          <div className="p-6 text-center" style={{ color: 'var(--muted)' }}>
            没有进行中的线程
          </div>
        )}
      </div>
    </div>
  )
}

/** Groups (tracks sharing `group`) keep the position of their most relevant member; paused tracks go last. */
function buildSections(tracks: TrackView[], activeOnly: boolean, collapsed: string[]): Section[] {
  const live = tracks.filter((t) => !t.track.paused && (!activeOnly || t.rank <= 2))
  const paused = activeOnly ? [] : tracks.filter((t) => t.track.paused)
  const order: string[] = []
  const members = new Map<string, TrackView[]>()
  for (const tv of live) {
    const key = tv.track.group ? `g:${tv.track.group}` : `t:${tv.track.id}`
    if (!members.has(key)) {
      members.set(key, [])
      order.push(key)
    }
    members.get(key)!.push(tv)
  }
  const out: Section[] = []
  const pushGroup = (key: string, name: string, list: TrackView[]) => {
    const isCollapsed = collapsed.includes(key)
    out.push({ kind: 'group', key, name, tracks: list, collapsed: isCollapsed })
    if (!isCollapsed) for (const tv of list) out.push({ kind: 'track', tv, inGroup: true })
  }
  for (const key of order) {
    const list = members.get(key)!
    if (key.startsWith('g:') && list.length > 1) pushGroup(key, key.slice(2), list)
    else for (const tv of list) out.push({ kind: 'track', tv, inGroup: false })
  }
  if (paused.length) pushGroup(PAUSED, '暂停', paused)
  return out
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
  const bs = badges(t)
  return bs.length ? bs.reduce((w, b) => w + textWidth(b.text, 10, 6) + 14, 5) : 0
}

/** Thin, text-free packing for a collapsed group's summary row. */
function packMini(tasks: TaskView[]): TaskView[][] {
  const lanes: TaskView[][] = []
  const ends: ISODate[] = []
  for (const t of tasks) {
    if (t.phase === 'done') continue
    let i = ends.findIndex((e) => e < t.task.start)
    if (i === -1) {
      i = lanes.length
      lanes.push([])
      ends.push('')
    }
    lanes[i].push(t)
    ends[i] = t.visualEnd
  }
  return lanes
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
              onMouseEnter={(e) => load && setHover({ x: e.clientX, y: e.clientY, content: <LoadTip d={d} view={view} /> })}
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
                    <span className="text-[9px] opacity-80">{wd === 1 ? '一' : ' '}</span>
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

function GroupRow({
  s,
  h,
  mini,
  x,
  dw,
  labelW,
  today,
  compact,
}: {
  s: GroupSection
  h: number
  mini: TaskView[][]
  x: (d: ISODate) => number
  dw: number
  labelW: number
  today: ISODate
  compact: boolean
}) {
  const toggle = useUI((st) => st.toggleCollapsed)
  const openTask = useUI((st) => st.openTask)
  const setHover = useUI((st) => st.setHover)
  const overdue = s.tracks.reduce((n, t) => n + t.overdueCount, 0)
  const slip = s.tracks.reduce((n, t) => n + t.slipDays, 0)
  const active = s.tracks.reduce((n, t) => n + t.activeCount, 0)
  return (
    <div className="relative flex" style={{ height: h, background: 'var(--panel-2)', borderBottom: '1.5px solid var(--ink)', opacity: s.key === PAUSED ? 0.75 : 1 }}>
      <button
        className="sticky left-0 z-10 flex shrink-0 items-center gap-1 px-2 text-left"
        style={{ width: labelW, background: 'var(--panel-2)', borderRight: '2px solid var(--ink)' }}
        onClick={() => toggle(s.key)}
        title={s.collapsed ? '展开' : '折叠'}
      >
        <span className="w-3 shrink-0 text-[10px]">{s.collapsed ? '▸' : '▾'}</span>
        <span className="display truncate text-[12px] font-bold">{s.name}</span>
        <span className="num shrink-0 text-[10.5px]" style={{ color: 'var(--muted)' }}>
          {compact ? s.tracks.length : `${s.tracks.length} 条${active ? ` · ${active} 进行中` : ''}`}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {overdue > 0 && (
            <span className="sticker" style={stickerStyle('overdue')}>
              !{overdue}
            </span>
          )}
          {!compact && slip > 0 && (
            <span className="sticker" style={stickerStyle(2)}>
              +{slip}d
            </span>
          )}
        </span>
      </button>
      {s.collapsed && (
        <div className="relative flex-1">
          {mini.map((lane, li) =>
            lane.map((t) => {
              const color = t.track?.color ?? '#888'
              const winW = (diffDays(t.task.start, t.task.end) + 1) * dw
              return (
                <div
                  key={t.task.id}
                  className="absolute cursor-pointer"
                  style={{ left: x(t.task.start), top: 4 + li * MINI_LANE, height: MINI_LANE - 2, width: (diffDays(t.task.start, t.visualEnd) + 1) * dw }}
                  onClick={() => openTask(t.task.id)}
                  onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, content: <TaskTip tv={t} today={today} /> })}
                  onMouseLeave={() => setHover(null)}
                >
                  {t.phase === 'overdue' && <div className="tape absolute top-0 bottom-0 rounded-r-[2px]" style={{ left: winW - 2, right: 0, border: '1px solid var(--bar-ink)' }} />}
                  <div
                    className="absolute top-0 bottom-0 left-0 rounded-[2px]"
                    style={{ width: winW, background: t.phase === 'upcoming' ? pastel(color, 45) : color, border: '1px solid var(--bar-ink)', opacity: t.phase === 'parked' ? 0.5 : 1 }}
                  />
                </div>
              )
            }),
          )}
        </div>
      )}
    </div>
  )
}

function Row({
  tv,
  inGroup,
  packed,
  h,
  x,
  dw,
  labelW,
  today,
  compact,
}: {
  tv: TrackView
  inGroup: boolean
  packed: PackedRow
  h: number
  x: (d: ISODate) => number
  dw: number
  labelW: number
  today: ISODate
  compact: boolean
}) {
  const { track } = tv
  const setHover = useUI((s) => s.setHover)
  return (
    <div className="relative flex" style={{ height: h, borderBottom: '1px solid var(--line)', opacity: track.paused ? 0.6 : 1 }}>
      <Label tv={tv} labelW={labelW} today={today} compact={compact} inGroup={inGroup} />
      <div className="relative flex-1">
        {packed.lanes.map((lane, li) =>
          lane.map((t) => <Bar key={t.task.id} tv={t} left={x(t.task.start)} top={ROW_PAD + li * LANE_H + (LANE_H - BAR_H) / 2} dw={dw} today={today} stick={labelW + 4} />),
        )}
        {packed.ms.map(({ m, lane, label }) => (
          <MilestoneMark key={m.id} m={m} label={label} track={track} today={today} left={x(m.date) + dw / 2} top={ROW_PAD + lane * LANE_H} onHover={setHover} />
        ))}
      </div>
    </div>
  )
}

function MilestoneMark({
  m,
  label,
  track,
  today,
  left,
  top,
  onHover,
}: {
  m: Milestone
  label: boolean
  track: Track
  today: ISODate
  left: number
  top: number
  onHover: (h: Hover | null) => void
}) {
  const overdue = !m.done && m.date < today
  const fill = m.done ? 'var(--panel)' : m.hard || overdue ? 'var(--sticker-red)' : track.color
  return (
    <div
      className="absolute z-[3] flex items-center gap-[4px] whitespace-nowrap"
      style={{ left: left - 6, top, height: LANE_H }}
      onMouseEnter={(e) => onHover({ x: e.clientX, y: e.clientY, content: <MilestoneTip m={m} track={track} today={today} /> })}
      onMouseLeave={() => onHover(null)}
    >
      <span className="inline-block shrink-0" style={{ width: 11, height: 11, transform: 'rotate(45deg)', background: fill, border: `1.5px solid ${m.done ? 'var(--faint)' : 'var(--bar-ink)'}` }} />
      {label && (
        <span
          className="rounded-[3px] px-[3px] text-[10px] font-semibold"
          style={{ color: m.hard || overdue ? 'var(--red)' : 'var(--text)', background: 'var(--panel)', textDecoration: m.done ? 'line-through' : undefined, opacity: m.done ? 0.5 : 1 }}
        >
          {m.title}
        </span>
      )}
    </div>
  )
}

/** "SURF · 文献" under the SURF group header reads as just "文献". */
function withoutGroupPrefix(track: Track): string {
  const g = track.group
  if (!g || !track.name.startsWith(g)) return track.name
  const rest = track.name.slice(g.length).replace(/^\s*[·・\-–/:：|]\s*/, '')
  return rest && rest !== track.name.slice(g.length) ? rest : track.name
}

function Label({ tv, labelW, today, compact, inGroup }: { tv: TrackView; labelW: number; today: ISODate; compact: boolean; inGroup: boolean }) {
  const { track } = tv
  const openTrack = useUI((s) => s.openTrack)
  return (
    <button
      className="sticky left-0 z-10 flex shrink-0 overflow-hidden text-left hover:bg-[var(--panel-2)]"
      style={{ width: labelW, background: 'var(--panel)', borderRight: '2px solid var(--ink)' }}
      title={track.note ?? `${track.name}：点开看这条线的全部内容`}
      onClick={() => openTrack(track.id)}
    >
      {inGroup && <div className="shrink-0" style={{ width: 8, background: 'var(--panel-2)' }} />}
      <div className="shrink-0" style={{ width: 6, background: track.color, borderRight: '1.5px solid var(--ink)' }} />
      <div className="flex min-w-0 flex-1 flex-col justify-center px-1.5">
        <div className="flex items-center gap-1">
          <span className="truncate font-bold" style={{ fontSize: compact ? 11 : 12 }}>
            {inGroup ? withoutGroupPrefix(track) : track.name}
          </span>
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
          <div className="flex items-center gap-1 text-[10.5px] leading-[13px]" style={{ color: 'var(--muted)' }}>
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
  const at = (d: ISODate) => diffDays(task.start, d) * dw
  const ink = 'var(--bar-ink)'
  const band = !parked && !done
  const textH = BAR_H - (band ? BAND_H : 0)
  const showPct = tv.progress != null && !done && tv.progress > 0

  return (
    <div
      className="absolute cursor-pointer"
      style={{ left, top, width, height: BAR_H, opacity: done ? 0.45 : parked ? 0.6 : tv.phase === 'upcoming' ? 0.75 : 1 }}
      onClick={() => openTask(task.id)}
      onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, content: <TaskTip tv={tv} today={today} /> })}
      onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, content: <TaskTip tv={tv} today={today} /> })}
      onMouseLeave={() => setHover(null)}
    >
      {/* overdue tail: caution tape glued to the end of the window */}
      {overdue && <div className="tape absolute top-0 bottom-0 rounded-r-[4px]" style={{ left: winW - 4, width: tv.overdueDays * dw + 4, border: `1.5px solid ${ink}` }} />}
      {/* window: one flat colour, so the title always sits on a uniform background */}
      <div
        className="absolute top-0 bottom-0 left-0 overflow-hidden rounded-[4px]"
        style={{ width: winW, background: parked ? 'var(--panel)' : done ? '#e4e0d6' : pastel(color, 30), border: `1.5px ${parked ? 'dashed' : 'solid'} ${ink}` }}
      >
        {/* focus days: a band along the bottom edge */}
        {band && (
          <div className="absolute right-0 bottom-0 left-0" style={{ height: BAND_H, borderTop: `1px solid ${ink}` }}>
            {tv.focus.map((d) => (
              <div key={d} className="absolute top-0 bottom-0" style={{ left: at(d) - 1.5, width: dw, background: d < today ? pastel(color, 60) : color }} />
            ))}
          </div>
        )}
        {task.hard && !done && <div className="absolute top-0 right-0 bottom-0" style={{ width: 5, background: 'var(--sticker-red)', borderLeft: `1.5px solid ${ink}` }} />}
      </div>
      {/* baseline: where it was originally supposed to end */}
      {task.baseline && task.baseline < task.end && <div className="absolute" style={{ left: at(task.baseline) + dw - 1, top: -3, bottom: -3, borderLeft: `2px dotted ${ink}` }} />}
      {/* title + progress: upper part of the window only; sticks to the viewport edge */}
      <div className="pointer-events-none absolute top-0 left-0" style={{ width: winW - (task.hard ? 6 : 1), height: textH, overflow: 'clip', zIndex: 2 }}>
        <div className="sticky inline-flex max-w-full items-baseline gap-1 px-[5px] align-top" style={{ left: stick, lineHeight: `${textH}px`, color: ink }}>
          <span className="truncate text-[11.5px] font-semibold" style={{ textDecoration: done ? 'line-through' : undefined }}>
            {done ? '✓ ' : parked ? '⏸ ' : ''}
            {task.title}
          </span>
          {showPct && <span className="num shrink-0 text-[10px] font-semibold opacity-60">{Math.round(tv.progress! * 100)}%</span>}
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
