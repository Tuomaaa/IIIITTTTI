import { describe, expect, it } from 'vitest'
import type { Plan } from '../src/core/types'
import { ConflictError } from '../src/data/github'
import { handleMcp, type PlanStore } from '../src/server/mcp'

function plan(): Plan {
  return {
    version: 1,
    meta: { tz: 'America/Indiana/Indianapolis' },
    tracks: [{ id: 'a', name: '课程', color: '#f97316' }],
    tasks: [],
    milestones: [{ id: 'ms-1', trackId: 'a', title: 'HW', date: '2026-10-29', hard: true }],
    todos: [],
    blocks: [],
  }
}

function memStore(conflicts = 0) {
  const s = { plan: plan(), sha: 'sha0', saves: [] as string[] }
  const store: PlanStore = {
    async load() {
      return { plan: structuredClone(s.plan), sha: s.sha }
    },
    async save(next, sha, message) {
      if (conflicts-- > 0 || sha !== s.sha) throw new ConflictError(409, 'sha mismatch')
      s.plan = next
      s.sha = `sha${s.saves.push(message)}`
      return s.sha
    },
  }
  return { s, store }
}

const call = (store: PlanStore, name: string, args: Record<string, unknown>) =>
  handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, store) as Promise<{
    result: { content: { text: string }[]; isError: boolean }
  }>

describe('mcp', () => {
  it('initializes and lists tools', async () => {
    const { store } = memStore()
    const init = (await handleMcp({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, store)) as {
      result: { protocolVersion: string; instructions: string }
    }
    expect(init.result.protocolVersion).toBe('2025-03-26')
    expect(init.result.instructions).toContain('hard milestone')
    const list = (await handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, store)) as { result: { tools: { name: string }[] } }
    expect(list.result.tools.map((t) => t.name)).toEqual(['summary', 'run'])
    expect(await handleMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, store)).toBeNull()
  })

  it('reads without writing', async () => {
    const { s, store } = memStore()
    const r = await call(store, 'summary', {})
    expect(r.result.isError).toBe(false)
    expect(r.result.content[0].text).toContain('HW (ms-1)')
    expect(s.saves).toHaveLength(0)
  })

  it('writes with a commit message and retries on conflict', async () => {
    const { s, store } = memStore(1)
    const r = await call(store, 'run', { args: ['done', 'ms-1'] })
    expect(r.result.content[0].text).toContain('✓ 完成 milestone ms-1')
    expect(s.plan.milestones[0].done).toBe(true)
    expect(s.saves[0]).toMatch(/^plan: 完成 milestone ms-1\n[\s\S]*Co-Authored-By: Claude/)
  })

  it('dry runs and bad input do not write', async () => {
    const { s, store } = memStore()
    expect((await call(store, 'run', { args: ['done', 'ms-1'], dry: true })).result.content[0].text).toContain('（dry）')
    const bad = await call(store, 'run', { args: ['done', 'nope'] })
    expect(bad.result.isError).toBe(true)
    expect(s.saves).toHaveLength(0)
  })
})
