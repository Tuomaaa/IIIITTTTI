// Read / write data/plan.json through the GitHub Contents API.
// Reads of a public repo work without a token (60 requests/hour per IP); writes need a
// fine-grained token with Contents read & write on that one repo.
import { formatJSON } from '../core/format'
import type { Plan } from '../core/types'

export interface Source {
  owner: string
  repo: string
  branch: string
  path: string
  token?: string
}

export const DEFAULT_SOURCE: Source = {
  owner: 'Tuomaaa',
  repo: 'IIIITTTTI',
  branch: 'main',
  path: 'data/plan.json',
}

export class GitHubError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class ConflictError extends GitHubError {}

function url(src: Source) {
  const path = src.path.split('/').map(encodeURIComponent).join('/')
  return `https://api.github.com/repos/${src.owner}/${src.repo}/contents/${path}`
}

function headers(src: Source): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (src.token) h.Authorization = `Bearer ${src.token}`
  return h
}

async function explain(res: Response): Promise<GitHubError> {
  let detail = ''
  try {
    detail = ((await res.json()) as { message?: string }).message ?? ''
  } catch {
    /* body is not JSON */
  }
  const remaining = res.headers.get('x-ratelimit-remaining')
  if (res.status === 401) return new GitHubError(401, 'token 无效或已过期')
  if ((res.status === 403 || res.status === 429) && remaining === '0')
    return new GitHubError(res.status, '超出 GitHub API 频率限制，填 token 后上限会高很多')
  if (res.status === 403) return new GitHubError(403, `没有权限：${detail}（token 需要 Contents 读写权限）`)
  if (res.status === 404) return new GitHubError(404, '找不到数据文件（repo / 路径不对，或 private repo 没填 token）')
  return new GitHubError(res.status, `GitHub ${res.status}: ${detail}`)
}

export function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function fetchPlan(src: Source): Promise<{ plan: Plan; sha: string }> {
  const res = await fetch(`${url(src)}?ref=${encodeURIComponent(src.branch)}`, {
    headers: headers(src),
    cache: 'no-store',
  })
  if (!res.ok) throw await explain(res)
  const body = (await res.json()) as { content?: string; sha: string; encoding?: string }
  if (!body.content) throw new GitHubError(500, '数据文件超过 1MB，Contents API 读不了')
  return { plan: JSON.parse(decodeBase64Utf8(body.content)) as Plan, sha: body.sha }
}

export async function savePlan(src: Source, plan: Plan, sha: string, message: string): Promise<string> {
  if (!src.token) throw new GitHubError(401, '没有 token，不能保存')
  const res = await fetch(url(src), {
    method: 'PUT',
    headers: { ...headers(src), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encodeBase64Utf8(formatJSON(plan)),
      sha,
      branch: src.branch,
    }),
  })
  if (res.status === 409 || res.status === 422) {
    const err = await explain(res)
    // 422 is also used for other validation errors; only sha mismatches are retryable.
    if (res.status === 409 || /sha/i.test(err.message)) throw new ConflictError(res.status, err.message)
    throw err
  }
  if (!res.ok) throw await explain(res)
  const body = (await res.json()) as { content: { sha: string } }
  return body.content.sha
}

export interface CommitInfo {
  sha: string
  message: string
  date: string
  url: string
  /** Commit carries a Claude co-author trailer. */
  agent: boolean
}

/** Recent commits that touched the data file. */
export async function fetchCommits(src: Source, n = 15): Promise<CommitInfo[]> {
  const q = new URLSearchParams({ path: src.path, sha: src.branch, per_page: String(n) })
  const res = await fetch(`https://api.github.com/repos/${src.owner}/${src.repo}/commits?${q}`, {
    headers: headers(src),
    cache: 'no-store',
  })
  if (!res.ok) throw await explain(res)
  const body = (await res.json()) as { sha: string; html_url: string; commit: { message: string; committer: { date: string } } }[]
  return body.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    date: c.commit.committer.date,
    url: c.html_url,
    agent: /co-authored-by:\s*claude/i.test(c.commit.message),
  }))
}
