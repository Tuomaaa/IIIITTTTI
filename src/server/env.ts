// Bindings for the Cloudflare Pages Functions in functions/. Set them in the Pages project
// (Settings → Variables and Secrets); see docs/deploy.md.
import { DEFAULT_SOURCE, type Source } from '../data/github'

export interface Env {
  /** Fine-grained PAT, Contents read & write on the plan repo only. Secret. */
  GITHUB_TOKEN?: string
  /** Random string that forms the MCP URL: /mcp/<MCP_SECRET>. Secret. */
  MCP_SECRET?: string
  /** e.g. `tuostmm.cloudflareaccess.com` (Zero Trust → Settings → Team domain). */
  ACCESS_TEAM_DOMAIN?: string
  /** Application Audience (AUD) tag of the Access application that covers the site. */
  ACCESS_AUD?: string
  /** Local `wrangler pages dev` only. Never set this on the Pages project. */
  INSECURE_SKIP_ACCESS?: string
}

/** What a Pages Function receives; only the fields these functions use. */
export interface Ctx<P extends string = string> {
  request: Request
  env: Env
  params: Record<P, string | string[] | undefined>
}

export function planSource(env: Env): Source {
  return { ...DEFAULT_SOURCE, token: env.GITHUB_TOKEN, userAgent: 'iiiittttti-planner' }
}

export function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}
