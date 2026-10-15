// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';

// Categories with no published posts are noindex and left out of the sitemap (empty listing pages look thin to Google).
const BLOG = './src/content/blog';
const usedCategories = new Set(
  fs.readdirSync(BLOG).filter((f) => f.endsWith('.md'))
    .map((f) => fs.readFileSync(`${BLOG}/${f}`, 'utf8'))
    .filter((src) => !/^draft:\s*true/m.test(src))
    .map((src) => src.match(/^category:\s*(\S+)/m)?.[1])
    .filter(Boolean),
);
// Post URL → last-modified date (updatedDate, else pubDate) for the sitemap's <lastmod>.
const lastmod = new Map(
  fs.readdirSync(BLOG).filter((f) => f.endsWith('.md')).flatMap((f) => {
    const src = fs.readFileSync(`${BLOG}/${f}`, 'utf8');
    const d = src.match(/^updatedDate:\s*(\S+)/m)?.[1] ?? src.match(/^pubDate:\s*(\S+)/m)?.[1];
    return d ? [[`https://realfin.dev/blog/${f.replace(/\.md$/, '')}/`, new Date(d).toISOString()]] : [];
  }),
);
const isEmptyCategory = (/** @type {string} */ page) => {
  const m = page.match(/\/category\/([^/]+)\/$/);
  return Boolean(m && !usedCategories.has(m[1]));
};

// Accessibility: give Markdown table header cells scope="col" so screen readers associate them with their column.
function rehypeTableScope() {
  /** @param {any} node */
  const walk = (node) => {
    if (node.type === 'element' && node.tagName === 'th') {
      node.properties = { ...node.properties, scope: node.properties?.scope ?? 'col' };
    }
    (node.children || []).forEach(walk);
  };
  return (/** @type {any} */ tree) => walk(tree);
}

export default defineConfig({
  site: 'https://realfin.dev',
  // Load pages in the background when a visitor hovers or taps a link, so navigation feels instant.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin/') && !page.endsWith('/search/') && !isEmptyCategory(page),
      serialize: (item) => (lastmod.has(item.url) ? { ...item, lastmod: lastmod.get(item.url) } : item),
    }),
  ],
  markdown: {
    rehypePlugins: [rehypeTableScope],
    // Code highlighting follows the site theme; both themes have readable (WCAG AA) comment colours.
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark-default' } },
  },
});
