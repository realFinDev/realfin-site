---
title: "New DNS record works everywhere except at home? Negative caching"
description: "I added www to my domain and it worked on mobile data but not on my home network for half an hour. My own resolver had cached the 'doesn't exist' answer. The one Unbound setting that fixes it."
pubDate: 2026-10-15T15:00:00
category: homelab
tags: [dns, unbound, adguard, cloudflare]
---

I connected `www` to this site's domain. On my phone over mobile data it worked within minutes. On my home network: "site can't be reached", for what would have been up to half an hour.

The record was fine. The problem was my own DNS server's memory.

## What negative caching is

DNS resolvers cache answers, including the answer **"this name doesn't exist"** (NXDOMAIN or an empty answer). That's called **negative caching**. Before I created the `www` record, something in my house had already asked for `www.<my-domain>`. My resolver, Unbound, got "doesn't exist" and remembered it.

How long it remembers comes from the **SOA record** of the domain. Ask your resolver and look at the `SOA` line:

```bash
dig www.example.dev
```
```
;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN
example.dev.   1800   IN   SOA   ns1.example.net. dns.example.net. ...
```

The number (`1800`) is the seconds left before the resolver asks again. Cloudflare-hosted zones allow negative caching for 30 minutes, and Unbound's own cap (`cache-max-negative-ttl`) defaults to **3600 s**. So a name you looked up "too early" can stay broken at home for up to half an hour, while the rest of the internet already sees it.

You can see a domain's negative-caching time without a terminal in the [DNS record checker](/tools/dns-checker/): look up a name that doesn't exist and it shows how long resolvers may remember that.

## The fix: cap negative caching

In `unbound.conf`, under `server:`:

```
server:
    # Forget "this name doesn't exist" after 60 s instead of up to an hour
    cache-max-negative-ttl: 60
```

Validate and restart:

```bash
docker exec unbound unbound-checkconf /opt/unbound/etc/unbound/unbound.conf
docker restart unbound
```

Test with a name that surely doesn't exist:

```bash
dig thisdoesnotexist-12345.example.dev | grep SOA
example.dev.   60   IN   SOA   ...
```

60 instead of 1800. Done: new records now work at home within a minute.

The cost: a few extra upstream queries for names that really don't exist. On a home network you won't notice.

## A gotcha with mounted config files

My `unbound.conf` is bind-mounted into the container as a **single file**. Some editors and `sed -i` don't edit a file in place. They write a new file and rename it over the old one, which gives it a new inode. A single-file bind mount keeps pointing at the **old** inode, so the container never sees the change. Either edit in place (nano does; vim may not, depending on its `backupcopy` setting), or recreate the container after editing:

```bash
docker compose up -d --force-recreate unbound
```

## Also flush the client

Your PC caches too. On Windows:

```bash
ipconfig /flushdns
```

AdGuard Home in front of Unbound caches answers as well, but it respects the TTL Unbound hands it, so the 60 s cap carries through.

## Related

The same resolver had a similar problem with *servers* it thought were down after an internet outage: [Unbound's infra cache](/blog/unbound-servfail-after-internet-outage/).
