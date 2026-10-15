import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const authors = defineCollection({
  loader: glob({ base: './src/content/authors', pattern: '**/*.json' }),
  schema: z.object({
    handle: z.string().optional(), // written by the CMS; the file name is the real id
    name: z.string(),
    bio: z.string(),
    avatar: z.string().optional().transform((v) => v || undefined), // path under /public; "" from the CMS = none
    role: z.enum(['editor', 'contributor']).default('contributor'),
    links: z
      .object({
        // The CMS saves untouched optional fields as "", so accept empty strings too.
        website: z.union([z.string().url(), z.literal('')]).optional(),
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
    category: z.enum(['homelab', 'game-servers', 'roblox', 'other']),
    tags: z.array(z.string()).default([]),
    author: reference('authors').default('realfin'),
    // Author's choice: show ads on this post or not. Off = the AdSense script isn't loaded on this page at all.
    ads: z.boolean().default(true),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, authors };
