import type { APIRoute } from 'astro';
import { ADSENSE_CLIENT } from '../consts';

// Google requires /ads.txt on the root domain. Generated from ADSENSE_CLIENT ('ca-pub-…' → 'pub-…').
export const GET: APIRoute = () => {
  const pub = ADSENSE_CLIENT.replace(/^ca-/, '');
  const body = pub
    ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`
    : '# ads.txt: no ad networks configured yet\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
