# Editor guide: reviewing guest posts on realfin.dev

You're the editor. Guests can only *suggest* posts; nothing goes live until you merge it.

## How a guest post reaches you

1. A guest signs in at `realfin.dev/admin/` with their GitHub account.
2. Decap creates a fork of the repo in *their* account and saves their draft there.
3. When they click **Ready for review**, Decap opens a **pull request** (PR) to `realFinDev/realfin-site`.
4. GitHub runs the **"Check pull request"** workflow automatically:
   - ❌ fails if the PR touches anything except `src/content/blog/*.md`, `src/content/authors/*.json` or `public/images/posts/*`
   - ❌ fails if images are over 2 MB, or if the site doesn't build (broken front matter, unknown author…)
   - ⚠️ warns if a guest post claims to be written by `realfin`
5. You review it (below), then publish it.

You can review either in **GitHub** (Pull requests tab) or in the CMS at `/admin/` → **Workflow** tab (columns: Drafts → In review → Ready).

## Review checklist

Before merging, check every point:

- [ ] **The check is green.** Never merge a PR with a failed check, and never merge a guest PR that changes files outside the three allowed folders, even if you'd have to override something.
- [ ] **It's their own experience**, not a rewritten article. Paste a distinctive sentence or two into a search engine to catch copying.
- [ ] **Not mass-generated AI text.** Real details, real errors, real numbers. Vague "In today's digital world…" posts are a no.
- [ ] **No personal data**: IPs, hostnames, emails, real names, Steam/Discord IDs of other people, screenshots showing any of it.
- [ ] **AdSense-safe**: nothing sexual, violent, hateful, illegal, about cheats/cracks/piracy/exploits, and nothing like "click the ads".
- [ ] **Images**: theirs or properly licensed, cleaned of private info.
- [ ] **Links**: no spam, no paid links, no affiliate links of theirs.
- [ ] **Author profile**: a new profile has `role: contributor`, a sensible handle, and no impersonation.
- [ ] **Category and summary** make sense. Fix small things yourself before merging.
- [ ] **Ads switch**: leave whatever the author chose.

If it needs changes, comment on the PR (GitHub) and wait. If it's not suitable, close the PR with a short, polite reason.

## Publishing

- In GitHub: **Merge pull request** → Cloudflare builds and the post is live in ~1 minute.
- Then generate its social image and push it:
  ```bash
  cd ~/realfin-site && git pull && node scripts/make-og.mjs && git add public/og && git commit -m "OG image for new post" && git push
  ```
  (Optional. Without it, the post uses the default image.)

## Removing a post later

- A takedown request (copyright, personal data, illegal content) arrives at `hello@realfin.dev`. Act quickly: delete or edit the file, commit, push. Reply to the sender.
- An author asks to be removed: delete their posts and their `src/content/authors/<handle>.json`. Tell them that old versions may still exist in the public git history.
- Unpublish without deleting: set `draft: true` in the post's front matter.

## Abuse

- Spam PRs: close them. Repeat offenders: block the user (GitHub → their profile → Block or report).
- If guests start sending low-quality posts in bulk, pause guest writing by removing the "Write for us" link from the footer and `/write/` from the homepage. The editor keeps working for you.

## Things to set up once (GitHub)

1. **Protect `main`**: Settings → Branches → Add branch ruleset (or "Add rule") → target `main` →
   - Require a pull request before merging
   - Require status checks to pass → add **check**
   - Block force pushes
   (Pushing your own changes then also goes through a PR. That's the safe default, but you can add yourself to the bypass list if it's too slow.)
2. **Actions for fork PRs**: Settings → Actions → General → "Fork pull request workflows from outside collaborators" → **Require approval for first-time contributors**. You approve a stranger's first run with one click.
3. **Comments (optional)**: enable Discussions (Settings → General → Features), install the giscus app (https://github.com/apps/giscus) on this repo only, then fill in `GISCUS` in `src/consts.ts` with the values from https://giscus.app.
