---
title: "Hosting a Valheim dedicated server with Docker (the setup I use)"
description: "A complete docker-compose for a Valheim server: ports, auto-updates only when nobody's online, hourly world backups, and how friends connect."
pubDate: 2026-10-15T08:20:00
category: game-servers
tags: [valheim, docker, game-server]
---

My friends and I play Valheim on a dedicated server running on my homelab, so the world is always there, even when the person who "hosted" isn't online. Here's the exact setup, using the excellent [`lloesche/valheim-server`](https://github.com/lloesche/valheim-server-docker) image.

## What you need

- A Linux box with Docker. Valheim is light: my server uses **~1.4 GB of RAM and ~16 % of one CPU core** with four players.
- **UDP ports 2456–2457**.
- Upload bandwidth: roughly 0.5–1 Mbit/s per player.

## docker-compose.yml

```yaml
services:
  valheim:
    image: lloesche/valheim-server
    container_name: valheim
    cap_add:
      - sys_nice
    ports:
      - "2456-2457:2456-2457/udp"
    volumes:
      - ./config:/config        # worlds, backups, admin/ban/permit lists
      - ./data:/opt/valheim     # server files (re-downloadable)
    environment:
      - TZ=Europe/Berlin   # your own time zone
      - SERVER_NAME=My Valheim Server
      - WORLD_NAME=Dedicated
      - SERVER_PASS=${SERVER_PASS}
      - SERVER_PUBLIC=false
      # only update when nobody is online
      - UPDATE_IF_IDLE=true
      # built-in world backups: hourly, keep 3 days
      - BACKUPS=true
      - BACKUPS_CRON=0 * * * *
      - BACKUPS_MAX_AGE=3
    stop_grace_period: 2m
    restart: unless-stopped
```

Put the password in a `.env` file next to it (`SERVER_PASS=...`, at least 5 characters, and it must not contain the server name). Then:

```bash
docker compose up -d
docker logs -f valheim
```

The first start downloads the server (~1 GB) from Steam. When the log says **`Game server connected`**, it's ready.

## Settings worth explaining

- **`SERVER_PUBLIC=false`**: the server doesn't appear in the in-game community list. Friends join by address. Less random traffic.
- **`UPDATE_IF_IDLE=true`**: Valheim updates often, and a client/server version mismatch means nobody can join. This updates automatically, but never kicks people mid-session.
- **`stop_grace_period: 2m`**: on `docker compose stop` the server **saves the world** before exiting. Docker's default 10 seconds can cut that short.
- **Backups**: zip files land in `./config/backups`. The world itself lives in `./config/worlds_local`.

## How friends connect

In Valheim: **Start Game → Join Game → Add server**, then enter `your-address:2456` and the password.

- Same house: use the server's LAN IP.
- From outside: either forward **UDP 2456–2457** on the router, or have everyone join over a VPN like Tailscale. A port forward is the only open port I'd consider for a game, because joining is password- or whitelist-protected. Still, [think about it first](/blog/homelab-security-no-port-forwards/).

## World settings (modifiers)

The in-game "World Modifiers" (combat, death penalty, resources, raids, portals) can be set from the server too:

```yaml
- SERVER_ARGS=-modifier deathpenalty veryeasy -modifier resources most -modifier raids none
```

The server log confirms them on start: `Setting world modifier: raids->none`.

To get the exact line without looking up the option names, use the [Valheim world modifier generator](/tools/valheim-server-modifiers/). Here are [the settings our group plays with](/tools/valheim-server-modifiers/?deathpenalty=veryeasy&resources=most&raids=none): forgiving deaths, triple resources, no raids.

## Next steps

- [Import an existing world from a friend's PC](/blog/valheim-import-world-new-save-format/)
- [Replace the password with a Steam ID whitelist](/blog/valheim-whitelist-instead-of-password/)
- [Fix lag with Better Networking](/blog/valheim-server-lag-better-networking/)
- [Why crops don't grow while nobody is online](/blog/valheim-crops-not-growing-empty-server/)
