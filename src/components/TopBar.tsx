import { useEffect, useRef, useState } from 'react'
import { diffDays, isoWeek, mdw } from '../core/date'
import type { PlanView } from '../core/derive'
import { addBlock, addTask, addTodo, newId } from '../core/ops'
import { describeQuick, parseQuick } from '../core/quickadd'
import { useStore } from '../data/store'
import { useUI } from '../data/ui'

export function Stats({ view }: { view: PlanView }) {
  const s = view.stats
  const setTab = useUI((x) => x.setTab)
  const nm = s.nextMilestone
  const nmLeft = nm ? diffDays(view.today, nm.date) : 0
  return (
    <div className="scroll-thin flex min-w-0 items-center gap-1 overflow-x-auto">
      <Stat label="进行中" value={s.active} />
      <Stat label="今日聚焦" value={s.focusToday} />
      <Stat label="todo" value={`${s.todosToday.done}/${s.todosToday.total}`} />
      <Stat label="过期" value={s.overdue} tone={s.overdue ? 'red' : undefined} onClick={() => setTab('inbox')} />
      <Stat label="拖延 todo" value={s.stale} tone={s.stale ? 'orange' : undefined} onClick={() => setTab('inbox')} />
      <Stat label="本周推迟" value={`${s.weekSlips.count}次 ${s.weekSlips.days}天`} tone={s.weekSlips.count ? 'orange' : undefined} />
      {nm && (
        <span className="chip" title={nm.title}>
          <span style={{ color: nm.hard ? 'var(--red)' : 'var(--accent)' }}>◆</span>
          <span className="max-w-[120px] truncate">{nm.title}</span>
          <b className="num" style={{ color: nmLeft <= 3 ? 'var(--red)' : undefined }}>
            {nmLeft === 0 ? '今天' : `${nmLeft}d`}
          </b>
        </span>
      )}
    </div>
  )
}

function Stat({ label, value, tone, onClick }: { label: string; value: number | string; tone?: 'red' | 'orange'; onClick?: () => void }) {
  const c = tone === 'red' ? 'var(--red)' : tone === 'orange' ? 'var(--orange)' : undefined
  return (
    <button
      className="chip"
      style={{ background: tone ? (tone === 'red' ? 'var(--red-soft)' : 'var(--orange-soft)') : undefined, borderColor: tone ? 'transparent' : undefined, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <span style={{ color: c ?? 'var(--muted)' }}>{label}</span>
      <b className="num" style={{ color: c }}>
        {value}
      </b>
    </button>
  )
}

export function SyncDot() {
  const sync = useStore((s) => s.sync)
  const error = useStore((s) => s.error)
  const origin = useStore((s) => s.origin)
  const token = useStore((s) => !!s.source.token)
  const lastSync = useStore((s) => s.lastSync)
  const pending = useStore((s) => s.pending.length + s.inflight.length)
  const setModal = useUI((s) => s.setModal)
  const refresh = useStore((s) => s.refresh)
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  let color = 'var(--green)'
  let text = '已同步'
  if (sync === 'loading') {
    color = 'var(--faint)'
    text = '读取中'
  } else if (sync === 'saving' || pending) {
    color = 'var(--amber)'
    text = `保存中 ${pending}`
  } else if (sync === 'error') {
    color = 'var(--red)'
    text = origin === 'live' ? '同步出错' : '离线'
  } else if (!token) {
    color = 'var(--faint)'
    text = '只读'
  }
  const ago = lastSync ? Math.round((Date.now() - lastSync) / 60000) : null
  return (
    <button
      className="btn btn-ghost gap-1.5"
      onClick={() => (sync === 'error' || !token ? setModal('settings') : void refresh(true))}
      title={`${error ?? text}${ago != null ? ` · ${ago} 分钟前同步` : ''}${origin !== 'live' ? `（当前数据来自${origin === 'cache' ? '本地缓存' : '打包时的快照'}）` : ''}\n点击${sync === 'error' || !token ? '打开设置' : '立即刷新'}`}
    >
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />
      <span style={{ color: 'var(--muted)' }}>{text}</span>
    </button>
  )
}

export function QuickAdd({ autoFocus = false, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const plan = useStore((s) => s.plan)
  const today = useStore((s) => s.today)
  const apply = useStore((s) => s.apply)
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const r = text.trim() ? parseQuick(text, plan, today) : null

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const submit = () => {
    if (!r || r.kind === 'error') return
    let ok = false
    if (r.kind === 'todo') {
      const id = newId('td', plan)
      ok = apply(`加 todo「${r.todo.title}」`, (p) => addTodo(p, { ...r.todo, id }))
    } else if (r.kind === 'block') {
      const id = newId('bk', plan)
      ok = apply(`加时间块「${r.block.title}」`, (p) => addBlock(p, { ...r.block, id }))
    } else {
      const id = newId('tk', plan)
      ok = apply(`加 task「${r.task.title}」`, (p) => addTask(p, { ...r.task, id }))
    }
    if (ok) {
      setText('')
      onDone?.()
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={ref}
        autoFocus={autoFocus}
        className="h-[28px] w-full rounded-md border px-2.5 text-[12px] outline-none"
        style={{ background: 'var(--panel-2)', borderColor: focused ? 'var(--accent)' : 'var(--line)' }}
        placeholder="快速添加…  按 / 聚焦"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setText('')
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      {focused && (
        <div className="fade-in absolute top-[32px] right-0 z-40 w-[min(460px,92vw)] rounded-md border p-2 text-[11px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)', boxShadow: 'var(--shadow)' }}>
          {r ? (
            <div style={{ color: r.kind === 'error' ? 'var(--red)' : 'var(--text)' }}>
              {r.kind === 'error' ? '⚠ ' : '↵ '}
              {describeQuick(r, plan)}
            </div>
          ) : (
            <div className="space-y-0.5" style={{ color: 'var(--muted)' }}>
              <div>
                <code>#线程</code> 归到某条线 · <code>明天 / 周五 / 11/5 / +3</code> 日期 · <code>@14-15:30</code> 时间块
              </div>
              <div>
                <code>3d</code> 时长 · <code>&gt;11/5</code> 截止 · <code>!</code> 硬 ddl → 变成甘特条 · <code>~30m</code> 预估 · <code>?</code> 放进 backlog
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TopBar({ view }: { view: PlanView }) {
  const setModal = useUI((s) => s.setModal)
  const plan = useStore((s) => s.plan)
  const pinned = useStore((s) => s.todayPinned)
  return (
    <header className="flex items-center gap-3 px-3 py-1.5" style={{ borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-[14px] font-bold tracking-tight">多线程</span>
        <span className="num text-[12px] font-medium">{mdw(view.today)}</span>
        <span className="num text-[11px]" style={{ color: 'var(--muted)' }}>
          W{isoWeek(view.today)}
        </span>
        {plan.meta.demo && (
          <span className="rounded px-1 text-[10px] font-semibold" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }} title="data/plan.json 里现在是示例数据">
            示例数据
          </span>
        )}
        {pinned && (
          <span className="rounded px-1 text-[10px]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            日期已固定
          </span>
        )}
      </div>
      <Stats view={view} />
      <div className="ml-auto flex shrink-0 items-center gap-1" style={{ width: 'clamp(180px, 18vw, 320px)' }}>
        <QuickAdd />
      </div>
      <div className="flex shrink-0 items-center">
        <SyncDot />
        <button className="btn btn-ghost" onClick={() => setModal('legend')}>
          图例
        </button>
        <button className="btn btn-ghost" onClick={() => setModal('settings')}>
          设置
        </button>
      </div>
    </header>
  )
}
