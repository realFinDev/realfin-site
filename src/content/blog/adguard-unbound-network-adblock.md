---
title: "Ad blocking for the whole house with AdGuard Home + Unbound in Docker"
description: "Network-wide ad and tracker blocking plus your own recursive DNS resolver, with no Google or Cloudflare DNS. Compose file, router setup and the gotchas."
pubDate: 2026-10-15T10:20:00
category: homelab
tags: [dns, adguard, unbound, docker, privacy]
---

Every device in my house, including phones, the TV and game consoles, gets ads and trackers blocked without installing anything on it. That's **AdGuard Home** doing DNS filtering. Behind it, **Unbound** resolves names by talking directly to the internet's root and authoritative servers, so no single DNS company sees every site we visit.

## How it fits together

```
device → AdGuard Home (filters ads) → Unbound (recursive resolver) → root / TLD / authoritative servers
```

- **AdGuard Home**: blocklists, a query log, per-client stats and DNS rewrites for local names.
- **Unbound**: looks up each domain step by step itself and caches the answers.

## Compose file

```yaml
services:
  adguardhome:
    image: adguard/adguardhome:latest
    container_name: adguardhome
    restart: unless-stopped
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "3000:3000/tcp"   # first-run setup / admin UI
      - "80:80/tcp"       # admin UI after setup
    volumes:
      - ./adguard/work:/opt/adguardhome/work
      - ./adguard/conf:/opt/adguardhome/conf
    networks: [dns_net]

  unbound:
    image: mvance/unbound:latest
    container_name: unbound
    restart: unless-stopped
    volumes:
      - ./unbound/unbound.conf:/opt/unbound/etc/unbound/unbound.conf:ro
    networks:
      dns_net:
        ipv4_address: 172.28.0.2

networks:
  dns_net:
    ipam:
      config:
        - subnet: 172.28.0.0/24
```

Unbound gets a fixed internal IP, so AdGuard can point at it. In AdGuard's **Settings → DNS settings → Upstream DNS servers** put:

```
172.28.0.2:53
```

Unbound isn't published on the host at all, so only AdGuard can reach it.

## Point your network at it

In the router's DHCP settings, set the **DNS server** handed out to clients to your server's LAN IP. Devices pick it up on their next DHCP renewal (reconnect Wi-Fi to speed it up). Don't add a public DNS as "secondary": many devices use both at random, and ads slip through.

## Gotchas I hit

1. **Port 53 already in use on Ubuntu.** `systemd-resolved` listens on 53. Either disable its stub listener (`DNSStubListener=no` in `/etc/systemd/resolved.conf`) or publish AdGuard only on the LAN IP.
2. **Blocklists break things.** Some lists block domains that apps need, such as torrent indexers or certain login pages. When something fails with a vague network error, check AdGuard's query log first, and allowlist the domain if it was blocked.
3. **Outages and stale failures.** After an internet drop, Unbound can keep failing some domains for 15 minutes by default. [Fix here](/blog/unbound-servfail-after-internet-outage/).
4. **If DNS is down, the house is "offline".** Everything depends on this one container. Keep `restart: unless-stopped`, and know how to bring it back. I once [left it down for two days](/blog/docker-stop-before-reboot-mistake/).

## Bonus: local names

AdGuard's **DNS rewrites** can map a wildcard like `*.lan-name` to your server's IP. Combined with a reverse proxy (I use Nginx Proxy Manager), every service gets a readable HTTPS address on the LAN, and no new DNS entry is needed per service.

To compare what your home DNS answers with what the rest of the internet sees, the [DNS record checker](/tools/dns-checker/) shows Cloudflare's and Google's answers side by side.

## Is it worth it?

Yes, it's the single most noticeable thing in my homelab. Pages load faster, smart TVs stop phoning home every few seconds, and the query log shows exactly what every device is doing.
