import type { APIRoute } from 'astro';
import { IS_PRODUCTION } from '../consts';

export const GET: APIRoute = () => {
  const body = IS_PRODUCTION
    ? `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: https://realfin.dev/sitemap-index.xml\n`
    : `# Staging copy of realfin.dev: not for search engines.\nUser-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
