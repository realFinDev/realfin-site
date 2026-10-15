import type { APIRoute } from 'astro';
import css from '../../styles/global.css?raw';

// Stable-URL copy of the site stylesheet for the CMS preview pane.
// Decap renders the post body without our .prose wrapper, so apply the prose rules to the preview body too.
export const GET: APIRoute = () => {
  const preview = css.replace(/\.prose /g, 'body ') + '\nbody { padding: 16px 20px; max-width: 760px; }\n';
  return new Response(preview, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
};
