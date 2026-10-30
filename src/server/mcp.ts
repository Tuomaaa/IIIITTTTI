// Minimal MCP server (Streamable HTTP, stateless, JSON responses only) over the plan CLI.
// Tools run src/core/commands.ts against the plan on GitHub, so behaviour matches `npm run plan`.
import { CmdError, HELP, runCommand } from '../core/commands'
import type { Plan } from '../core/types'
import { ConflictError } from '../data/github'

export interface PlanStore {
  load(): Promise<{ plan: Plan; sha: string }>
  /** Throws ConflictError when `sha` is stale. Returns the new sha. */
  save(plan: Plan, sha: string, message: string): Promise<string>
}

interface RpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

// Condensed from docs/agents/plan.md, which a chat client cannot read. Keep the two in sync.
export const INSTRUCTIONS = `这是用户的个人日程（IIIITTTTI：线程 / 甘特条 task / todo / 时间块 / milestone）。改动会直接 commit 到 GitHub，网页实时显示。
- 每次对话先调 summary，把「需处理」里的东西主动提出来，再做用户要的事。
- 写操作一律用 run 工具（参数和 CLI 完全一样，见 run 的说明）。不确定时先加 dry: true 预览。
- 有截止的东西（作业、quiz、report、提交）一律做成 hard milestone（add-milestone --hard），不要做成 todo。todo 是没有时间限制的备忘录。课程放在「课程」group，每门课一条线程。
- 用户说"X 写完了"但对应多条记录时，先问是哪一条。
- 推后协议：soft task 过期不要默默推，先用 suggest 算建议，告诉用户「X 过期 N 天，估计还剩 R 天，建议推到 D」，用户同意后再 push --by agent --reason ...。一次推后默认不超过 maxPushDays（2）天，超过就该拆小或补 focus 天。
- hard task / hard milestone 不能推：只能完成、砍 scope，或确认后标记 missed（写进 note）。
- 同一个 task 推了 ≥3 次不要再推，提议拆小或砍 scope。每次推后都必须写 reason。
- 不要用 set 改 slips / baseline。
- 用户偏好：中文交流，专业名词可以用英文；不用 em dash。`

const TOOLS = [
  {
    name: 'summary',
    title: '今日简报',
    description: '今天的简报：需处理 / 今日聚焦 / 时间块 / todo / 进行中 / N 天内开始 / milestone / 最近推迟 / 并行数。每次对话先调一次。',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'integer', minimum: 1, maximum: 60, description: '往后看几天，默认 14' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'run',
    title: '执行 plan 命令',
    description: `执行一条 plan CLI 命令。args 是 argv 数组，不含 "npm run plan --"，例如 ["done","ms-hrbt"]、["push","tk-x","--days","1","--reason","没时间"]、["add","改 intro #文献 明天"]。写命令成功后会自动 commit 到 GitHub。--file 无效。\n\n${HELP}`,
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'argv，例如 ["show","tk-arm-build"]' },
        dry: { type: 'boolean', description: 'true 时只预览，不写入' },
      },
      required: ['args'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
]

function ok(id: RpcRequest['id'], result: unknown) {
  return { jsonrpc: '2.0' as const, id: id ?? null, result }
}

function err(id: RpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0' as const, id: id ?? null, error: { code, message } }
}

function toolText(lines: string[], isError = false) {
  return { content: [{ type: 'text', text: lines.join('\n') }], isError }
}

async function callTool(name: string, input: Record<string, unknown>, store: PlanStore) {
  let argv: string[]
  if (name === 'summary') argv = ['summary', ...(input.days != null ? ['--days', String(input.days)] : [])]
  else if (name === 'run') {
    const args = input.args
    if (!Array.isArray(args) || !args.length || !args.every((a) => typeof a === 'string')) return toolText(['✕ args 应为非空字符串数组'], true)
    argv = args as string[]
  } else return null

  for (let attempt = 0; attempt < 4; attempt++) {
    const { plan, sha } = await store.load()
    let res
    try {
      res = runCommand(plan, argv)
    } catch (e) {
      if (e instanceof CmdError) return toolText([`✕ ${e.message}`], true)
      throw e
    }
    const lines = [...res.warn.map((w) => `⚠ ${w}`), ...res.errors.map((e) => `✕ ${e}`), ...res.out]
    if (!res.next) return toolText(lines, res.errors.length > 0)
    if (input.dry === true || res.opt.dry) return toolText([...lines, `（dry）会执行：${res.what}`])
    try {
      const newSha = await store.save(res.next, sha, `plan: ${res.what}\n\nvia MCP\n\nCo-Authored-By: Claude <noreply@anthropic.com>`)
      return toolText([...lines, `✓ ${res.what}（commit ${newSha.slice(0, 7)}）`])
    } catch (e) {
      if (e instanceof ConflictError) continue
      throw e
    }
  }
  return toolText(['✕ 写入冲突重试 4 次都失败，稍后再试'], true)
}

async function handleOne(req: RpcRequest, store: PlanStore) {
  const p = req.params ?? {}
  switch (req.method) {
    case 'initialize': {
      const asked = typeof p.protocolVersion === 'string' ? p.protocolVersion : ''
      return ok(req.id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'iiiittttti-plan', title: 'IIIITTTTI 日程', version: '0.1.0' },
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return ok(req.id, {})
    case 'tools/list':
      return ok(req.id, { tools: TOOLS })
    case 'tools/call': {
      const name = String(p.name ?? '')
      try {
        const r = await callTool(name, (p.arguments as Record<string, unknown>) ?? {}, store)
        return r ? ok(req.id, r) : err(req.id, -32602, `未知工具 ${name}`)
      } catch (e) {
        return ok(req.id, toolText([`✕ ${e instanceof Error ? e.message : String(e)}`], true))
      }
    }
    default:
      return err(req.id, -32601, `不支持的方法 ${req.method}`)
  }
}

/** Handle one POSTed JSON-RPC message or batch. Returns null when only notifications came in. */
export async function handleMcp(body: unknown, store: PlanStore): Promise<unknown> {
  const batch = Array.isArray(body)
  const msgs = (batch ? body : [body]) as RpcRequest[]
  const out = []
  for (const m of msgs) {
    if (!m || typeof m !== 'object' || typeof m.method !== 'string') {
      out.push(err(null, -32600, '不是 JSON-RPC 请求'))
      continue
    }
    if (m.id === undefined) continue // notification
    out.push(await handleOne(m, store))
  }
  if (!out.length) return null
  return batch ? out : out[0]
}
