// Lock for the admin area (/admin and the GitHub login in /api): only requests that passed
// Cloudflare Access get through. Cloudflare Access sits in front of realfin.dev, but not in front of
// realfin-site.pages.dev or preview URLs, so we also verify Access's signed token here.
// Fails closed: without ACCESS_TEAM and ACCESS_AUD set in the Pages project, everything is blocked.
//
// Env: ACCESS_TEAM  = Zero Trust team name (the "<team>" in <team>.cloudflareaccess.com)
//      ACCESS_AUD   = the Access application's "Application Audience (AUD) Tag"
//      ACCESS_EMAIL = optional; if set, only this email is let in (extra check on top of the Access policy)

const certCache = new Map(); // team -> { keys, at }
const CERT_TTL_MS = 60 * 60 * 1000;

const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const decodeJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function getKeys(team, fetchImpl, now) {
  const cached = certCache.get(team);
  if (cached && now - cached.at < CERT_TTL_MS) return cached.keys;
  const res = await fetchImpl(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const { keys } = await res.json();
  certCache.set(team, { keys, at: now });
  return keys;
}

// Returns the token's claims if it's a valid Access token for this team/app, otherwise null.
export async function verifyAccessJwt(token, { team, aud, email, fetchImpl = fetch, now = Date.now() }) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const header = decodeJson(h);
    const claims = decodeJson(p);
    if (header.alg !== 'RS256') return null;

    const jwk = (await getKeys(team, fetchImpl, now)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;

    const seconds = now / 1000;
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!auds.includes(aud)) return null;
    if (claims.iss !== `https://${team}.cloudflareaccess.com`) return null;
    if (typeof claims.exp !== 'number' || claims.exp < seconds) return null;
    if (typeof claims.nbf === 'number' && claims.nbf > seconds + 60) return null;
    if (email && String(claims.email || '').toLowerCase() !== email.toLowerCase()) return null;
    return claims;
  } catch {
    return null;
  }
}

const deny = (status, text) =>
  new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });

// Pages Functions middleware: export const onRequest = requireAccess;
export async function requireAccess({ request, env, next }) {
  const team = env.ACCESS_TEAM;
  const aud = env.ACCESS_AUD;
  if (!team || !aud || !/^[a-z0-9-]+$/.test(team)) {
    return deny(503, 'The admin area is locked (Cloudflare Access is not configured).');
  }
  const cookie = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || cookie;
  if (!token || !(await verifyAccessJwt(token, { team, aud, email: env.ACCESS_EMAIL }))) {
    return deny(403, 'Forbidden. Open the admin area via https://realfin.dev/admin/ and sign in.');
  }
  const res = await next();
  // Never let a cache keep admin responses.
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-store');
  out.headers.set('X-Robots-Tag', 'noindex');
  return out;
}
