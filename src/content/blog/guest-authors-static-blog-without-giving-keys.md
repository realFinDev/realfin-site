---
title: "Letting strangers write on my blog without giving them the keys"
description: "Guest posts on a static site: GitHub login via Decap CMS open authoring, every submission as a pull request, an automatic check that blocks anything outside the posts folder, and why I didn't build my own login system."
pubDate: 2026-10-15T18:00:00
category: homelab
tags: [security, static-site, decap-cms, github, cloudflare]
draft: true
---

I wanted RealFin to have more voices than mine: people writing up their own homelab, game server and dev experiences. That raises an obvious question for a site with ads on it: **how do you let strangers write without letting them break, deface or hijack the site?**

Here's the setup, and the threats it's built around.

## The threat model

What a malicious "guest author" could try, if given too much access:

- **Swap the AdSense publisher ID or `ads.txt`** for their own and quietly collect the ad revenue. This is a real scam.
- Add a script to every page (crypto miners, redirects, credential phishing).
- Edit or delete other people's posts, or impersonate the editor.
- Publish something that gets the whole site banned from AdSense.

And what I didn't want to build: **my own login and registration system**. A database of strangers' passwords and emails is the most attacked part of any website, and it comes with GDPR obligations. A static site has none of that, and I wanted to keep it that way.

## Guests never get write access

The editor is [Decap CMS](https://decapcms.org) in **open authoring** mode:

1. A guest opens `/admin/` and signs in with **their own GitHub account**.
2. Decap creates a **fork** of the site's repository in *their* account and saves drafts there.
3. Submitting the post opens a **pull request**: a suggestion I can accept or reject.

They never have write access to my repository. They can't merge anything. The worst they can do is send me a bad suggestion.

[![A guest signs in with GitHub, drafts are saved in their own fork, the post is submitted as a pull request, an automatic check blocks anything outside posts and images, and the editor reviews and merges it](/images/posts/guest-post-flow.svg)](/images/posts/guest-post-flow.svg)

The GitHub login runs as two tiny Cloudflare Pages Functions (no server of mine involved). They're CSRF-protected with a one-time `state` cookie, cap the requested permissions to `public_repo` (never access to a guest's private repos), and only hand the token back to my own site's origin.

## An automatic check on every submission

A GitHub Actions workflow runs on every pull request. For PRs from forks, it uses the safe `pull_request` trigger: read-only token, no secrets. It enforces:

```bash
changed=$(git diff --name-only "$base"...HEAD)
bad=$(echo "$changed" | grep -vE '^(src/content/blog/[a-z0-9-]+\.md|src/content/authors/[a-z0-9-]+\.json|public/images/posts/[^/]+\.(png|jpe?g|webp|gif))$')
[ -n "$bad" ] && { echo "::error::Guests may only change posts, author profiles and post images"; exit 1; }
```

So a guest PR fails immediately if it touches **anything** except a post, an author profile or a post image: no `ads.txt`, no publisher ID, no headers, no login code, no CMS config. The check also blocks guests from editing my profile or giving themselves the "editor" role, rejects images over 2 MB, and makes sure the whole site still builds, so a broken post can't take it down.

## Then a human reads it

The automated check is a guardrail, not a reviewer. Before merging, I check that it's genuinely first-hand experience, not copied or mass-generated, that it doesn't contain anyone's personal data, and that it's within AdSense's content rules. AdSense bans the *site*, not the author, so the editor has to be the last line of defence.

## The author's choice: ads or no ads

Every post has a "Show ads on this post" switch, chosen by the author. With it off, that page doesn't load the ad script at all. Revenue sharing would be a much bigger topic (payouts, tax, and ad-fraud incentives that put the whole account at risk), so for now there isn't any, and the site says so openly.

## What it costs

Nothing beyond the domain. Decap is open source, Cloudflare Pages Functions and GitHub Actions are free at this scale, and contributors only need a free GitHub account.

Want to write something? See [Write for RealFin](/write/).
