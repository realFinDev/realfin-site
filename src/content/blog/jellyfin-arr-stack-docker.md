---
title: "How my Jellyfin + *arr media stack fits together (Docker Compose)"
description: "Jellyseerr → Sonarr/Radarr → Prowlarr → qBittorrent → Jellyfin. How the pieces talk to each other, hardlinks, FlareSolverr and the settings that tripped me up."
pubDate: 2026-10-15T10:00:00
category: homelab
tags: [jellyfin, sonarr, radarr, prowlarr, docker, media]
---

My media server is eight containers in one Compose stack. Once it's set up, the workflow is: someone requests a movie in a web page, and a while later it's in Jellyfin with subtitles. Here's how the pieces connect. This post covers the *plumbing*, not where content comes from. Only download what you have the right to.

## The chain

```
Jellyseerr  →  Radarr (movies) / Sonarr (TV)  →  Prowlarr (indexers)
                         ↓
                    qBittorrent  →  /downloads
                         ↓ (import via hardlink)
                 /media/movies, /media/tv  →  Jellyfin
                         ↑
                      Bazarr (subtitles)
```

| App | Job |
|---|---|
| **Jellyseerr** | Request page for the household. Talks to the Radarr, Sonarr and Jellyfin APIs only, so it needs no media mounts. |
| **Radarr / Sonarr** | Track wanted movies and shows, pick releases, rename and organise files. |
| **Prowlarr** | Manages indexers once and **syncs** them into Radarr and Sonarr. |
| **qBittorrent** | Downloads. |
| **Bazarr** | Fetches subtitles. |
| **FlareSolverr** | Gets past Cloudflare challenges for indexers that use them. |
| **Jellyfin** | Plays everything, with GPU transcoding. |

## Everything on one network, by name

Because they're in the same Compose file, they share a Docker network and reach each other by **service name**:

- In Prowlarr → Apps: `http://radarr:7878` and `http://sonarr:8989`
- In Radarr/Sonarr → Download client: host `qbittorrent`, port = its Web UI port
- FlareSolverr in Prowlarr: `http://flaresolverr:8191`

No IP addresses anywhere, and nothing breaks if container IPs change.

## Hardlinks: the setting that matters most

If downloads and the library live on the same filesystem, *and* the containers see them at matching paths, Radarr and Sonarr can **hardlink** finished downloads into the library. That's instant, uses no extra space, and seeding continues. Get it wrong and every import becomes a full copy.

My layout on the data disk:

```
/mnt/data/media/
├── downloads/
├── movies/
├── tv/
└── music/
```

and every *arr container plus qBittorrent mounts `/mnt/data/media/downloads:/downloads` at the **same path**. The library folders are mounted alongside. One filesystem, consistent paths.

## Permissions: PUID/PGID

The linuxserver.io images run as the user and group you give them:

```yaml
environment:
  - PUID=1000
  - PGID=1001   # a "media" group that owns /mnt/data/media
  - TZ=Europe/Berlin   # your own time zone
```

Use the **same** PUID/PGID for every container that touches media, or you'll get "access denied" on imports.

## Things that tripped me up

1. **Port clash.** qBittorrent's Web UI defaults to 8080, which another container of mine already used. Change both `WEBUI_PORT` *and* the published port, and use the new port in Radarr and Sonarr.
2. **qBittorrent behind a reverse proxy.** It rejected requests until I disabled its CSRF and Host-header validation, because the proxy changes the Host header. Only do this if the UI isn't exposed beyond your LAN.
3. **Cloudflare-protected indexers.** In Prowlarr, add FlareSolverr as an *indexer proxy* with a tag, then put the **same tag** on the indexers that need it. No tag, no proxy.
4. **DNS blocklists.** My network ad blocker blocked some indexer domains. A connection error on "Test" can be DNS. Check your blocker's log.
5. **"Fatal player error" in Jellyfin.** That was a [GPU driver problem](/blog/nvidia-driver-mismatch-jellyfin-transcoding/), not the media files.

## Keep it private

None of these apps belong on the open internet. I reach mine on the LAN and over Tailscale from outside. [Why I don't port-forward anything](/blog/homelab-security-no-port-forwards/).
