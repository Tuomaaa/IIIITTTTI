import { useEffect, useState } from 'react'
import { addDays, md, weekStart, weekday } from '../core/date'
import { settings, type PlanView } from '../core/derive'
import type { ISODate } from '../core/types'
import { useStore } from '../data/store'
import { useUI } from '../data/ui'
import { MilestoneTip } from './Tooltip'

const HEAD = ['一', '二', '三', '四', '五', '六', '日']

/**
 * Compact rolling calendar (last week + this week + 3 weeks ahead) instead of a calendar
 * month, so it always looks forward. Per day: focus threads (dots), milestones (◆), load.
 */
export function MonthMini({ view, cellH = 30 }: { view: PlanView; cellH?: number }) {
  const sel = useUI((s) => s.day)
  const setDay = useUI((s) => s.setDay)
  const setHover = useUI((s) => s.setHover)
  const plan = useStore((s) => s.plan)
  const { today } = view
  const day = sel ?? today
  const home = addDays(weekStart(today), -7)
  const [start, setStart] = useState(home)
  // Keep the selected day visible.
  useEffect(() => {
    setStart((s) => (day < s || day > addDays(s, 34) ? addDays(weekStart(day), -7) : s))
  }, [day])
  const shown = Array.from({ length: 35 }, (_, i) => addDays(start, i))
  const maxParallel = settings(plan).maxParallel
  const msByDay = new Map<ISODate, typeof plan.milestones>()
  for (const m of plan.milestones) msByDay.set(m.date, [...(msByDay.get(m.date) ?? []), m])

  const end = shown[shown.length - 1]

  return (
    <div className="px-3 pb-2">
      <div className="mb-1 flex items-center">
        <span className="section-title num">
          {md(start)} – {md(end)}
        </span>
        {start !== home && (
          <button className="btn btn-ghost ml-1 h-5 px-1.5 text-[10.5px]" onClick={() => setStart(home)}>
            本周
          </button>
        )}
        <button className="btn btn-ghost ml-auto h-5 px-1.5" onClick={() => setStart(addDays(start, -28))} aria-label="往前 4 周">
          ‹
        </button>
        <button className="btn btn-ghost h-5 px-1.5" onClick={() => setStart(addDays(start, 28))} aria-label="往后 4 周">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-[2px]">
        {HEAD.map((h, i) => (
          <div key={h} className="text-center text-[9.5px]" style={{ color: i >= 5 ? 'var(--faint)' : 'var(--muted)' }}>
            {h}
          </div>
        ))}
        {shown.map((d) => {
          const monthStart = d.endsWith('-01')
          const thisWeek = d >= weekStart(today) && d < addDays(weekStart(today), 7)
          const load = view.load.get(d)
          const n = load?.tasks.length ?? 0
          const over = n > maxParallel
          const ms = msByDay.get(d) ?? []
          const isToday = d === today
          const isSel = d === day
          const past = d < today
          const colors = (load?.tasks ?? []).map((id) => view.taskById.get(id)?.track?.color ?? '#888')
          const wd = weekday(d)
          return (
            <button
              key={d}
              className="relative overflow-hidden rounded-[4px] text-left"
              style={{
                height: cellH,
                background: n ? `color-mix(in oklab, var(--accent) ${Math.min(22, 4 + n * 3.5)}%, var(--panel))` : 'var(--panel)',
                outline: isSel ? '1.5px solid var(--accent)' : undefined,
                outlineOffset: -1,
                opacity: past && !isToday ? 0.55 : 1,
                border: `1px solid ${thisWeek ? 'var(--line)' : 'var(--line-2)'}`,
              }}
              onClick={() => setDay(d === today ? null : d)}
              onMouseEnter={(e) =>
                ms.length &&
                setHover({
                  x: e.clientX,
                  y: e.clientY,
                  content: (
                    <div className="space-y-2">
                      {ms.map((m) => (
                        <MilestoneTip key={m.id} m={m} track={view.trackById.get(m.trackId)} today={today} />
                      ))}
                    </div>
                  ),
                })
              }
              onMouseLeave={() => setHover(null)}
              aria-label={d}
            >
              <span
                className="num absolute top-[1px] left-[3px] text-[10px] font-semibold"
                style={{
                  color: isToday ? 'var(--panel)' : over ? 'var(--red)' : wd === 0 || wd === 6 ? 'var(--muted)' : 'var(--text)',
                  background: isToday ? 'var(--accent)' : undefined,
                  borderRadius: 3,
                  padding: isToday ? '0 2px' : undefined,
                  lineHeight: '12px',
                }}
              >
                {monthStart ? `${Number(d.slice(5, 7))}月` : Number(d.slice(8))}
              </span>
              {ms.length > 0 && (
                <span
                  className="absolute top-[3px] right-[3px] inline-block rotate-45"
                  style={{
                    width: 6,
                    height: 6,
                    background: ms.some((m) => m.done) && ms.every((m) => m.done) ? 'transparent' : ms.some((m) => m.hard) ? 'var(--red)' : (view.trackById.get(ms[0].trackId)?.color ?? 'var(--text)'),
                    border: ms.every((m) => m.done) ? '1px solid var(--faint)' : undefined,
                  }}
                />
              )}
              <span className="absolute right-[2px] bottom-[2px] left-[3px] flex flex-wrap-reverse gap-[1.5px]">
                {colors.slice(0, 8).map((c, i) => (
                  <span key={i} className="inline-block rounded-full" style={{ width: 4, height: 4, background: c }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
