// Verify the Cloudflare Access JWT on requests that reach a Pages Function.
// Access already blocks unauthenticated requests at the edge; this check is the second lock,
// for the paths Access does not cover (*.pages.dev, preview deployments, a misconfigured policy).
import type { Env } from './env'

interface Jwk extends JsonWebKey {
  kid: string
}

let certs: { team: string; at: number; keys: Map<string, CryptoKey> } | null = null

async function keysFor(team: string): Promise<Map<string, CryptoKey>> {
  if (certs && certs.team === team && Date.now() - certs.at < 10 * 60_000) return certs.keys
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`)
  if (!res.ok) throw new Error(`Access certs ${res.status}`)
  const body = (await res.json()) as { keys: Jwk[] }
  const keys = new Map<string, CryptoKey>()
  for (const k of body.keys) keys.set(k.kid, await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']))
  certs = { team, at: Date.now(), keys }
  return keys
}

function b64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function tokenOf(req: Request): string | null {
  const h = req.headers.get('Cf-Access-Jwt-Assertion')
  if (h) return h
  const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(req.headers.get('Cookie') ?? '')
  return m ? m[1] : null
}

/** The signed-in email, or null when the request does not carry a valid Access token. */
export async function accessUser(req: Request, env: Env): Promise<string | null> {
  if (env.INSECURE_SKIP_ACCESS === '1') return 'local-dev'
  const team = env.ACCESS_TEAM_DOMAIN
  const aud = env.ACCESS_AUD
  if (!team || !aud) return null
  const jwt = tokenOf(req)
  if (!jwt) return null
  const [h, p, s] = jwt.split('.')
  if (!h || !p || !s) return null
  try {
    const header = JSON.parse(new TextDecoder().decode(b64url(h))) as { kid?: string; alg?: string }
    if (header.alg !== 'RS256' || !header.kid) return null
    const key = (await keysFor(team)).get(header.kid)
    if (!key) return null
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`))
    if (!ok) return null
    const claims = JSON.parse(new TextDecoder().decode(b64url(p))) as { aud?: string | string[]; exp?: number; iss?: string; email?: string }
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (!auds.includes(aud)) return null
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null
    if (claims.iss !== `https://${team}`) return null
    return claims.email ?? 'service-token'
  } catch {
    return null
  }
}
