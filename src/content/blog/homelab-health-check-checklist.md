---
title: "My 10-minute homelab health check (and what it caught)"
description: "The commands I run to check a Docker homelab: restart counts, failed units, alarms, disks, backups and log noise. On its first run it found a container that had restarted 22,000 times."
pubDate: 2026-10-15T10:30:00
category: homelab
tags: [docker, monitoring, checklist, maintenance]
---

Dashboards are great, but they show what you configured them to show. Every now and then I run a manual check that looks for the things *nobody* is watching. The first time I did this properly, it found three real problems on a server I thought was fine.

Here's the checklist, in the order I run it. The read-only checks are also bundled into one script you can [read](/downloads/homelab-healthcheck.sh) and run with `bash homelab-healthcheck.sh` (it changes nothing).

## 1. Containers that are quietly crash-looping

`docker ps` showing "Up" isn't enough. A container stuck in a restart loop is "Up" for a few seconds at a time.

```bash
docker ps -a --format '{{.Names}}\t{{.Status}}' | sort
for c in $(docker ps -q); do
  docker inspect $c --format '{{.RestartCount}} {{.Name}}'
done | sort -rn | head
```

Look for: "Up 1 second", "Restarting", unexpected "Exited", and **any restart count above zero**.

**Found:** Zigbee2MQTT at **22,112 restarts**, crash-looping since the last reboot. [Full story](/blog/zigbee2mqtt-restart-loop-docker-network/).

## 2. Failed system services

```bash
systemctl --failed
systemctl list-timers --all | head -20
```

**Found:** a certbot timer that had been failing every 12 hours for months. [Why](/blog/certbot-standalone-port-conflict/).

## 3. Monitoring alarms

If you run Netdata, its API lists active alarms without opening the UI:

```bash
curl -s localhost:19999/api/v1/alarms | python3 -c \
  'import sys,json; a=json.load(sys.stdin)["alarms"]; print(len(a), "active"); [print(k) for k in a]'
```

## 4. Temperatures

```bash
sensors | grep -E 'Tctl|Composite'   # CPU and NVMe
nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader
```

My normal idle values: CPU ~38 °C, NVMe ~40 °C, GPU ~33 °C. Write yours down once, so you can tell when something's off.

## 5. Disks and what's eating them

```bash
df -h / /mnt/data
docker system df
journalctl --disk-usage
```

**Found:** 2.4 GB of container logs with no size limit. [How I capped them](/blog/docker-log-size-limits/). Also, `docker system df` claimed 32 GB reclaimable, which [turned out to be ~3](/blog/docker-reclaimable-space-misleading/).

## 6. Did last night's backup run?

```bash
tail -3 ~/backup-all.log
ls -lt /mnt/data/backups | head
```

The last "complete" line should be from last night. [My backup script](/blog/homelab-backup-script-docker/).

## 7. Error counts per container

```bash
for c in $(docker ps --format '{{.Names}}'); do
  n=$(docker logs --since 24h $c 2>&1 | grep -ciE '\berror\b|fatal|exception|panic')
  [ "$n" -gt 0 ] && echo "$n $c"
done | sort -rn
```

Most of what shows up here is **noise**, and that's the point: you learn your baseline. On my server, Home Assistant logs ~2,000 harmless Bluetooth scanner errors a day. I know that's normal, so a *different* error stands out.

**Found:** Prowlarr failing to sync an indexer several times a day. [The fix](/blog/prowlarr-sync-400-bad-request/).

## 8. Write the baseline down

The most useful output of the whole exercise is a short note: normal temperatures, normal disk usage, which log errors are expected. Next time, comparing against it takes minutes instead of an hour.

## How often?

After every reboot (network attachment problems show up at boot), and otherwise once a month. Real monitoring catches the loud failures. This catches the quiet ones.
