// Pure geometry helpers for the gantt: how tasks and milestones share lanes in a thread row.
import { diffDays } from './date'
import type { TaskView } from './derive'
import type { ISODate, Milestone } from './types'

/** Rough rendered width of `s` in px: CJK glyphs are about twice as wide as ASCII. */
export function textWidth(s: string, cjk = 10.5, ascii = 6): number {
  return [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? cjk : ascii), 0)
}

export interface PackedRow {
  lanes: TaskView[][]
  /** `label: false` = only the diamond fits (it sits on the end of a bar); the name goes in the tooltip. */
  ms: { m: Milestone; lane: number; label: boolean }[]
  laneCount: number
}

/**
 * Pack a thread's tasks into lanes (first lane with room, in start order), then drop each
 * milestone into the first lane where its diamond + label fit. The diamond may sit on the last
 * cell of a bar, so a milestone at a task's end usually shares that task's lane. When the label
 * fits nowhere but the milestone lands on a task's end, only the diamond is drawn there rather
 * than adding a lane.
 * `extraPx` reserves room after a task (for stickers); `dw` is the day width in px.
 */
export function packRow(
  tasks: TaskView[],
  milestones: Milestone[],
  from: ISODate,
  to: ISODate,
  dw: number,
  extraPx: (t: TaskView) => number = () => 0,
): PackedRow {
  const idx = (d: ISODate) => diffDays(from, d)
  const occupied: [number, number][][] = []
  const lanes: TaskView[][] = []
  /** Per lane: day indices where a task's bar ends. */
  const ends: Set<number>[] = []
  const free = (lane: number, s: number, e: number) => occupied[lane].every(([a, b]) => e < a || s > b)
  const open = () => {
    occupied.push([])
    lanes.push([])
    ends.push(new Set())
    return occupied.length - 1
  }
  const place = (s: number, e: number, probeStart = s) => {
    let lane = occupied.findIndex((_, i) => free(i, probeStart, e))
    if (lane === -1) lane = open()
    occupied[lane].push([s, e])
    return lane
  }
  for (const t of tasks) {
    const lastFocus = t.focus[t.focus.length - 1]
    const s = idx(t.focus[0] && t.focus[0] < t.task.start ? t.focus[0] : t.task.start)
    const e = idx(lastFocus && lastFocus > t.visualEnd ? lastFocus : t.visualEnd) + Math.ceil(extraPx(t) / dw)
    const lane = place(s, e)
    lanes[lane].push(t)
    ends[lane].add(idx(t.visualEnd))
    ends[lane].add(idx(t.task.end))
  }
  const ms: PackedRow['ms'] = []
  for (const m of milestones) {
    if (m.date < from || m.date > to) continue
    const s = idx(m.date)
    const e = s + Math.ceil((textWidth(m.title) + 20) / dw)
    const fits = occupied.findIndex((_, i) => free(i, s + 1, e))
    if (fits !== -1) {
      occupied[fits].push([s, e])
      ms.push({ m, lane: fits, label: true })
      continue
    }
    const onEnd = ends.findIndex((set) => set.has(s))
    if (onEnd !== -1) ms.push({ m, lane: onEnd, label: false })
    else ms.push({ m, lane: place(s, e, s + 1), label: true })
  }
  return { lanes, ms, laneCount: Math.max(1, occupied.length) }
}
