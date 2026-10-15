---
title: "Why 'docker stop' before a reboot left my whole homelab down for two days"
description: "restart: unless-stopped treats an explicit docker stop as 'the user wants this off'. A reboot script that stopped containers first stranded every service, including DNS."
pubDate: 2026-10-15T11:00:00
category: homelab
tags: [docker, restart-policy, reboot, mistakes]
---

My server reboots itself automatically when updates need it ([here's why](/blog/nvidia-driver-mismatch-jellyfin-transcoding/)). An early version of that reboot script tried to be careful: it stopped all containers cleanly first, then rebooted.

The server came back up. **None of the containers did.** Not Jellyfin, not Home Assistant, and not DNS, which meant no device in the house could resolve websites until I changed them to a public DNS server by hand. It stayed like that for about two days.

## What went wrong

Almost all my services use:

```yaml
restart: unless-stopped
```

The name says it exactly: restart the container **unless it was stopped**. If *you* stop a container with `docker stop` (or `docker compose stop`), Docker remembers that you wanted it off, and keeps it off, even after a reboot.

So my "careful" script did this:

1. `docker stop` on every container → Docker records "the user stopped these"
2. reboot
3. Docker starts → sees that every container was deliberately stopped → leaves them all stopped

## The fix: let the OS stop Docker

Just reboot. When the host shuts down, systemd stops the Docker service, and Docker stops the containers gracefully *without* marking them as user-stopped. On boot, everything with `unless-stopped` or `always` comes back.

The script now goes straight to:

```bash
sync
systemctl reboot
```

## Giving containers time to shut down

The reason I'd added `docker stop` in the first place was to give databases time to shut down cleanly. The right tool for that is the daemon's shutdown timeout in `/etc/docker/daemon.json`:

```json
{
  "shutdown-timeout": 60
}
```

Docker then gives containers up to 60 seconds to exit when the daemon stops. Restart Docker after changing it.

## If it happens to you

Bring every stack back up in one go:

```bash
for d in ~/dockerapps/*/; do (cd "$d" && docker compose up -d); done
```

## Restart policies cheat sheet

| Policy | After a crash | After a reboot | After you `docker stop` it, then reboot |
|---|---|---|---|
| `no` | stays down | stays down | stays down |
| `always` | restarts | starts | **starts** |
| `unless-stopped` | restarts | starts | **stays down** |


`unless-stopped` is still the right default: it lets you turn things off on purpose. Just never "turn everything off on purpose" right before a reboot.

## How to check what will come back after a reboot

Before you reboot, this lists every container with its restart policy and whether Docker considers it user-stopped:

```bash
docker ps -a --format '{{.Names}}' | while read c; do
  docker inspect "$c" --format '{{.Name}}  policy={{.HostConfig.RestartPolicy.Name}}  running={{.State.Running}}'
done
```

Anything with `policy=unless-stopped running=false` will **stay down** after the reboot. That's what you want for retired projects, and a nasty surprise for anything you forgot about.

## Testing it safely

You don't need a real reboot to test restart behaviour. `sudo systemctl restart docker` stops and starts the daemon the same way a reboot does, so containers come back according to their policy. Do it at a quiet time, because everything restarts once.
