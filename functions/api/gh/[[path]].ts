// Same-origin proxy to the GitHub API for the web app, so the browser needs no token.
// Only the plan file and its commit list are reachable. Behind Cloudflare Access.
import { accessUser } from '../../../src/server/access'
import { planSource, text, type Ctx } from '../../../src/server/env'

export async function onRequest({ request, env, params }: Ctx<'path'>): Promise<Response> {
  if (!(await accessUser(request, env))) return text(401, 'Cloudflare Access 登录无效')
  if (!env.GITHUB_TOKEN) return text(500, 'GITHUB_TOKEN 没有配置')

  const src = planSource(env)
  const path = ([] as string[]).concat(params.path ?? []).join('/')
  const repo = `repos/${src.owner}/${src.repo}`
  const allowed =
    (path === `${repo}/contents/${src.path}` && (request.method === 'GET' || request.method === 'PUT')) ||
    (path === `${repo}/commits` && request.method === 'GET')
  if (!allowed) return text(403, `代理不允许 ${request.method} /${path}`)

  const res = await fetch(`https://api.github.com/${path}${new URL(request.url).search}`, {
    method: request.method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': src.userAgent!,
      ...(request.method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: request.method === 'PUT' ? await request.text() : undefined,
  })
  const headers = new Headers({ 'Content-Type': res.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-store' })
  const remaining = res.headers.get('x-ratelimit-remaining')
  if (remaining) headers.set('x-ratelimit-remaining', remaining)
  return new Response(res.body, { status: res.status, headers })
}
