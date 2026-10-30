// MCP endpoint for claude.ai custom connectors: https://<host>/mcp/<MCP_SECRET>.
// Not behind Cloudflare Access (connectors cannot do the Access login); the secret path is the auth.
import { fetchPlan, savePlan } from '../../src/data/github'
import { planSource, text, type Ctx } from '../../src/server/env'
import { handleMcp } from '../../src/server/mcp'

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function onRequest({ request, env, params }: Ctx<'secret'>): Promise<Response> {
  const secret = env.MCP_SECRET
  if (!secret || secret.length < 32 || typeof params.secret !== 'string' || !sameSecret(params.secret, secret)) return text(404, 'Not found')
  if (!env.GITHUB_TOKEN) return text(500, 'GITHUB_TOKEN 没有配置')
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON 解析失败' } }, { status: 400 })
  }
  const src = planSource(env)
  const reply = await handleMcp(body, {
    load: () => fetchPlan(src),
    save: (plan, sha, message) => savePlan(src, plan, sha, message),
  })
  if (reply === null) return new Response(null, { status: 202 })
  return Response.json(reply, { headers: { 'Cache-Control': 'no-store' } })
}
