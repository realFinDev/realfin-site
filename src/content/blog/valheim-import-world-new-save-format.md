---
title: "Moving a Valheim world to a dedicated server (the new folder save format)"
description: "Valheim no longer saves worlds as .db + .fwl. Where the new world folder lives, how to get it out of Steam Cloud, and how to load it on a server."
pubDate: 2026-10-15T08:00:00
category: game-servers
tags: [valheim, saves, steam-cloud, migration]
---

We moved a world from a friend's PC to my [Docker Valheim server](/blog/valheim-dedicated-server-docker/). Every guide I found said "copy `WorldName.db` and `WorldName.fwl`". Those files didn't exist. Valheim changed its save format, and here's what it looks like now.

## The new format: a folder per world

Instead of two files, each world is now a **folder** named after the world:

```
worlds_local/
└── MyWorld/
    ├── 1e_1e__1_2.chunk
    ├── 20_20__1_39.chunk
    ├── ...more .chunk files...
    ├── _main.40.chunks
    ├── _main.40.db2
    ├── _main.40.fwl2
    └── _main.40.ok
```

- `.chunk` files hold parts of the map: terrain, buildings, chests.
- `_main.N.*` is the world's main data. The number **N goes up with every save** (40, 41, 42…).

**Don't confuse it** with the map-cache files that sit next to it (`cacheMinimapHeight`, `MyWorld_mapTexCache`…). Those only store how the minimap looks. Our first attempt sent exactly those, and the world wasn't in them.

## Where to find it on Windows

**Local worlds:** press Win + R and paste:

```
%USERPROFILE%\AppData\LocalLow\IronGate\Valheim\worlds_local
```

**Steam Cloud worlds** live in Steam's folder instead:

```
C:\Program Files (x86)\Steam\userdata\<your-id>\892970\remote\worlds
```

`892970` is Valheim's app ID. `<your-id>` is the same number as your Steam **friend code** (Friends → Add a Friend).

**Easiest option for cloud saves:** Steam lets you download your cloud files in a browser at
`https://store.steampowered.com/account/remotestorageapp/?appid=892970`.
Or, in-game: Start Game → select the world → **Move to local**.

**Who has the world?** Whoever *hosted* the game. The other players only have map caches.

## Loading it on the server

1. Zip the whole world folder and copy it to the server.
2. **Stop the server** so it can't overwrite anything: `docker compose stop`.
3. Put the folder in the server's world directory:
   ```
   ./config/worlds_local/MyWorld/
   ```
4. Set `WORLD_NAME=MyWorld` (the folder name, exactly) and start it again.

The log should show it loading the **existing** save, not creating a new world:

```
ZNet.LoadWorld: MyWorld (MyWorld), save number 40
ConnectPortals => Connected 5 portals.
```

If you see `missing ... MyWorld.db` and a fresh world, the name or path is wrong.

## World modifiers come along

The `_main.N.fwl2` file stores the world's settings: seed, world modifiers and the list of players who've joined. Running `strings` on it shows things like `resourcerate 300` and `deathpenalty_veryeasy`. Anything you set with `-modifier` on the server applies on top.

## Tip: everyone switches at the same time

Once the world is on the server, nobody should keep playing their local copy. The two copies split apart immediately, and there's no merging them.
