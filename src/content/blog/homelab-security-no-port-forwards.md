---
title: "My homelab has zero open ports. Here's how I still use it from anywhere"
description: "Why I don't port-forward anything, how Tailscale replaces it, how to publish a website safely with Cloudflare Tunnel, and the hardening checklist I actually follow."
pubDate: 2026-10-15T09:00:00
category: homelab
tags: [security, tailscale, cloudflare, docker, ufw]
---

The fastest way to get a self-hosted service onto the internet is a port forward on your router. It's also the fastest way to get hacked. Within minutes of opening a port, bots start scanning it, and they don't care that it's "just a home server".

My rule: **nothing on my server is reachable from the internet.** I still use everything from my phone, anywhere.

## Why port forwards are risky

- **Your home IP becomes a target.** Scanners hit every public IP constantly, looking for known login pages and vulnerable versions.
- **Admin panels aren't built for the internet.** Portainer (full control of Docker = root on the host), the proxy's admin UI, AdGuard's admin, qBittorrent… One weak password or unpatched bug and someone is inside your network.
- **Docker ignores your firewall.** This one surprises people: ports published with `ports:` in Compose are opened through Docker's own iptables rules, which **bypass ufw**. "I have a firewall" doesn't protect a published container port.

## Remote access: Tailscale

[Tailscale](https://tailscale.com) builds a private, encrypted network between your own devices. Install it on the server and on your phone, log in with the same account, and the phone can reach the server as if it were at home, with **no ports opened** on the router. Connections go *out* from both devices, so nothing listens on your public IP.

For a homelab that's 90 % of what people use port forwards for, solved.

## Publishing something on purpose: Cloudflare Tunnel

If you want a *public* website (like this one), there's a safer pattern than a port forward: a **Cloudflare Tunnel**. A small `cloudflared` container makes an outgoing connection to Cloudflare, and visitors reach your site through Cloudflare:

- no port forward, and your home IP stays hidden
- Cloudflare filters attacks before they reach you
- you choose *exactly one* service to expose; everything else stays private

Even simpler: host a static site on **Cloudflare Pages** and keep it off your server entirely. That's what this site does.

## The hardening checklist I actually follow

Things I've done on my own server, roughly in order of how much they matter:

1. **No port forwards.** Check your router's port-forwarding page today, and remove anything you don't recognise.
2. **Bind sensitive services to localhost.** My local AI's API has no authentication, so it's published as `127.0.0.1:11434:11434`, not `11434:11434`. Containers on the same Docker network still reach it.
3. **Close sign-ups.** Self-hosted Vaultwarden allows anyone to register by default. Set `SIGNUPS_ALLOWED=false` once your accounts exist.
4. **Hash admin tokens.** Vaultwarden's admin token can be stored as an Argon2 hash instead of plain text (`docker exec -it vaultwarden /vaultwarden hash`).
5. **Change default passwords.** qBittorrent famously shipped with `admin` / `adminadmin`. Every admin UI gets a unique password stored in a password manager.
6. **SSH with keys only**, no root login.
7. **Check what you actually publish.** Paste your compose files into the [Docker Compose port checker](/tools/compose-port-checker/): it lists every published port, flags services open to the whole network and spots conflicts.
8. **Host firewall (ufw)**: default deny inbound, allow your LAN and the Tailscale interface. Remember from above: it doesn't cover Docker-published ports, so bind those carefully.
9. **Keep updating.** Ubuntu security updates install automatically. Containers get `docker compose pull && docker compose up -d` regularly.
10. **Backups**, because security also means recovering from your own mistakes. [My backup script](/blog/homelab-backup-script-docker/).

## What I write about publicly

I'm happy to explain *how* my homelab works. I never publish IP addresses, hostnames, exact port layouts, usernames or screenshots of admin panels. That's the map an attacker would want. If you blog about your setup, do the same.
