import { create } from 'zustand'
import { todayIn } from '../core/date'
import { OpError } from '../core/ops'
import type { ISODate, Plan } from '../core/types'
import { validatePlan } from '../core/validate'
import bundled from '../../data/plan.json'
import { ConflictError, DEFAULT_SOURCE, fetchPlan, GitHubError, savePlan, type Source } from './github'

export interface Op {
  label: string
  fn: (plan: Plan) => Plan
}

export type SyncState = 'loading' | 'idle' | 'saving' | 'error'
export type Origin = 'live' | 'cache' | 'bundled'
export type Theme = 'system' | 'light' | 'dark'

interface State {
  /** Last plan known to be on GitHub (or the best fallback we have). */
  base: Plan
  sha: string | null
  origin: Origin
  /** Ops being written right now. */
  inflight: Op[]
  /** Ops waiting for the next write. */
  pending: Op[]
  /** `base` with inflight + pending ops applied: what the UI shows. */
  plan: Plan
  sync: SyncState
  error: string | null
  lastSync: number | null
  source: Source
  today: ISODate
  /** `?today=YYYY-MM-DD` pins the date for demos and screenshots. */
  todayPinned: boolean
  theme: Theme
  toast: { msg: string; kind: 'info' | 'error' } | null

  init(): Promise<void>
  refresh(force?: boolean): Promise<void>
  apply(label: string, fn: (plan: Plan) => Plan): boolean
  setSource(src: Source): void
  setTheme(t: Theme): void
  tick(): void
  notify(msg: string, kind?: 'info' | 'error'): void
  clearCache(): void
}

const CFG_KEY = 'planner.source'
const CACHE_KEY = 'planner.cache'
const THEME_KEY = 'planner.theme'

function read<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable (private mode etc.) */
  }
}

function sourceKey(s: Source) {
  return `${s.owner}/${s.repo}@${s.branch}:${s.path}`
}

function pinnedToday(): ISODate | null {
  const q = new URLSearchParams(location.search).get('today')
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : null
}

function replay(base: Plan, ops: Op[], onFail: (op: Op, e: unknown) => void): Plan {
  let p = base
  for (const op of ops) {
    try {
      p = op.fn(p)
    } catch (e) {
      onFail(op, e)
    }
  }
  return p
}

let flushTimer: ReturnType<typeof setTimeout> | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined
let lastRefresh = 0

export const useStore = create<State>((set, get) => {
  const source = { ...DEFAULT_SOURCE, ...(read<Source>(CFG_KEY) ?? {}) }
  const cache = read<{ key: string; plan: Plan; sha: string; at: number }>(CACHE_KEY)
  const cached = cache && cache.key === sourceKey(source) ? cache : null
  const base = (cached?.plan ?? bundled) as Plan
  const pin = pinnedToday()

  const recompute = (patch: Partial<State> = {}) => {
    const s = { ...get(), ...patch }
    const plan = replay(s.base, [...s.inflight, ...s.pending], (op, e) => {
      console.warn('op failed on replay', op.label, e)
    })
    set({ ...patch, plan })
  }

  const flush = async () => {
    const s = get()
    if (s.inflight.length || !s.pending.length) return
    if (!s.source.token) return
    const ops = s.pending
    set({ inflight: ops, pending: [], sync: 'saving' })
    let base = get().base
    let sha = get().sha
    for (let attempt = 0; attempt < 4; attempt++) {
      const dropped: string[] = []
      const next = replay(base, ops, (op, e) => dropped.push(`${op.label}：${e instanceof Error ? e.message : e}`))
      try {
        if (!sha) {
          const remote = await fetchPlan(get().source)
          base = remote.plan
          sha = remote.sha
          continue
        }
        const issues = validatePlan(next).filter((i) => i.level === 'error')
        if (issues.length) throw new Error(`数据校验失败：${issues[0].path} ${issues[0].msg}`)
        const msg = ops.length === 1 ? `plan: ${ops[0].label}` : `plan: ${ops.length} 项修改\n\n${ops.map((o) => `- ${o.label}`).join('\n')}`
        const newSha = await savePlan(get().source, next, sha, msg)
        write(CACHE_KEY, { key: sourceKey(get().source), plan: next, sha: newSha, at: Date.now() })
        recompute({ base: next, sha: newSha, inflight: [], sync: 'idle', error: null, lastSync: Date.now(), origin: 'live' })
        if (dropped.length) get().notify(`有修改没能应用：${dropped.join('；')}`, 'error')
        if (get().pending.length) scheduleFlush()
        return
      } catch (e) {
        if (e instanceof ConflictError) {
          const remote = await fetchPlan(get().source).catch(() => null)
          if (remote) {
            base = remote.plan
            sha = remote.sha
            recompute({ base, sha })
            continue
          }
        }
        const msg = e instanceof Error ? e.message : String(e)
        // Put the ops back so nothing is lost; the user can retry by refreshing or editing again.
        recompute({ inflight: [], pending: [...ops, ...get().pending], sync: 'error', error: `保存失败：${msg}` })
        get().notify(`保存失败：${msg}`, 'error')
        return
      }
    }
    recompute({ inflight: [], pending: [...ops, ...get().pending], sync: 'error', error: '保存失败：冲突重试次数用完' })
  }

  const scheduleFlush = () => {
    clearTimeout(flushTimer)
    flushTimer = setTimeout(() => void flush(), 1200)
  }

  return {
    base,
    sha: cached?.sha ?? null,
    origin: cached ? 'cache' : 'bundled',
    inflight: [],
    pending: [],
    plan: base,
    sync: 'loading',
    error: null,
    lastSync: cached?.at ?? null,
    source,
    today: pin ?? todayIn(),
    todayPinned: !!pin,
    theme: read<Theme>(THEME_KEY) ?? 'system',
    toast: null,

    async init() {
      await get().refresh(true)
    },

    async refresh(force = false) {
      if (!force && Date.now() - lastRefresh < 30_000) return
      lastRefresh = Date.now()
      if (get().inflight.length) return
      // Background refreshes keep showing the current state; only a cold start shows "loading".
      if (get().origin !== 'live' && get().sync !== 'error') set({ sync: 'loading' })
      try {
        const { plan, sha } = await fetchPlan(get().source)
        write(CACHE_KEY, { key: sourceKey(get().source), plan, sha, at: Date.now() })
        recompute({ base: plan, sha, origin: 'live', sync: 'idle', error: null, lastSync: Date.now() })
        if (get().pending.length) scheduleFlush()
      } catch (e) {
        const msg = e instanceof GitHubError ? e.message : '网络不通，先用本地缓存'
        set({ sync: 'error', error: msg })
      }
    },

    apply(label, fn) {
      const s = get()
      if (!s.source.token) {
        get().notify('只读模式：在「设置」里填 GitHub token 之后才能保存修改', 'error')
        return false
      }
      try {
        fn(s.plan)
      } catch (e) {
        get().notify(e instanceof OpError || e instanceof Error ? e.message : String(e), 'error')
        return false
      }
      recompute({ pending: [...s.pending, { label, fn }] })
      scheduleFlush()
      return true
    },

    setSource(src) {
      const changed = sourceKey(src) !== sourceKey(get().source)
      write(CFG_KEY, src)
      set({ source: src })
      if (changed) {
        write(CACHE_KEY, null)
        set({ sha: null, pending: [] })
      }
      void get().refresh(true)
    },

    setTheme(theme) {
      write(THEME_KEY, theme)
      set({ theme })
    },

    tick() {
      if (get().todayPinned) return
      const t = todayIn()
      if (t !== get().today) set({ today: t })
    },

    notify(msg, kind = 'info') {
      clearTimeout(toastTimer)
      set({ toast: { msg, kind } })
      toastTimer = setTimeout(() => set({ toast: null }), kind === 'error' ? 6000 : 3000)
    },

    clearCache() {
      write(CACHE_KEY, null)
      void get().refresh(true)
    },
  }
})
