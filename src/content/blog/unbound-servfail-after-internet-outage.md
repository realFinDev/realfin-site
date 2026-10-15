---
title: "After every internet outage, some sites broke for 15 minutes. Blame Unbound's infra cache"
description: "Unbound marks unreachable nameservers as down for 900 seconds by default and serves instant SERVFAILs. CDN-heavy sites suffer most. Three settings fixed it."
pubDate: 2026-10-15T10:40:00
category: homelab
tags: [dns, unbound, adguard, troubleshooting]
---

Every time my internet connection dropped and came back, *most* things worked again right away, but some didn't. The Roblox installer was the clearest example: it showed a "Critical Error" for about a quarter of an hour, then worked again on its own. Restarting the DNS container fixed it instantly, which pointed straight at DNS.

## The setup

All DNS in my house goes through **AdGuard Home** for ad blocking, which forwards to **Unbound**, my own recursive resolver ([setup here](/blog/adguard-unbound-network-adblock/)). There are no public DNS servers in the chain, by choice.

## What the logs showed

AdGuard's query log during one of these windows showed the failing domains getting **SERVFAIL** back from Unbound **in 0 ms**. An instant failure means Unbound wasn't even trying. It was answering from memory that these servers were down.

## Why: the infrastructure cache

Unbound keeps an "infra cache" of how each upstream **nameserver** behaves: round-trip time, and whether it's reachable. When the internet drops, every nameserver Unbound tries times out, so it marks them as unreachable. The default `infra-host-ttl` is **900 seconds**, so for 15 minutes after the connection comes back, Unbound still believes those servers are down and fails immediately.

CDN domains are hit hardest because they resolve through long CNAME chains (`rbxcdn` → `edgesuite` → `akamai`…). Every hop has its own set of nameservers, and if *any* of them is marked down, the whole lookup fails.

Why didn't AdGuard's fallback DNS help? Because SERVFAIL **is** an answer. Fallbacks only kick in when the upstream doesn't respond at all.

## The fix

Three lines in `unbound.conf`, under `server:`:

```
server:
    # Forget "this nameserver is down" after 60 s instead of 900 s
    infra-host-ttl: 60
    # Keep probing servers marked as down so they recover quickly
    infra-keep-probing: yes
    # If a fresh answer is slow, serve the expired cached answer
    serve-expired-client-timeout: 1800
```

`serve-expired-client-timeout` only matters if `serve-expired: yes` is also set, which my config already had. It means a hiccup returns the last known good answer instead of an error.

## Make the config survive updates

My Unbound image originally kept its config *inside* the container, so any edit would vanish on the next image update. I mounted it from the host instead:

```yaml
services:
  unbound:
    image: mvance/unbound:latest
    volumes:
      - ./unbound/unbound.conf:/opt/unbound/etc/unbound/unbound.conf:ro
```

Check the file before restarting. Run the check **inside the running container**, because a bare `docker run` of the image lacks a directory the entrypoint creates:

```bash
docker exec unbound unbound-checkconf /opt/unbound/etc/unbound/unbound.conf
docker restart unbound
```

## What I didn't do

The quick hack would be an AdGuard rule sending those domains to 1.1.1.1. I tried it and removed it again. I want all DNS on my own resolver, and the root cause was fixable. **Never** "fix" a CDN with a DNS *rewrite* to a fixed IP, either. CDN addresses change all the time.

Since the change, outages recover within a minute.
