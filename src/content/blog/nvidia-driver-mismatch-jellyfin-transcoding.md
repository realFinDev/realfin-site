---
title: "Jellyfin 'fatal player error' after an NVIDIA update: the driver/library mismatch"
description: "Ubuntu auto-updated the NVIDIA driver but kept the old kernel module loaded. GPU transcoding broke for weeks. Diagnosis and a reboot script that only reboots when needed."
pubDate: 2026-10-15T11:20:00
category: homelab
tags: [jellyfin, nvidia, gpu, ubuntu, unattended-upgrades]
---

Some videos in Jellyfin started failing with a generic **"fatal player error"**. Others played fine. The pattern: everything that needed **transcoding** failed, like HEVC files or files with E-AC3 audio on a client that can't play it. Files that direct-played worked.

It looked like a codec problem. It was actually the GPU driver.

## The diagnosis

```bash
$ nvidia-smi
Failed to initialize NVML: Driver/library version mismatch
```

That one message explains everything:

- Ubuntu's **unattended-upgrades** had updated the NVIDIA driver packages in the background, for example from 580.159 to 580.173.
- The **kernel module** that was actually loaded stayed on the old version, because that only changes on a **reboot**.
- My server had been up for 87 days, so it ran with mismatched user-space libraries and kernel module for weeks.

Any container that started using the GPU *after* the update failed to initialise it. Jellyfin's hardware transcoding failed, and the player only showed "fatal player error".

You can confirm the mismatch by comparing the two versions:

```bash
cat /proc/driver/nvidia/version      # what's loaded right now
dpkg -l | grep nvidia-driver          # what's installed
```

## The fix

A reboot. The new module loads, `nvidia-smi` works, and transcoding comes back.

## Preventing it: reboot only when needed

I didn't want to reboot every night, and I didn't want to remember to check. So a small script runs every day at 05:00 from cron and reboots **only** if there's a reason:

```bash
#!/bin/bash
PATH=/usr/sbin:/usr/bin:/sbin:/bin
reason=""
[ -f /var/run/reboot-required ] && reason="pending kernel/package update"
if nvidia-smi 2>&1 | grep -qi "version mismatch"; then
    reason="${reason:+$reason; }NVIDIA driver/library mismatch"
fi
if [ -z "$reason" ]; then
    logger -t scheduled-reboot "No reboot needed"
    exit 0
fi
logger -t scheduled-reboot "Rebooting, reason: $reason"
sync
systemctl reboot
```

And in `/etc/cron.d/scheduled-reboot`:

```
0 5 * * * root /path/to/scheduled-reboot.sh
```

On quiet days it does nothing. When updates land, roughly twice a month, the server reboots at 5 a.m. while everyone's asleep, and a GPU mismatch never lasts more than a day.

**One important detail:** the script does *not* run `docker stop` before rebooting. I learned that [the hard way](/blog/docker-stop-before-reboot-mistake/).

## Alternatives

- `apt-mark hold` the NVIDIA packages and update them by hand. Fine if you remember to.
- Enable `Unattended-Upgrade::Automatic-Reboot "true"` in unattended-upgrades. It's simpler, but it doesn't catch the NVIDIA-specific case.

Either way: if GPU features in Docker suddenly stop working after an update, run `nvidia-smi` on the host first.

## Quick checklist when GPU transcoding breaks

1. `nvidia-smi` on the **host**. Mismatch error → reboot.
2. `docker exec jellyfin nvidia-smi`. If the host works but the container doesn't, the container's GPU runtime config is wrong (`runtime: nvidia` or a `deploy.resources` device reservation).
3. Jellyfin → Dashboard → Playback: is NVENC still selected, and are the codecs your card supports ticked? A GTX 1050 Ti can decode HEVC 8/10-bit but not AV1.
4. Check Jellyfin's transcode log for the actual FFmpeg error. It's far more specific than "fatal player error".
