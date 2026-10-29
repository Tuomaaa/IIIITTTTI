import type { ReactNode } from 'react'
import { create } from 'zustand'
import type { ISODate } from '../core/types'

export type Zoom = 'w2' | 'w4' | 'w8'
export type MobileTab = 'today' | 'gantt' | 'inbox'

export interface Hover {
  x: number
  y: number
  content: ReactNode
}

interface UI {
  /** Day shown in the day panel; null = today. */
  day: ISODate | null
  /** Task open in the detail drawer. */
  taskId: string | null
  /** Track open in the thread drawer. */
  trackId: string | null
  modal: 'legend' | 'settings' | null
  tab: MobileTab
  zoom: Zoom
  activeOnly: boolean
  hover: Hover | null
  setDay(d: ISODate | null): void
  openTask(id: string | null): void
  openTrack(id: string | null): void
  setModal(m: UI['modal']): void
  setTab(t: MobileTab): void
  setZoom(z: Zoom): void
  setActiveOnly(v: boolean): void
  setHover(h: Hover | null): void
}

function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function writePref(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export const useUI = create<UI>((set) => ({
  day: null,
  taskId: null,
  trackId: null,
  modal: null,
  tab: 'today',
  zoom: readPref<Zoom>('planner.zoom', 'w4'),
  activeOnly: readPref('planner.activeOnly', false),
  hover: null,
  setDay: (day) => set({ day }),
  openTask: (taskId) => set({ taskId, hover: null }),
  openTrack: (trackId) => set({ trackId, hover: null }),
  setModal: (modal) => set({ modal }),
  setTab: (tab) => set({ tab }),
  setZoom: (zoom) => {
    writePref('planner.zoom', zoom)
    set({ zoom })
  },
  setActiveOnly: (activeOnly) => {
    writePref('planner.activeOnly', activeOnly)
    set({ activeOnly })
  },
  setHover: (hover) => set({ hover }),
}))
