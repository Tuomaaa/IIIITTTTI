import { useState, type ReactNode } from 'react'
import { DEFAULT_SOURCE, fetchPlan, type Source } from '../data/github'
import { useStore, type Theme } from '../data/store'
import { useUI } from '../data/ui'

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-10" style={{ background: 'rgba(0,0,0,.25)' }} onClick={onClose}>
      <div className="panel fade-in w-full max-w-[560px]" style={{ boxShadow: 'var(--shadow)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--line-2)' }}>
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
  return null
}

const C = '#10b981'

function Sample({ children, w = 150 }: { children: ReactNode; w?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: w, height: 18 }}>
      {children}
    </div>
  )
}

function Win({ w, dashed, faded }: { w: number; dashed?: boolean; faded?: boolean }) {
  return (
    <div
      className="absolute top-[1px] left-0 h-[16px] rounded-[3px]"
      style={{
        width: w,
        background: dashed ? 'transparent' : `color-mix(in oklab, ${C} 18%, var(--panel))`,
        border: `1px ${dashed ? 'dashed' : 'solid'} color-mix(in oklab, ${C} 55%, var(--panel))`,
        opacity: faded ? 0.5 : 1,
      }}
    />
  )
}

function Cell({ x, strong = true, ring }: { x: number; strong?: boolean; ring?: boolean }) {
  return (
    <div
      className="absolute top-[1px] h-[16px] rounded-[2px]"
      style={{
        left: x + 1,
        width: 18,
        background: `color-mix(in oklab, ${C} ${strong ? 78 : 42}%, var(--panel))`,
        boxShadow: ring ? `0 0 0 1.5px var(--panel), 0 0 0 3px ${C}` : undefined,
      }}
    />
  )
}

function Legend() {
  const rows: [ReactNode, string][] = [
    [
      <Sample>
        <Win w={140} />
      </Sample>,
      '浅色条 = task 的时间窗口（start → end），颜色 = 所属线程',
    ],
    [
      <Sample>
        <Win w={140} />
        <Cell x={0} strong={false} />
        <Cell x={40} ring />
        <Cell x={60} />
        <Cell x={100} />
      </Sample>,
      '实心格 = 打算做它的日子（focus day）。过去的变浅，今天的带外圈。来源：focus 字段、挂在它上面的时间块和 todo',
    ],
    [
      <Sample>
        <Win w={140} />
        <div className="absolute bottom-[1px] left-0 h-[2.5px] rounded" style={{ width: 84, background: `color-mix(in oklab, ${C} 65%, var(--text))` }} />
      </Sample>,
      '底部细线 = 进度。没手动填时按挂在它上面的 todo 完成比例算',
    ],
    [
      <Sample>
        <Win w={80} />
        <div className="hatch-red absolute top-[1px] h-[16px] rounded-r-[3px]" style={{ left: 80, width: 40, border: '1px solid var(--red)', borderLeft: 'none' }} />
        <span className="absolute top-0 text-[10px] font-semibold" style={{ left: 124, color: 'var(--red)' }}>
          过期2d
        </span>
      </Sample>,
      '红色斜纹 = 过了 end 还没完成，每天变长一格，直到你推后或完成',
    ],
    [
      <Sample>
        <Win w={110} />
        <div className="absolute" style={{ left: 59, top: -1, bottom: -1, borderLeft: '1.5px dashed var(--text)', opacity: 0.55 }} />
        <span className="absolute top-0 text-[10px] font-semibold" style={{ left: 114, color: 'var(--red)' }}>
          +7d×3
        </span>
      </Sample>,
      '虚线 = 原定的 end（baseline）。+7d×3 = 一共推了 7 天、推了 3 次。颜色：黄 1 次 · 橙 2 次 · 红 ≥3 次',
    ],
    [
      <Sample>
        <Win w={140} />
        <div className="absolute top-0 h-[18px] rounded-r-[3px]" style={{ left: 137, width: 3, background: 'var(--red)' }} />
      </Sample>,
      '右端红色竖条 = 硬 ddl，不能推',
    ],
    [
      <Sample>
        <span className="absolute top-[4px] left-2 inline-block h-[8px] w-[8px] rotate-45" style={{ background: C }} />
        <span className="absolute top-[4px] left-8 inline-block h-[8px] w-[8px] rotate-45" style={{ background: 'var(--red)' }} />
        <span className="absolute top-[4px] left-14 inline-block h-[8px] w-[8px] rotate-45" style={{ border: '1.5px solid var(--faint)' }} />
      </Sample>,
      '◆ milestone（线程色）· 红 ◆ = 硬 ddl · 空心 = 已完成',
    ],
    [
      <Sample>
        <Win w={140} dashed faded />
        <span className="absolute top-[1px] left-1 text-[11px]">⏸ 暂停</span>
      </Sample>,
      '虚线框 = 暂停（parked），不计入负载；变淡 + ✓ = 已完成',
    ],
    [
      <Sample>
        <span className="num absolute top-0 left-0 rounded px-1 text-[10px] font-semibold" style={{ background: 'color-mix(in oklab, var(--accent) 29%, transparent)' }}>
          3
        </span>
        <span className="num absolute top-0 left-6 rounded px-1 text-[10px] font-semibold" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
          5
        </span>
      </Sample>,
      '表头第二行 = 当天要并行推进几个 task。超过 maxParallel（默认 4）变红',
    ],
    [
      <Sample>
        <span className="num absolute top-0 left-0 rounded px-1 text-[10px] font-semibold" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}>
          ↻2d
        </span>
      </Sample>,
      '没完成的 todo 自动滚到今天，↻N 表示拖了 N 天。≥3 天变红并进「需处理」',
    ],
  ]
  return (
    <div className="space-y-2.5 text-[12px]">
      {rows.map(([s, t], i) => (
        <div key={i} className="flex items-center gap-3">
          {s}
          <div style={{ color: 'var(--muted)' }}>{t}</div>
        </div>
      ))}
      <div className="pt-1 text-[11px]" style={{ color: 'var(--faint)' }}>
        线程按「今天有没有事」排序：今天有聚焦或有过期的在最上面，暂停的在最下面。键盘：/ 快速添加。
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
