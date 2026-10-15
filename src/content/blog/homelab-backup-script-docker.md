---
title: "Backing up a Docker homelab with one script (and no sudo)"
description: "A nightly cron job that tars every app's config with a throwaway Alpine container, keeps 7 copies and skips caches. Plus what it doesn't protect you from."
pubDate: 2026-10-15T09:40:00
category: homelab
tags: [backup, docker, cron, bash]
---

Losing a movie library is annoying. Losing ten Home Assistant automations, every Zigbee pairing and the password manager's database is a disaster. So every night at 03:30 my server backs up the **configs** of every service.

## The trick: let a container do the archiving

[![Cron starts the script at 03:30; a throwaway Alpine container reads the app folders read-only, archives each app without caches or logs, writes to the backup disk and keeps the newest seven; an off-site copy is the next step](/images/posts/backup-flow.svg)](/images/posts/backup-flow.svg)

Many app folders are owned by **root**, because containers wrote them. My user can't read them without `sudo`, and I don't want a password-less sudo rule just for backups. So the script runs the archiving inside a temporary Alpine container, which runs as root *inside* and only sees the folders I mount:

```bash
#!/bin/bash
set -uo pipefail
TS=$(date +"%Y-%m-%d_%H-%M-%S")
KEEP=7

docker run --rm \
  -v /home/me:/host:ro \
  -v /mnt/data/backups:/backups \
  -e TS="$TS" -e KEEP="$KEEP" \
  alpine sh -c '
    backup_dir() {  # $1 = path under /host, $2 = archive name, $3 = subdir to tar
      if [ -d "/host/$1/$3" ]; then
        tar czf "/backups/$2_${TS}.tar.gz" \
          --exclude=cache --exclude=Cache --exclude=logs --exclude="*.log" \
          --exclude=MediaCover --exclude=transcodes \
          -C "/host/$1" "$3" 2>/dev/null
        echo "  backed up: $2"
      fi
    }
    backup_dir "dockerapps/homeassistant-stack" "homeassistant" "homeassistant"
    backup_dir "dockerapps/homeassistant-stack" "zigbee2mqtt"   "zigbee2mqtt"
    backup_dir "dockerapps/vaultwarden"         "vaultwarden"   "data"
    backup_dir "dockerapps/media-stack"         "media-stack"   "."
    # ...one line per service

    # Rotation: keep the newest $KEEP archives of each name
    cd /backups || exit 0
    for prefix in $(ls *.tar.gz | sed -E "s/_[0-9-]{10}_[0-9-]{8}\.tar\.gz$//" | sort -u); do
      ls -1tr ${prefix}_*.tar.gz | head -n -${KEEP} | xargs -r rm -f
    done
  '
echo "[$(date)] Backup run complete (TS=$TS)"
```

Key points:

- The home folder is mounted **read-only** (`:ro`), so the backup job can't damage anything.
- **Caches, logs, poster art and transcodes are excluded.** They're big and can be re-downloaded. The media-stack backup went from gigabytes to megabytes.
- **Rotation is by name**: each service keeps its 7 newest archives, so a week of history.

Cron entry (`crontab -e`, as my normal user, which can use Docker):

```
30 3 * * * /home/me/backup-all.sh >> /home/me/backup-all.log 2>&1
```

## Game servers

Minecraft worlds go in the same script with a few extra excludes (`libraries`, `cache`, `logs`, `crash-reports`), because modded servers re-download libraries anyway. My Valheim server makes its own hourly world backups.

## What this does NOT protect against

Be honest about the limits:

- **Same machine.** The backups sit on a second disk in the same box. A dead SSD is covered. Fire, theft or a power surge that kills both disks is not.
- **No off-site copy yet.** The next step is syncing the small, important archives (password manager, reverse proxy, Home Assistant) to somewhere outside the house.
- **Databases mid-write.** Tarring a live SQLite file *usually* works for small home apps at 3:30 a.m. For anything critical, use the app's own export or backup feature as well.
- **Untested backups aren't backups.** Every few months I extract one archive and check that the app actually starts from it.

## Checking it ran

```bash
tail -5 ~/backup-all.log
ls -lh /mnt/data/backups | tail
```

If the last "Backup run complete" line isn't from last night, something's wrong. That's now part of my regular [health checks](/blog/zigbee2mqtt-restart-loop-docker-network/).
