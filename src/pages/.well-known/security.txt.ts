import type { APIRoute } from 'astro';

// RFC 9116 security contact. Expires one year after each build, so it stays valid as long as the site is rebuilt.
export const GET: APIRoute = () => {
  const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
  const body = [
    'Contact: mailto:hello@realfin.dev',
    `Expires: ${expires}`,
    'Preferred-Languages: en',
    'Canonical: https://realfin.dev/.well-known/security.txt',
    'Policy: https://realfin.dev/write/#report',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
