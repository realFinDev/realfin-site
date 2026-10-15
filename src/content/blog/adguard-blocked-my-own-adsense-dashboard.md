---
title: "My network ad blocker broke my own AdSense dashboard"
description: "Every button in Google AdSense did nothing. The cause was my AdGuard Home blocking Google's ad domains house-wide. How to confirm it, and how to unblock AdSense for just one PC."
pubDate: 2026-10-15T14:00:00
category: homelab
tags: [adguard, dns, adsense, ad-blocking]
---

When I set up AdSense for this site, the dashboard loaded, but **none of the buttons worked**. "Let's go", "Explore", the site picker: click, nothing. No error, no spinner.

The cause was sitting under my desk: **AdGuard Home**, which blocks ads for every device in my house ([my setup](/blog/adguard-unbound-network-adblock/)). The AdSense dashboard itself is on an unblocked domain, but the scripts behind its buttons come from the same domains that serve ads. My blocker was doing its job a little too well.

## Confirming it in 30 seconds

Ask your home DNS and a public DNS server for the same names, and compare:

```bash
for d in pagead2.googlesyndication.com tpc.googlesyndication.com adservice.google.com \
         fundingchoicesmessages.google.com adsense.google.com; do
  printf '%-36s home: %-16s public: %s\n' "$d" \
    "$(dig +short $d | head -1)" "$(dig +short $d @1.1.1.1 | head -1)"
done
```

My result:

| Domain | At home | Public DNS |
|---|---|---|
| `pagead2.googlesyndication.com` | `0.0.0.0` (blocked) | real IP |
| `tpc.googlesyndication.com` | `0.0.0.0` (blocked) | real IP |
| `adservice.google.com` | `0.0.0.0` (blocked) | real IP |
| `fundingchoicesmessages.google.com` | `0.0.0.0` (blocked) | real IP |
| `adsense.google.com` | real IP | real IP |

`0.0.0.0` is how AdGuard says "blocked". The dashboard loads from `adsense.google.com`, but needs the others to work, and `fundingchoicesmessages` is Google's consent-banner service, so the EU consent setup breaks too.

You can see the same in AdGuard's **Query log**: filter by your PC's IP and look for red "Blocked" entries while you click around.

## Option 1: pause protection for a few minutes

AdGuard's dashboard has **Disable protection** with a timer. Pause for 10 minutes, run `ipconfig /flushdns` on Windows, reload AdSense, do what you need, and protection comes back on its own. Good for a one-off.

## Option 2: unblock only for your own PC

AdGuard's custom filtering rules support a `$client` modifier, so an allow rule can apply to **one device only**. Under **Filters → Custom filtering rules**:

```
@@||googlesyndication.com^$client='192.168.1.50'
@@||doubleclick.net^$client='192.168.1.50'
@@||adservice.google.com^$client='192.168.1.50'
@@||googleadservices.com^$client='192.168.1.50'
@@||fundingchoicesmessages.google.com^$client='192.168.1.50'
```

Replace the IP with your PC's address (give it a DHCP reservation so it doesn't change). `@@` means "allow", and `||domain^` covers the domain and all its subdomains. The rest of the house stays ad-free.

The side effect: that PC now sees ads on other websites too. If you only need AdSense now and then, option 1 is less annoying.

## Also check the browser

A browser extension like uBlock Origin causes exactly the same symptoms. Allow `adsense.google.com` there as well, or the network fix won't seem to work.

## One upside

With the blocker active, I never see the ads on my own site. That's actually fine: you're **never** supposed to click your own ads anyway. Google treats it as invalid traffic and can close the account over it.
