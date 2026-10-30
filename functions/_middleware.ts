// Every request except the MCP endpoint needs a valid Cloudflare Access token, static assets
// included: the JS bundle carries a snapshot of plan.json, and *.pages.dev is not behind Access.
import { accessUser } from '../src/server/access'
import { text, type Ctx } from '../src/server/env'

export async function onRequest(ctx: Ctx & { next(): Promise<Response> }): Promise<Response> {
  if (new URL(ctx.request.url).pathname.startsWith('/mcp/')) return ctx.next()
  if (!(await accessUser(ctx.request, ctx.env))) return text(403, '需要通过 Cloudflare Access 登录，请从 https://plan.tuostmm.com 打开')
  return ctx.next()
}
