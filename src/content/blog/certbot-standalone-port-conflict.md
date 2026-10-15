---
title: "Certbot renewal failing every 12 hours: 'bind() to 0.0.0.0:80 failed'"
description: "An old certbot setup kept failing because AdGuard and Nginx Proxy Manager own ports 80 and 443. Why standalone renewals break on a busy server, and the DNS-challenge alternative."
pubDate: 2026-10-15T12:30:00
category: homelab
tags: [certbot, letsencrypt, nginx-proxy-manager, adguard, troubleshooting]
---

A health check of my server turned up a failed systemd unit:

```
$ systemctl --failed
● certbot.service  loaded failed failed  Certbot
```

The journal explained it:

```
nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Unknown error)
nginx: [emerg] bind() to 0.0.0.0:443 failed (98: Unknown error)
All renewals failed. The following certificates could not be renewed:
  /etc/letsencrypt/live/<old-duckdns-name>/fullchain.pem (failure)
```

## What was going on

Years ago I'd set up a free DuckDNS name with a Let's Encrypt certificate. Certbot was configured to renew it with its **nginx/standalone** method: to prove I own the name, it briefly starts its own web server on **port 80 (and 443)** so Let's Encrypt can fetch a challenge file.

Since then, those ports had been taken:

- **Port 80** belongs to **AdGuard Home's** web UI
- **Port 443** belongs to **Nginx Proxy Manager**

Only one program can listen on a port. So every 12 hours certbot's timer fired, tried to bind, failed, and left `certbot.service` in a failed state. Nobody noticed, because I wasn't using that domain anymore.

## If you don't need it anymore: switch it off properly

```bash
sudo systemctl disable --now certbot.timer
sudo systemctl reset-failed certbot.service
```

If there's also a certbot *container* doing renewals in a loop, stop that stack too (`docker compose down` in its folder).

One thing I noticed: right as I disabled the timer, one last queued run started and failed a few minutes later, so I had to run `reset-failed` a second time. Check `systemctl --failed` once more afterwards.

## If you do need the certificate: don't fight for port 80

Two better options than standalone mode on a busy server:

1. **Let your reverse proxy handle it.** Nginx Proxy Manager can request and renew Let's Encrypt certificates itself, because it already owns 80/443.
2. **Use a DNS challenge.** Instead of serving a file on port 80, you prove ownership by creating a DNS TXT record. No ports are needed at all, and it works for wildcard certificates. NPM supports DNS challenges for many providers (DuckDNS and Cloudflare included). With certbot directly, use a DNS plugin such as `certbot-dns-cloudflare`.

For a homelab where 80 and 443 are already spoken for, the DNS challenge is the cleanest answer.

## The bigger lesson

This failure had been happening quietly for a long time. A failed systemd unit doesn't email anyone by default. `systemctl --failed` is now part of my regular checks, alongside Docker restart counts: [the Zigbee bridge that restarted 22,112 times](/blog/zigbee2mqtt-restart-loop-docker-network/) taught me that one.
