import type { APIRoute } from 'astro';
import { getPosts } from '../../lib';

// Path → author map, for attributing AdSense/Analytics page earnings to authors later.
export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const map = posts.map((p) => ({ path: `/blog/${p.id}/`, author: p.data.author.id, ads: p.data.ads }));
  return new Response(JSON.stringify(map, null, 2), { headers: { 'Content-Type': 'application/json' } });
};
