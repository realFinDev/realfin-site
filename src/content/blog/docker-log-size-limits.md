---
title: "Docker logs ate 2.4 GB on my server. Here's how to cap them"
description: "Docker's json-file logs grow forever by default. Two lines in daemon.json fix it, but only for containers created afterwards."
pubDate: 2026-10-15T12:00:00
category: homelab
tags: [docker, logs, disk-space, daemon.json]
---

While checking my server, I measured how much space container logs were using:

```bash
docker run --rm -v /var/lib/docker/containers:/c:ro alpine du -sh /c
2.4G    /c
```

One container alone had 1.1 GB of logs. That was the Zigbee bridge that had been [stuck in a crash loop](/blog/zigbee2mqtt-restart-loop-docker-network/), writing its startup messages every 14 seconds for three days.

(The `alpine` trick is so I can read the root-owned Docker folder without `sudo`. Mounting it read-only is harmless.)

## Why it happens

Docker's default `json-file` log driver has **no size limit**. Every line a container prints goes into a file under `/var/lib/docker/containers/<id>/` and stays there until the container is removed. A chatty container or a crash loop can fill a disk.

## The fix: global log options

Edit (or create) `/etc/docker/daemon.json` and add `log-opts`. Keep whatever is already there. Mine already had the NVIDIA runtime and a shutdown timeout:

```json
{
    "runtimes": {
        "nvidia": {
            "path": "nvidia-container-runtime",
            "runtimeArgs": []
        }
    },
    "shutdown-timeout": 60,
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "20m",
        "max-file": "3"
    }
}
```

That's at most 3 files of 20 MB per container. Docker rotates them automatically. With ~30 containers, the worst case is about 2 GB, and in practice it's far less.

Validate the JSON before restarting. A typo stops Docker from starting at all:

```bash
python3 -c 'import json; json.load(open("/etc/docker/daemon.json")); print("ok")'
sudo systemctl restart docker
```

## The catch: existing containers keep their old settings

Log options are fixed **when a container is created**. Restarting Docker isn't enough. You have to recreate the containers. For all running Compose stacks:

```bash
for d in $(docker ps --format '{{.Label "com.docker.compose.project.working_dir"}}' | sort -u); do
  (cd "$d" && docker compose up -d --force-recreate)
done
```

This only touches stacks that are currently running, so stopped projects stay stopped. Data in volumes and bind mounts survives, and the old log files are deleted along with the old containers.

## Check it worked

```bash
docker inspect <container> --format '{{.HostConfig.LogConfig}}'
# {json-file map[max-file:3 max-size:20m]}
```

After recreating everything, my log folder went from **2.4 GB to under 2 MB**.

## Per-service override

If one container needs more history, set it in its Compose file:

```yaml
services:
  homeassistant:
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
```

Do this on day one of any Docker host. It's two lines, and it saves a full disk later.
