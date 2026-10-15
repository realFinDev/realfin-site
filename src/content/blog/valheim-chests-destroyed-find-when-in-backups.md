---
title: "My Valheim base got wrecked while I was AFK: finding the exact hour in the backups"
description: "Eight chests and their contents vanished on my dedicated server. Valheim's save chunks aren't compressed, so a 30-line Python script could count the chests in every hourly backup and show exactly when they were destroyed."
pubDate: 2026-10-15T23:20:00
category: game-servers
tags: [valheim, backups, dedicated-server, python, troubleshooting]
---

"A lot of chests got broken and the items disappeared."

That was the report from our Valheim server. Nobody had seen it happen. The server log showed no errors, raids are switched off on our world, and the only clue was that I'd been logged in at the base for hours, mostly not at the keyboard.

Restoring a backup was the obvious fix, but **which one?** The server keeps a backup every hour for three days. Pick one that's too old and everyone loses hours of progress. Pick one that's too new and the chests are still gone.

## Valheim's world files can be searched

A Valheim world is now stored as a folder (more about that in [importing a world in the new save format](/blog/valheim-import-world-new-save-format/)). Most of it is `*.chunk` files, one per region of the map, holding every object in that region: trees, rocks, walls and chests.

Two things make them searchable:

1. **The chunks aren't compressed.** gzip only shrinks the biggest one from 1.65 MB to 0.96 MB, which is typical for raw binary, not for already-compressed data.
2. **Every object stores its type as a hash** of its prefab name, for example `piece_chest_wood` for a wooden chest. Valheim uses its own `GetStableHashCode` function for this. It's small enough to rewrite in Python.

So: hash the name, then count how often those 4 bytes appear in each backup. It's not a proper parser, and a count can be a little off (the same 4 bytes can appear by chance, or as a reference rather than the object itself). But the absolute number doesn't matter. What matters is **when the number changes**.

## The script

```python
#!/usr/bin/env python3
"""Count chests, workbenches and other pieces in Valheim world backups.

Usage: python3 valheim_count.py MyWorld worlds-*.zip
"""
import struct
import sys
import zipfile


def stable_hash(s):
    """Valheim's GetStableHashCode, as 4 little-endian bytes."""
    h1 = h2 = 5381
    for i in range(0, len(s), 2):
        h1 = (((h1 << 5) + h1) ^ ord(s[i])) & 0xFFFFFFFF
        if i == len(s) - 1:
            break
        h2 = (((h2 << 5) + h2) ^ ord(s[i + 1])) & 0xFFFFFFFF
    return struct.pack("<I", (h1 + h2 * 1566083941) & 0xFFFFFFFF)


# Prefab names to look for. "items" is the key a container stores its contents under.
NAMES = ["piece_chest_wood", "items", "piece_workbench", "forge", "smelter", "portal_wood"]
HASHES = {name: stable_hash(name) for name in NAMES}

world = sys.argv[1]
print("backup", *NAMES, sep="\t")
for path in sys.argv[2:]:
    counts = dict.fromkeys(NAMES, 0)
    with zipfile.ZipFile(path) as z:
        for entry in z.infolist():
            # Only the live world folder, not copies like MyWorld_backup_...
            if f"/worlds_local/{world}/" in entry.filename and entry.filename.endswith(".chunk"):
                data = z.read(entry)
                for name, h in HASHES.items():
                    counts[name] += data.count(h)
    print(path, *counts.values(), sep="\t")
```

It reads the backup zips made by the [`lloesche/valheim-server`](https://github.com/lloesche/valheim-server-docker) image directly, without extracting anything. For other setups, point it at whatever zips or copies of the world folder you have. Only the path check needs changing.

One trap I hit: one backup suddenly showed **exactly double** the chests. A safety copy of the world folder had been made next to the real one (`MyWorld_backup_…`), and the backup zipped both. That's why the script only counts the live world's folder.

## What the backups showed

Three days of hourly backups, reduced to the rows where something changed (the world saves at :14 and :44, so a backup taken on the hour contains the :44 save):

| World saved at | Chests | Containers with items | Workbenches | Smelters | Portals |
|---|---|---|---|---|---|
| Day 1, 21:44 | 58 | 666 | 37 | 4 | 13 |
| Day 3, 16:44 | 128 | 845 | 47 | 4 | 18 |
| Day 4, 14:44 | 128 | 845 | 47 | **4** | **18** |
| Day 4, 15:44 | 128 | 845 | 47 | **3** | **16** |
| Day 4, 16:44 | **120** | **837** | **46** | 3 | 16 |
| Day 4, 20:44 | 120 | 837 | 46 | 3 | 16 |

The story fits together:

- **For three days the numbers only went up.** That's us building.
- **Between 14:44 and 15:44**, a smelter disappeared and two portal references went with it.
- **Between 15:44 and 16:44**, eight chests' worth of references, their contents and a workbench went.
- **After that, nothing.** It wasn't an ongoing bug, it was one event.

Comparing chunk by chunk showed everything lost was in one region: the base. In my first look I only compared the 16:00 and 17:00 backups and almost restored the 16:00 one, which would have brought the chests back but left the smelter destroyed. **Check every backup, not just the ones around the time you think it happened.**

## Why it happened

Raids were off, so these weren't raid events. What was different that day: I'd been logged in at the base for about eight hours, mostly idle.

In Valheim, an area is **simulated by a player's PC**, usually whoever got there first, including the monsters ([I explained this in the lag post](/blog/valheim-server-lag-better-networking/)). An idle player at the base means monsters keep spawning and roaming around it all night. Workbenches and fires stop monsters from *spawning* nearby, but nothing stops them from *walking in*. They attack whatever's in their way, and when a chest is destroyed, **its contents are gone with it**. Nothing drops.

## Restoring the right backup

With the `lloesche/valheim-server` image, restoring means:

```bash
docker compose stop valheim
cd config/worlds_local
mv MyWorld MyWorld_before_restore         # keep the current world, just in case
unzip ../backups/worlds-YYYYMMDD-150012.zip 'config/worlds_local/MyWorld/*' -d /tmp/restore
cp -a /tmp/restore/config/worlds_local/MyWorld MyWorld
docker compose start valheim
```

Make sure nobody is online first, then check the log for `ZDOMan.LoadChunks` without errors. Afterwards I ran the script on the live world folder: chests, workbench, smelter and portals were all back at their 14:44 numbers.

What players should know before you roll back:

- **Skills, inventory, map and known recipes are stored on each player's PC**, not on the server. A rollback doesn't touch them.
- **Everything else after the backup time is undone**: building, mining, loot in chests, and beds placed later (players respawn at the start stones).
- **Gravestones from deaths after the backup disappear.** Pick them up before the restore.
- **Items picked up after the backup stay in people's bags**, and can also be back in the world. Between friends, a little duplication is the least bad option.

## Lessons

- **Hourly backups made this a 30-minute fix instead of a lost base.** If your server doesn't make them, set that up before you need it ([my full server setup](/blog/valheim-dedicated-server-docker/)).
- **Don't leave a player idle at the base for hours.** Log off, or idle somewhere safe.
- **A wall, a ditch or stakes around the base** stop roaming monsters better than any number of workbenches.
- **Save files are data you can read.** You don't need special tools to answer "when did this change?". You only need to know what to search for.
