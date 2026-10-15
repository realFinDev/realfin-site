---
title: "Free email on your own domain with Cloudflare Email Routing (receive-only)"
description: "hello@yourdomain forwarding to your normal inbox in five minutes: the DNS records it adds, verifying the destination, and the one privacy catch when you reply."
pubDate: 2026-10-15T15:30:00
category: homelab
tags: [cloudflare, email, dns, privacy]
---

A website needs a contact address, and `yourname@gmail.com` on a public page isn't great for privacy. Cloudflare Email Routing gives you addresses on your own domain, like `hello@realfin.dev`, that **forward** to your existing inbox for free.

Self-hosting a real mail server at home is a different story. Residential IPs land in spam folders, and keeping a mail server secure is a job of its own. Forwarding gets you 90% of the value for 0% of that.

## What it is (and isn't)

- ✅ **Receive** mail at any address on your domain, forwarded to one or more inboxes
- ✅ Catch-all (anything@yourdomain), or only specific addresses
- ❌ It doesn't **send** mail. Replies go out from your normal address (see the catch below).

## Setup

1. Cloudflare dashboard → your domain → **Email → Email Routing → Get started**.
2. Cloudflare shows the DNS records it will add. Click **Add records and enable**:
   - **3 × MX** records (`route1/2/3.mx.cloudflare.net`) that send mail for your domain to Cloudflare
   - **TXT `cf2024-1._domainkey`**, a DKIM key, so forwarded mail is signed and doesn't land in spam
   - **TXT SPF** (`v=spf1 include:_spf.mx.cloudflare.net ~all`)
3. **Destination addresses → Add**: your real inbox. Cloudflare sends a verification link, and forwarding stays inactive until you click it.
4. **Routing rules → Create address**: e.g. `hello` → send to your verified inbox.

The dashboard briefly shows "Routing status: Syncing" and "DNS records: Locked". Both are normal. The lock just stops you from deleting the mail records by accident.

You can check that the records are live from any terminal:

```bash
dig +short MX yourdomain.dev
dig +short TXT yourdomain.dev
```

Then send a test mail to the new address from a different account.

## The privacy catch: replying

Forwarding is one-way. When you hit **reply** in Gmail, the other person sees your **real Gmail address**. If you're keeping a pseudonymous project separate from your personal identity, that leaks it.

Options:

- Create a **separate inbox** for the project (a new free account) and forward there.
- Set up "Send mail as" with an outgoing mail service so replies come from `hello@yourdomain`. That's more work, but it's the clean solution.

## Add DMARC while you're there

Cloudflare's DNS page will suggest a **DMARC** record ("Block fake emails sent from @yourdomain"). If you never send mail *from* the domain, a strict policy tells receivers to reject anything claiming to be from it:

```
_dmarc.yourdomain.dev   TXT   "v=DMARC1; p=reject;"
```

That stops spammers from using your domain in their From: line. If you later send mail from the domain, loosen it to `p=none` first and add reporting.
