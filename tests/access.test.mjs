// Tests for the admin lock (lib/access.js). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessJwt, requireAccess } from '../lib/access.js';

const team = 'realfin';
const aud = 'aud-tag-123';
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1' };
const other = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);

let certFetches = 0;
const fetchImpl = async (url) => {
  certFetches++;
  assert.equal(url, `https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`);
  return new Response(JSON.stringify({ keys: [jwk] }));
};

async function sign(claims, key = privateKey, header = { alg: 'RS256', kid: 'k1' }) {
  const data = `${enc(header)}.${enc(claims)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  return `${data}.${Buffer.from(sig).toString('base64url')}`;
}

const now = Date.now();
const good = { aud: [aud], iss: `https://${team}.cloudflareaccess.com`, exp: Math.floor(now / 1000) + 600, email: 'Me@Example.com' };
const opts = { team, aud, fetchImpl, now };

test('access: accepts a valid token', async () => {
  assert.ok(await verifyAccessJwt(await sign(good), opts));
  assert.ok(await verifyAccessJwt(await sign(good), { ...opts, email: 'me@example.com' }));
});

test('access: rejects wrong app, issuer, expired, forged, wrong email, junk', async () => {
  assert.equal(await verifyAccessJwt(await sign({ ...good, aud: ['other-app'] }), opts), null);
  assert.equal(await verifyAccessJwt(await sign({ ...good, iss: 'https://evil.cloudflareaccess.com' }), opts), null);
  assert.equal(await verifyAccessJwt(await sign({ ...good, exp: Math.floor(now / 1000) - 1 }), opts), null);
  assert.equal(await verifyAccessJwt(await sign(good, other.privateKey), opts), null);
  assert.equal(await verifyAccessJwt(await sign(good, privateKey, { alg: 'none', kid: 'k1' }), opts), null);
  assert.equal(await verifyAccessJwt(await sign(good, privateKey, { alg: 'RS256', kid: 'nope' }), opts), null);
  assert.equal(await verifyAccessJwt(await sign(good), { ...opts, email: 'someone@else.com' }), null);
  const [h, , s] = (await sign(good)).split('.');
  assert.equal(await verifyAccessJwt(`${h}.${enc({ ...good, email: 'x@y.z' })}.${s}`, opts), null); // tampered payload
  assert.equal(await verifyAccessJwt('not-a-jwt', opts), null);
  assert.ok(certFetches <= 2, 'certs are cached');
});

test('access middleware: locked without config, 403 without token', async () => {
  const next = async () => new Response('editor');
  const req = (headers = {}) => new Request('https://realfin-site.pages.dev/admin/', { headers });
  assert.equal((await requireAccess({ request: req(), env: {}, next })).status, 503);
  assert.equal((await requireAccess({ request: req(), env: { ACCESS_TEAM: 'bad team!', ACCESS_AUD: aud }, next })).status, 503);
  assert.equal((await requireAccess({ request: req(), env: { ACCESS_TEAM: team, ACCESS_AUD: aud }, next })).status, 403);
  assert.equal((await requireAccess({ request: req({ 'Cf-Access-Jwt-Assertion': 'junk' }), env: { ACCESS_TEAM: team, ACCESS_AUD: aud }, next })).status, 403);
});
