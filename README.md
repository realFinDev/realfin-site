# realfin.dev

Source for [realfin.dev](https://realfin.dev): homelab, game servers and Roblox dev notes, written from a real server.

Static site built with [Astro](https://astro.build), hosted on Cloudflare Pages. Every push to `main` goes live in about a minute; `dev` builds to the staging site [dev.realfin.dev](https://dev.realfin.dev) (noindex, no ads).

## Everyday tasks

| I want to… | Do this |
|---|---|
| Write a post | Add `src/content/blog/<slug>.md` (copy an existing post's front matter), then `node scripts/make-og.mjs` for its preview image |
| Hide a post | `draft: true` in its front matter |
| Turn ads off for one post | `ads: false` in its front matter |
| Add a post to a series | Add its slug to `SERIES` in `src/consts.ts` |
| Add a short link `go.realfin.dev/x` | Add a line to `public/_redirects` |
| Add a tool | Page in `src/pages/tools/`, logic in `public/tools/`, entry in `src/tools.ts`, then `node scripts/make-og.mjs` |
| Open guest writing | Set up the GitHub OAuth app (see `docs/EDITOR-GUIDE.md`), then `GUEST_AUTHORING = true` in `src/consts.ts` |
| Review a guest post | `docs/EDITOR-GUIDE.md` |

```bash
npm install
npm run dev      # local dev server
npm run build    # static output in dist/ (+ search index)
```

## Where things are

```
src/content/blog/       posts (Markdown)
src/content/authors/    author profiles (JSON)
src/pages/              pages: home, blog, tools, authors, write, privacy, …
src/consts.ts           switches: ADSENSE_CLIENT, GUEST_AUTHORING, GISCUS, SERIES, IS_PRODUCTION
src/tools.ts            list of tools (homepage + /tools/)
public/_headers         security headers
public/_redirects       short links (/go/*)
public/admin/           guest editor (Decap CMS)
functions/api/          GitHub login for the editor (Cloudflare Pages Functions)
scripts/make-og.mjs     generates social preview images into public/og/
.github/workflows/      PR safety check, weekly link check
docs/EDITOR-GUIDE.md    reviewing guest posts
```

## Safety rules for content

No IP addresses, hostnames, internal domain names, usernames, keys or tokens, and nothing that identifies the author's location. Guest pull requests may only change posts, author profiles and post images; the PR check enforces this.
