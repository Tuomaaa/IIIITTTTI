import { useEffect, useMemo, useState } from 'react'
import { isoWeek, mdw } from './core/date'
import { buildView, type PlanView } from './core/derive'
import { useStore } from './data/store'
import { useUI, type MobileTab, type Zoom } from './data/ui'
import { DayPanel, DayTodos } from './components/DayPanel'
import { Gantt, ZOOM_LABEL } from './components/Gantt'
import { Modals } from './components/Modals'
import { SidePanel } from './components/SidePanel'
import { TaskDrawer } from './components/TaskDrawer'
import { TrackDrawer } from './components/TrackDrawer'
import { Tooltip } from './components/Tooltip'
import { QuickAdd, Stats, SyncDot, TopBar } from './components/TopBar'

function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const h = () => setM(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [q])
  return m
}

export default function App() {
  const plan = useStore((s) => s.plan)
  const today = useStore((s) => s.today)
  const theme = useStore((s) => s.theme)
  const mobile = useMedia('(max-width: 1179px)')
  const view = useMemo(() => buildView(plan, today), [plan, today])

  useEffect(() => {
    const s = useStore.getState()
    void s.init()
    const tick = setInterval(() => useStore.getState().tick(), 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        useStore.getState().tick()
        void useStore.getState().refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const poll = setInterval(() => document.visibilityState === 'visible' && void useStore.getState().refresh(), 5 * 60_000)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  useEffect(() => {
    const el = document.documentElement
    if (theme === 'system') delete el.dataset.theme
    else el.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const ui = useUI.getState()
        if (ui.modal) ui.setModal(null)
        else if (ui.taskId) ui.openTask(null)
        else ui.openTrack(null)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <>
      {mobile ? <MobileLayout view={view} /> : <DesktopLayout view={view} />}
      <TrackDrawer view={view} mobile={mobile} />
      <TaskDrawer view={view} mobile={mobile} />
      <Modals />
      <Tooltip />
      <Toast />
    </>
  )
}

function DesktopLayout({ view }: { view: PlanView }) {
  return (
    <div className="flex h-full flex-col">
      <TopBar view={view} />
      <main className="grid min-h-0 flex-1 gap-2 p-2" style={{ gridTemplateColumns: 'minmax(280px, 300px) minmax(0, 1fr) minmax(260px, 290px)' }}>
        <div className="panel min-h-0 overflow-hidden">
          <DayPanel view={view} />
        </div>
        <div className="panel flex min-h-0 flex-col overflow-hidden">
          <GanttToolbar view={view} />
          <div className="min-h-0 flex-1">
            <Gantt view={view} />
          </div>
        </div>
        <div className="scroll-thin min-h-0 space-y-2 overflow-y-auto">
          <DayTodos view={view} />
          <SidePanel view={view} />
        </div>
      </main>
    </div>
  )
}

function GanttToolbar({ view, compact = false }: { view: PlanView; compact?: boolean }) {
  const zoom = useUI((s) => s.zoom)
  const setZoom = useUI((s) => s.setZoom)
  const activeOnly = useUI((s) => s.activeOnly)
  const setActiveOnly = useUI((s) => s.setActiveOnly)
  const tasks = [...view.taskById.values()]
  return (
    <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
      {!compact && <span className="section-title mr-1">甘特</span>}
      {(Object.keys(ZOOM_LABEL) as Zoom[]).map((z) => (
        <button key={z} className="btn" aria-pressed={zoom === z} onClick={() => setZoom(z)}>
          {ZOOM_LABEL[z]}
        </button>
      ))}
      <button className="btn" onClick={() => window.dispatchEvent(new Event('gantt:today'))}>
        今天
      </button>
      <button className="btn" aria-pressed={activeOnly} onClick={() => setActiveOnly(!activeOnly)}>
        只看活跃
      </button>
      <span className="num ml-auto text-[10.5px]" style={{ color: 'var(--muted)' }}>
        {view.tracks.length} 线程 · {tasks.filter((t) => t.phase === 'active' || t.phase === 'overdue').length} 进行中 · {tasks.filter((t) => t.phase === 'upcoming').length} 未开始 · {tasks.filter((t) => t.phase === 'done').length} 完成
      </span>
    </div>
  )
}

function MobileLayout({ view }: { view: PlanView }) {
  const tab = useUI((s) => s.tab)
  const setTab = useUI((s) => s.setTab)
  const setModal = useUI((s) => s.setModal)
  const plan = useStore((s) => s.plan)
  const [adding, setAdding] = useState(false)
  const tabs: [MobileTab, string, number?][] = [
    ['today', '今天'],
    ['gantt', '甘特'],
    ['inbox', '需处理', view.inbox.length],
  ]
  return (
    <div className="flex h-full flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="space-y-1.5 px-3 pt-2 pb-2" style={{ background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold">多线程</span>
          <span className="num text-[13px] font-medium">{mdw(view.today)}</span>
          <span className="num text-[11px]" style={{ color: 'var(--muted)' }}>
            W{isoWeek(view.today)}
          </span>
          {plan.meta.demo && (
            <span className="rounded px-1 text-[10px] font-semibold" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
              示例
            </span>
          )}
          <span className="ml-auto" />
          <SyncDot />
          <button className="btn btn-ghost px-1" onClick={() => setModal('settings')} aria-label="设置">
            ⚙
          </button>
        </div>
        <Stats view={view} />
        {adding && (
          <div className="flex gap-1">
            <QuickAdd autoFocus onDone={() => setAdding(false)} />
            <button className="btn" onClick={() => setAdding(false)}>
              取消
            </button>
          </div>
        )}
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === 'today' && (
          <div className="h-full" style={{ background: 'var(--panel)' }}>
            <DayPanel view={view} mobile />
          </div>
        )}
        {tab === 'gantt' && (
          <div className="flex h-full flex-col" style={{ background: 'var(--panel)' }}>
            <GanttToolbar view={view} compact />
            <div className="min-h-0 flex-1">
              <Gantt view={view} compact />
            </div>
          </div>
        )}
        {tab === 'inbox' && (
          <div className="scroll-thin h-full overflow-y-auto p-2">
            <SidePanel view={view} />
            <button className="btn mt-3 w-full justify-center" onClick={() => setModal('legend')}>
              图例
            </button>
          </div>
        )}
      </main>
      <nav className="flex items-stretch" style={{ background: 'var(--panel)', borderTop: '1px solid var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(([k, label, n]) => (
          <button key={k} className="relative flex-1 py-2.5 text-[12.5px] font-medium" style={{ color: tab === k ? 'var(--accent)' : 'var(--muted)' }} onClick={() => setTab(k)}>
            {label}
            {!!n && (
              <span className="num ml-1 rounded-full px-1.5 text-[10px] font-semibold" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
                {n}
              </span>
            )}
            {tab === k && <span className="absolute top-0 right-6 left-6 h-[2px] rounded" style={{ background: 'var(--accent)' }} />}
          </button>
        ))}
        <button className="w-14 text-[20px] font-light" style={{ color: 'var(--accent)' }} onClick={() => setAdding(!adding)} aria-label="快速添加">
          ＋
        </button>
      </nav>
    </div>
  )
}

function Toast() {
  const toast = useStore((s) => s.toast)
  if (!toast) return null
  return (
    <div
      className="fade-in fixed bottom-16 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-md px-3 py-2 text-[12px]"
      style={{
        background: toast.kind === 'error' ? 'var(--red)' : 'var(--text)',
        color: 'var(--panel)',
        boxShadow: 'var(--shadow)',
      }}
    >
      {toast.msg}
    </div>
  )
}
