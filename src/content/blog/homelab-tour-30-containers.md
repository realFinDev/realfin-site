---
title: "My homelab tour: one server, ~30 Docker containers"
description: "What runs on my home server, how it's organised with Docker Compose, and the lessons that shaped it."
pubDate: 2026-10-15T12:20:00
category: homelab
tags: [docker, homelab, overview]
---

People ask what a "homelab" actually *does*. Mine is one machine under my desk running about thirty Docker containers. It streams movies, blocks ads for every device in the house, records the cameras, runs a private AI chatbot and hosts game servers for my friends. This post is the tour. The [My homelab](/homelab/) page has the full parts list.

## The hardware is boring on purpose

A Ryzen 7 5700X, 32 GB of RAM, a GTX 1050 Ti, a 500 GB NVMe drive for the system and a 2 TB hard drive for bulk data. Nothing exotic. The CPU idles under 40 °C and the whole box is quieter than my PC.

The one decision I'd repeat is **splitting the disks by job**:

- **NVMe**: the OS, Docker and every app's config folder. Small, fast and important.
- **HDD**: media, camera recordings and backups. Big and replaceable.

Backups of the configs land on the other disk, so one dead drive never takes the data *and* its backup with it.

## One folder per stack

Every service lives in its own folder with a `docker-compose.yml`:

```
~/dockerapps/
├── media-stack/          # Jellyfin + Sonarr/Radarr/Prowlarr/Bazarr/Jellyseerr + qBittorrent
├── music-stack/          # Navidrome + my music downloader + File Browser
├── homeassistant-stack/  # Home Assistant + Zigbee2MQTT + Mosquitto
├── llama-docker/         # Ollama + Open WebUI + SearXNG
├── nginx-proxy-manager/
├── vaultwarden/
├── valheim/
└── ...
```

Related containers share a stack, so they share a Docker network and can reach each other by name (`http://radarr:7878` instead of an IP). Unrelated things stay apart. To update or rebuild something, I `cd` into its folder and run `docker compose pull && docker compose up -d`.

## What each group does

- **Media**: Jellyfin plus the *arr apps. I request a show, and it appears in the library with subtitles. [How the chain works](/blog/jellyfin-arr-stack-docker/).
- **Network**: AdGuard Home and Unbound handle DNS for the whole house. Nginx Proxy Manager gives every service a friendly HTTPS name on the LAN.
- **Smart home**: Home Assistant with a Zigbee USB dongle and a temperature/humidity sensor (for now).
- **AI**: Ollama runs a small language model on the GPU, Open WebUI is the chat interface, and SearXNG gives it web search.
- **Games**: a Valheim server and Minecraft servers managed by Crafty Controller.
- **Glue**: Vaultwarden for passwords, Homarr as a dashboard, Uptime Kuma and Netdata for monitoring.

## Lessons that shaped it

1. **Things break silently.** My Zigbee bridge [restarted 22,112 times](/blog/zigbee2mqtt-restart-loop-docker-network/) over three days before I noticed. Monitoring isn't optional.
2. **Reboots are a test.** Once, a reboot script [left every service down for two days](/blog/docker-stop-before-reboot-mistake/). Now I know exactly how restart policies behave.
3. **Logs grow forever unless you stop them.** Docker had quietly collected [2.4 GB of logs](/blog/docker-log-size-limits/).
4. **Don't open ports.** Nothing here is reachable from the internet. [Here's how I still use it from anywhere](/blog/homelab-security-no-port-forwards/).

## Should you build one?

If you have an old PC, yes. Start with one thing you'd actually use, like Jellyfin or AdGuard, in Docker Compose, and add the next service when you miss something. Mine grew one container at a time, and every post on this site is one of those steps.
