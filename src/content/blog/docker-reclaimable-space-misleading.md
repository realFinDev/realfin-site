---
title: "Docker said 32 GB was reclaimable. The real number was closer to 3"
description: "docker system df claimed 92% of my image space could be freed. Checking image by image told a very different story. How to find what's actually unused before you prune anything."
pubDate: 2026-10-15T11:30:00
category: homelab
tags: [docker, disk-space, cleanup]
---

During a cleanup of my homelab, `docker system df` looked like great news:

```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          46        31        34.72GB   32.05GB (92%)
Containers      32        29        514.3MB   17B (0%)
Local Volumes   45        8         4.959MB   271.7kB (5%)
Build Cache     28        0         1.696GB   8.563kB
```

32 GB reclaimable out of 35! Except that 31 of 46 images are in use by containers, and those are the big ones (Jellyfin, Frigate, Home Assistant, Ollama…). That number couldn't be right, so before running any `prune`, I checked what was actually unused.

## List images that no container uses

This compares every image ID against the images of *all* containers, running or stopped:

```bash
used=$(docker ps -aq | xargs docker inspect --format '{{.Image}}' | sort -u)
docker images --no-trunc --format '{{.ID}}|{{.Repository}}:{{.Tag}}|{{.Size}}' |
while IFS='|' read id name size; do
  echo "$used" | grep -q "$id" || echo "$size  $name"
done | sort -h -r
```

My real list:

```
765MB  linuxserver/ffmpeg:latest
445MB  postgres:15
191MB  certbot/certbot:latest
57.9MB portainer/helper-reset-password:latest
47.6MB python:3-alpine
8.45MB alpine:latest
5.5MB  appropriate/curl:latest
```

About **1.5 GB**, not 32. Add two old stopped containers' images and it's roughly 3 GB in total.

## The build cache line is misleading too

`Build Cache 1.696GB`, but **reclaimable: 8.5 kB**. Almost all of that cache is shared with an image I built and still run. Pruning it frees practically nothing, so the `RECLAIMABLE` column is the one to trust there, not `SIZE`.

## Check before you delete

Things I almost got wrong:

- **`alpine` looked unused**, but my nightly backup script runs `docker run alpine …`. Deleting it is harmless (it would just re-download), but it shows that "no container uses it right now" doesn't mean "nothing needs it".
- **`postgres:15`** turned out to be left over from trying an app. Before removing it, I checked that no volume held database files:
  ```bash
  docker run --rm -v /var/lib/docker/volumes:/v:ro alpine sh -c \
    'for d in /v/*/_data; do [ -f "$d/PG_VERSION" ] && echo "$d"; done'
  ```
  Nothing found, so it was only the downloaded image.
- **Stopped containers** often belong to projects you paused. Removing the container doesn't delete bind-mounted data folders, but know which ones you might restart.

## Remove deliberately, not with `prune -a`

```bash
docker rm dashy                                   # one stopped container
docker rmi lissy93/dashy:latest postgres:15       # specific images
```

`docker image prune -a` removes **every** image not used by a container, including ones your scripts pull on demand and images of stopped stacks you meant to keep. Picking by name is slower, but you know exactly what's gone.

## Why the number was wrong

I don't have a definitive answer. It depends on how your Docker version counts shared layers and which storage backend it uses. The lesson is the same either way: **treat `RECLAIMABLE` as a hint, and verify per image** before cleaning up.
