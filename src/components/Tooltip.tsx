import { useLayoutEffect, useRef, useState } from 'react'
import { diffDays, md, mdw, relDay } from '../core/date'
import type { TaskView } from '../core/derive'
import type { ISODate, Milestone, Track } from '../core/types'
import { useUI } from '../data/ui'
import { pct, pressureColor } from '../lib/ui'

/** Floating hover card; content is set by whoever is hovered via useUI().setHover. */
export function Tooltip() {
  const hover = useUI((s) => s.hover)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    if (!hover || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    let left = hover.x + 14
    let top = hover.y + 14
    if (left + r.width > window.innerWidth - 8) left = hover.x - r.width - 10
    if (top + r.height > window.innerHeight - 8) top = hover.y - r.height - 10
    setPos({ left: Math.max(8, left), top: Math.max(8, top) })
  }, [hover])
  if (!hover) return null
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-50 max-w-[320px] rounded-md border px-2.5 py-2 text-[11.5px]"
      style={{ left: pos.left, top: pos.top, background: 'var(--panel)', borderColor: 'var(--line)', boxShadow: 'var(--shadow)' }}
    >
      {hover.content}
    </div>
  )
}

const PHASE_ZH = { done: '已完成', parked: '暂停', overdue: '过期', active: '进行中', upcoming: '未开始' } as const

export function TaskTip({ tv, today }: { tv: TaskView; today: ISODate }) {
  const { task, track } = tv
  const left = diffDays(today, task.end)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: track?.color }} />
        <span className="font-semibold">{task.title}</span>
      </div>
      <div style={{ color: 'var(--muted)' }}>
        {track?.name} · {PHASE_ZH[tv.phase]}
        {task.hard && <span style={{ color: 'var(--red)' }}> · 硬 ddl</span>}
      </div>
      <div className="num">
        {md(task.start)} → {md(task.end)}
        {task.baseline && task.baseline !== task.end && (
          <span style={{ color: 'var(--muted)' }}> （原定 {md(task.baseline)}）</span>
        )}
        {tv.phase === 'overdue' ? (
          <span style={{ color: 'var(--red)' }}> · 过期 {tv.overdueDays} 天</span>
        ) : tv.phase === 'active' ? (
          <span style={{ color: 'var(--muted)' }}> · 还剩 {left + 1} 天</span>
        ) : null}
      </div>
      <div className="num">
        进度 {pct(tv.progress)}
        {tv.todoTotal > 0 && (
          <span style={{ color: 'var(--muted)' }}>
            {' '}
            （todo {tv.todoDone}/{tv.todoTotal}）
          </span>
        )}
        {' · '}排了 {tv.focus.length} 天
        {tv.nextFocus && <span style={{ color: 'var(--muted)' }}>，下次 {relDay(tv.nextFocus, today)}</span>}
        {tv.unscheduled && <span style={{ color: 'var(--orange)' }}>，之后没排</span>}
      </div>
      {tv.pushCount > 0 && (
        <div className="num" style={{ color: pressureColor(tv.pressure) }}>
          推了 {tv.pushCount} 次，共 {tv.slipDays} 天
          {task.slips?.at(-1)?.reason && <span style={{ color: 'var(--muted)' }}>（最近：{task.slips.at(-1)!.reason}）</span>}
        </div>
      )}
      {tv.milestone && (
        <div>
          → ◆ {tv.milestone.title} · {mdw(tv.milestone.date)}
        </div>
      )}
      {task.note && <div style={{ color: 'var(--muted)' }}>{task.note}</div>}
      <div className="mono text-[10px]" style={{ color: 'var(--faint)' }}>
        {task.id}
      </div>
    </div>
  )
}

export function MilestoneTip({ m, track, today }: { m: Milestone; track?: Track; today: ISODate }) {
  const left = diffDays(today, m.date)
  return (
    <div className="space-y-1">
      <div className="font-semibold">
        <span style={{ color: m.hard ? 'var(--red)' : track?.color }}>◆</span> {m.title}
      </div>
      <div style={{ color: 'var(--muted)' }}>
        {track?.name} · {m.hard ? '硬 ddl' : 'milestone'}
      </div>
      <div className="num">
        {mdw(m.date)} ·{' '}
        {m.done ? '已完成' : left >= 0 ? `还有 ${left} 天` : <span style={{ color: 'var(--red)' }}>已过 {-left} 天</span>}
      </div>
      <div className="mono text-[10px]" style={{ color: 'var(--faint)' }}>
        {m.id}
      </div>
    </div>
  )
}
