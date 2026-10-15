// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

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
  integrations: [sitemap({ filter: (page) => !page.includes('/admin/') })],
  markdown: { rehypePlugins: [rehypeTableScope] },
});
