---
title: "Applying for Google AdSense with a brand-new static site: what actually happened"
description: "Owning the domain, the code snippet vs ads.txt, verification that failed for reasons that had nothing to do with my site, the EU consent message, and the rules that get accounts banned."
pubDate: 2026-10-15T16:30:00
category: homelab
tags: [adsense, monetization, static-site, cloudflare]
---

I put Google AdSense on this blog the day it went live. Approval takes weeks, so I'll update this post when I hear back. The setup itself had a few surprises worth writing down.

## 1. You need your own domain

AdSense won't approve a site on a free subdomain like `something.pages.dev`, `*.github.io` or a Firebase `web.app` address. You have to own the domain, because you need to put an `ads.txt` file at its root. I bought mine at cost from Cloudflare (~$12/year), and it's the only thing this site costs. [How the site is built](/blog/building-this-blog-astro-cloudflare-pages/).

## 2. Payments and identity come first

AdSense asks for your legal name, address and payment details before anything else. That's private between you and Google and isn't shown on your site. You need to be **18 or older** to hold the account yourself.

## 3. Phone verification: "We couldn't send a verification code to this number"

My first attempts failed with that error, using a perfectly valid number. What helped:

- Switch from **SMS to "Voice call"**. Google calls and reads the code out. It's free to receive.
- After a few failed attempts, Google rate-limits the number. Waiting a while is sometimes the only fix.
- Check that your phone isn't blocking messages from unknown or short-code senders.

## 4. The code snippet and ads.txt

AdSense offers three ways to verify the site: the **code snippet**, **ads.txt** or a **meta tag**. Use the code snippet, since it's the script that shows ads anyway. I put my publisher ID in exactly one config value, and the site generates both from it:

- the `<script async src="…adsbygoogle.js?client=ca-pub-…">` tag in every page's `<head>`
- `/ads.txt` containing `google.com, pub-…, DIRECT, f08c47fec0942fa0`

That way the two can never disagree. I also made it per-post: posts can switch ads off, and then the script isn't loaded on that page at all.

## 5. The dashboard buttons didn't work, and it wasn't Google's fault

Every button in the AdSense setup did nothing. My **network-wide ad blocker** was blocking the domains the dashboard's scripts come from. [Details and the fix](/blog/adguard-blocked-my-own-adsense-dashboard/). If your AdSense UI is broken, check your ad blocker first.

## 6. The EU consent message

If you have visitors from the EU, UK or Switzerland, Google requires a certified consent banner before personalised ads. AdSense has one built in: **Privacy & messaging → European regulations → Create message**. Google hosts it, so you don't add any code. Your privacy policy should mention it, along with how ads use cookies and how to opt out.

## 7. Request review, then wait (and keep writing)

After verification: **Request review**. It can take days to weeks. New sites are often rejected at first for "low-value content". The fix is more original, useful posts, then asking again. There's no penalty for reapplying.

What I'm doing while waiting: writing posts from things I actually did, like the ones on this site, rather than generic "top 10" lists.

## Rules that get accounts banned

These are the ones I'm careful about:

- **Never click your own ads** and never ask anyone to. Google detects it and keeps the money.
- **No rewards for viewing or clicking ads.** "Watch ads to earn points" schemes are explicitly forbidden on AdSense sites.
- **Nothing that encourages clicks**, like "support me by clicking the ads".
- You're responsible for **all content on the site**, including guest posts. That's why every guest post here is reviewed before it goes live.

I'll update this post with how the review goes.
