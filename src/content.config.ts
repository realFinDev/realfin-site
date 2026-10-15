import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const authors = defineCollection({
  loader: glob({ base: './src/content/authors', pattern: '**/*.json' }),
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    avatar: z.string().optional(), // path under /public, e.g. /images/authors/realfin.svg
    role: z.enum(['editor', 'contributor']).default('contributor'),
    links: z
      .object({
        website: z.string().url().optional(),
        github: z.string().optional(), // GitHub username only
      })
      .default({}),
    joined: z.coerce.date(),
  }),
});

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['homelab', 'game-servers', 'roblox']),
    tags: z.array(z.string()).default([]),
    author: reference('authors').default('realfin'),
    // Author's choice: show ads on this post or not. Off = the AdSense script isn't loaded on this page at all.
    ads: z.boolean().default(true),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, authors };
