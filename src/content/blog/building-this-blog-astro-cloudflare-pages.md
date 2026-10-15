---
title: "How this blog is built: Astro + Cloudflare Pages for the price of a domain"
description: "A static site with search, tools, guest authors and ads, costing about €12 a year, with nothing exposed on my home server. The stack, the costs and the security decisions behind it."
pubDate: 2026-10-15T17:00:00
category: homelab
tags: [astro, cloudflare, static-site, security, self-hosting]
---

I run a homelab, so the obvious move would have been to host this blog on it. I didn't. Here's what I built instead, and why.

## The decision: don't host it at home

A public website on a home server means a port forward on the router (or a tunnel), your home IP tied to your name, and one more thing an attacker can poke at, sitting on the same machine as your password manager. [I don't port-forward anything](/blog/homelab-security-no-port-forwards/), and I wasn't going to start for a blog.

A **static site** removes almost all of that risk. There's no login, no database and no PHP, just files. Hosted on a CDN, my server isn't involved at all.

## The stack

| Part | Choice | Cost |
|---|---|---|
| Site generator | [Astro](https://astro.build): Markdown posts in, plain HTML out | free |
| Hosting | **Cloudflare Pages**: builds on every `git push`, global CDN, HTTPS | free |
| Domain | `.dev` from Cloudflare Registrar, sold at cost | ~$12/year |
| Email | Cloudflare **Email Routing**: `hello@` forwards to my inbox | free |
| Search | [Pagefind](https://pagefind.app): a search index built at build time | free |
| Comments | Giscus (GitHub Discussions), optional | free |
| Ads | Google AdSense | pays *me*, in theory |

Total: the domain. Everything else is a free tier I'm nowhere near the limits of.

## Why not GitHub Pages or Vercel?

Both are great, but their free tiers aren't meant for commercial sites. Vercel's Hobby plan is non-commercial only, and GitHub Pages isn't intended for running ads. Cloudflare Pages has no such rule. And since the domain and DNS were already at Cloudflare, connecting it took one click.

A note for anyone wanting ads: **AdSense won't approve a site on a free subdomain** like `*.pages.dev`. You have to own the domain to place `ads.txt` at its root. That alone justifies the €12.

## How a post goes live

```
write Markdown → git push → Cloudflare builds (npm run build) → live in ~1 minute
```

The build runs `astro build && pagefind --site dist`. Astro turns posts into HTML, generates the sitemap and RSS feed, and Pagefind indexes the post text for search. A separate `dev` branch gets its own preview URL, which Cloudflare automatically marks `noindex`, so I can test changes without Google seeing them.

## Security decisions that cost nothing

- **Security headers** via a `_headers` file Cloudflare Pages reads: `X-Frame-Options: DENY`, `nosniff`, HSTS, a strict `Permissions-Policy`, and a CSP that blocks framing and plugins. I deliberately didn't restrict scripts, because AdSense needs them.
- **WHOIS privacy**: my name and address are redacted from public domain records. I checked with ICANN's lookup tool after buying.
- **A least-privilege API token** for automation: [one domain, five permissions, locked to my IP, expiring](/blog/cloudflare-api-token-least-privilege/).
- **No secrets in the repo.** The repo is public, which is fine because it contains only what visitors see anyway.
- **Commits under a GitHub no-reply address**, so my personal email isn't in the public git history.

## Ads without ruining the site

The AdSense script is only loaded on pages that allow ads. Each post has an `ads: true/false` switch, and with it off, no ad script loads at all. `ads.txt` is generated from the same publisher ID, so the two can't drift apart.

## What I'd do differently

- **Buy the domain first.** I briefly considered staying on the free `pages.dev` address, and that would have been a dead end for ads.
- **Write the privacy policy early.** Ads, comments and guest authors each add something to disclose, and it's easier to grow a policy than to retrofit one.
- **Keep a `dev` branch from day one.** Testing on the live site works until it doesn't.

The whole thing took an afternoon to set up. Now the hard part is the same as for every blog: writing.
