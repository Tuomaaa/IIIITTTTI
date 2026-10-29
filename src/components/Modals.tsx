import { useState, type ReactNode } from 'react'
import { addDays, diffDays } from '../core/date'
import { buildView, type PlanView } from '../core/derive'
import { setTrackFlags } from '../core/ops'
import type { ISODate, Plan } from '../core/types'
import { Bar } from './Gantt'
import { DEFAULT_SOURCE, fetchPlan, type Source } from '../data/github'
import { useStore, type Theme } from '../data/store'
import { useUI } from '../data/ui'

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-10" style={{ background: 'rgba(0,0,0,.25)' }} onClick={onClose}>
      <div className="panel fade-in w-full max-w-[640px]" style={{ boxShadow: 'var(--shadow)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-4 pt-3 pb-2" style={{ borderBottom: '2px solid var(--ink)' }}>
          <div className="text-[14px] font-semibold">{title}</div>
          <button className="btn btn-ghost ml-auto" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  )
}

export function Modals() {
  const modal = useUI((s) => s.modal)
  const setModal = useUI((s) => s.setModal)
  if (modal === 'legend')
    return (
      <Modal title="图例" onClose={() => setModal(null)}>
        <Legend />
      </Modal>
    )
  if (modal === 'settings')
    return (
      <Modal title="设置" onClose={() => setModal(null)}>
        <Settings />
      </Modal>
    )
  if (modal === 'archive')
    return (
      <Modal title="已归档的线程" onClose={() => setModal(null)}>
        <Archive />
      </Modal>
    )
  return null
}

function Archive() {
  const plan = useStore((s) => s.plan)
  const today = useStore((s) => s.today)
  const apply = useStore((s) => s.apply)
  const openTrack = useUI((s) => s.openTrack)
  const setModal = useUI((s) => s.setModal)
  const tracks = plan.tracks.filter((t) => t.archived).sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
  if (!tracks.length)
    return (
      <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
        还没有归档的线程
      </div>
    )
  return (
    <ul className="space-y-1.5">
      {tracks.map((t) => {
        const tasks = plan.tasks.filter((x) => x.trackId === t.id)
        const done = tasks.filter((x) => x.done).length
        return (
          <li key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ border: '1.5px solid var(--ink)' }}>
            <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: t.color, border: '1.5px solid var(--bar-ink)' }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-bold">{t.name}</div>
              <div className="num text-[10.5px]" style={{ color: 'var(--muted)' }}>
                {t.archivedAt ? `${t.archivedAt} 归档 · ` : ''}task {done}/{tasks.length} 完成 · <span className="mono">{t.id}</span>
              </div>
            </div>
            <button
              className="btn"
              onClick={() => {
                setModal(null)
                openTrack(t.id)
              }}
            >
              查看
            </button>
            <button className="btn" onClick={() => apply(`取消归档「${t.name}」`, (p) => setTrackFlags(p, t.id, { archived: false }, today))}>
              取消归档
            </button>
          </li>
        )
      })}
    </ul>
  )
}

const C = '#10b981'

/** A tiny plan whose tasks exercise every bar state; rendered with the real <Bar>. */
function legendView(today: ISODate) {
  const d = (n: number) => addDays(today, n)
  const plan: Plan = {
    version: 1,
    meta: {},
    tracks: [{ id: 'x', name: '示例', color: C }],
    milestones: [],
    todos: [],
    blocks: [],
    tasks: [
      { id: 'window', trackId: 'x', title: '时间窗口', start: d(-2), end: d(5) },
      { id: 'focus', trackId: 'x', title: '打算做的日子', start: d(-2), end: d(5), focus: [d(-1), d(0), d(1), d(3)] },
      { id: 'progress', trackId: 'x', title: '进度 60%', start: d(-2), end: d(5), progress: 0.6 },
      { id: 'upcoming', trackId: 'x', title: '未开始', start: d(1), end: d(6), focus: [d(2)] },
      { id: 'overdue', trackId: 'x', title: '过期', start: d(-6), end: d(-2), focus: [d(-5), d(-4)] },
      {
        id: 'pushed',
        trackId: 'x',
        title: '推过 3 次',
        start: d(-3),
        end: d(3),
        baseline: d(-1),
        slips: [
          { at: d(-2), from: d(-1), to: d(0) },
          { at: d(-1), from: d(0), to: d(1) },
          { at: d(0), from: d(1), to: d(3) },
        ],
      },
      { id: 'hard', trackId: 'x', title: '硬 ddl', start: d(-2), end: d(4), hard: true },
      { id: 'done', trackId: 'x', title: '已完成', start: d(-6), end: d(-1), done: true },
      { id: 'parked', trackId: 'x', title: '暂停', start: d(-2), end: d(4), parked: true },
    ],
  }
  return { view: buildView(plan, today), origin: d(-6) }
}

function BarSample({ id, view, origin, today }: { id: string; view: PlanView; origin: ISODate; today: ISODate }) {
  const DW = 15
  const tv = view.taskById.get(id)!
  return (
    <div className="relative shrink-0" style={{ width: 13 * DW + 70, height: 26 }}>
      <div className="absolute top-0 bottom-0" style={{ left: diffDays(origin, today) * DW, width: DW, background: 'var(--hl-soft)' }} />
      <Bar tv={tv} left={diffDays(origin, tv.task.start) * DW} top={2} dw={DW} today={today} stick={0} />
    </div>
  )
}

function Legend() {
  const today = useStore((s) => s.today)
  const { view, origin } = legendView(today)
  const bar = (id: string) => <BarSample id={id} view={view} origin={origin} today={today} />
  const rows: [ReactNode, string][] = [
    [bar('window'), '浅色条 = task 的时间窗口（start → end），颜色 = 所属线程。黄色竖条 = 今天'],
    [bar('focus'), '底部色带的实心段 = 打算做它的日子（focus day），过去的变浅。来源：focus 字段、挂在它上面的时间块和 todo'],
    [bar('progress'), '标题后面的百分比 = 进度。没手动填时按挂在它上面的 todo 完成比例算'],
    [bar('upcoming'), '半透明 = 还没开始'],
    [bar('overdue'), '红白警戒条纹 = 过了 end 还没完成，每天长一格，直到你推后或完成'],
    [bar('pushed'), '点线 = 原定的 end。+4d×3 = 一共推了 4 天、推了 3 次。贴纸颜色：黄 1 次 · 橙 2 次 · 红 ≥3 次'],
    [bar('hard'), '右端红块 = 硬 ddl，不能推'],
    [bar('done'), '变灰 + ✓ = 已完成'],
    [bar('parked'), '虚线框 = 暂停（parked），不计入负载'],
    [
      <div className="flex shrink-0 items-center gap-2" style={{ width: 13 * 15 + 70 }}>
        {[C, 'var(--sticker-red)', 'transparent'].map((fill, i) => (
          <span key={i} className="inline-block rotate-45" style={{ width: 9, height: 9, background: fill, border: `1.5px solid ${i === 2 ? 'var(--faint)' : 'var(--ink)'}`, boxShadow: i === 2 ? undefined : '1.5px 1.5px 0 var(--ink)' }} />
        ))}
      </div>,
      '◆ milestone（线程色）· 红 ◆ = 硬 ddl · 空心 = 已完成',
    ],
    [
      <div className="flex shrink-0 items-center gap-1" style={{ width: 13 * 15 + 70 }}>
        <span className="num rounded-[3px] px-1.5 text-[9.5px] font-bold" style={{ background: 'color-mix(in srgb, var(--accent) 38%, var(--panel))' }}>
          2
        </span>
        <span className="num rounded-[3px] px-1.5 text-[9.5px] font-bold text-white" style={{ background: 'var(--sticker-red)', border: '1.5px solid var(--bar-ink)' }}>
          5
        </span>
      </div>,
      '表头第二行 = 当天要并行推进几个 task。超过 maxParallel（默认 4）变红',
    ],
    [
      <div className="flex shrink-0 items-center gap-1" style={{ width: 13 * 15 + 70 }}>
        <span className="num rounded px-1 text-[9.5px] font-semibold" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}>
          ↻2d
        </span>
        <span className="num rounded px-1 text-[9.5px] font-semibold" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
          ↻3d
        </span>
      </div>,
      '没完成的 todo 自动滚到今天，↻N 表示拖了 N 天。≥3 天变红并进「需处理」',
    ],
  ]
  return (
    <div className="space-y-2.5 text-[12px]">
      {rows.map(([sample, text], i) => (
        <div key={i} className="flex items-center gap-3">
          {sample}
          <div style={{ color: 'var(--muted)' }}>{text}</div>
        </div>
      ))}
      <div className="pt-1 text-[11px]" style={{ color: 'var(--faint)' }}>
        线程按「今天有没有事」排序：今天有聚焦或有过期的在最上面，暂停的在最下面。点线程名看这条线的全部内容。键盘：/ 快速添加，Esc 关闭。
      </div>
    </div>
  )
}

function Settings() {
  const source = useStore((s) => s.source)
  const setSource = useStore((s) => s.setSource)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const clearCache = useStore((s) => s.clearCache)
  const [draft, setDraft] = useState<Source>(source)
  const [test, setTest] = useState<string | null>(null)
  const field = (k: keyof Source, label: string, ph?: string, type = 'text') => (
    <label className="block">
      <div className="mb-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <input
        type={type}
        className="w-full rounded-md border px-2 py-1 text-[12px]"
        style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}
        value={draft[k] ?? ''}
        placeholder={ph}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setDraft({ ...draft, [k]: e.target.value.trim() || undefined })}
      />
    </label>
  )
  return (
    <div className="space-y-4 text-[12px]">
      <section className="space-y-2">
        <div className="section-title">数据源（GitHub）</div>
        <div className="grid grid-cols-2 gap-2">
          {field('owner', 'owner')}
          {field('repo', 'repo')}
          {field('branch', 'branch')}
          {field('path', '文件路径')}
        </div>
        {field('token', 'Fine-grained token（只存在这台设备的浏览器里）', 'github_pat_…', 'password')}
        <details className="text-[11px]" style={{ color: 'var(--muted)' }}>
          <summary className="cursor-pointer">怎么拿 token？</summary>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>
              打开 GitHub → Settings → Developer settings → Fine-grained tokens →{' '}
              <a className="underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                Generate new token
              </a>
            </li>
            <li>Repository access 选 Only select repositories，只勾数据所在的那一个 repo</li>
            <li>Permissions → Repository permissions → Contents 选 Read and write，其它都不用</li>
            <li>生成后粘贴到上面。每台设备填一次；手机也一样</li>
          </ol>
          <div className="mt-1">不填 token 也能看（公开 repo），只是不能在网页上改。</div>
        </details>
        <div className="flex items-center gap-2">
          <button
            className="btn"
            style={{ background: 'var(--text)', color: 'var(--panel)' }}
            onClick={() => {
              setSource({ ...DEFAULT_SOURCE, ...draft })
              setTest('已保存')
            }}
          >
            保存
          </button>
          <button
            className="btn"
            onClick={async () => {
              setTest('测试中…')
              try {
                const { plan } = await fetchPlan({ ...DEFAULT_SOURCE, ...draft })
                setTest(`✓ 读到 ${plan.tracks.length} 条线程 / ${plan.tasks.length} 个 task${draft.token ? '' : '（没填 token：只读）'}`)
              } catch (e) {
                setTest(`✕ ${e instanceof Error ? e.message : e}`)
              }
            }}
          >
            测试连接
          </button>
          <button className="btn btn-ghost" onClick={() => setDraft({ ...DEFAULT_SOURCE, token: draft.token })}>
            恢复默认
          </button>
          {test && <span style={{ color: test.startsWith('✕') ? 'var(--red)' : 'var(--muted)' }}>{test}</span>}
        </div>
      </section>
      <section className="space-y-1.5">
        <div className="section-title">外观</div>
        <div className="flex gap-1">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} className="btn" aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t === 'system' ? '跟随系统' : t === 'light' ? '浅色' : '深色'}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-1.5">
        <div className="section-title">其它</div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn" onClick={clearCache}>
            清本地缓存并重新拉取
          </button>
          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
            手机上：浏览器菜单 →「添加到主屏幕」，就能像 app 一样打开
          </span>
        </div>
      </section>
    </div>
  )
}
