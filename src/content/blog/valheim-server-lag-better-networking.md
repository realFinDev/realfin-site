---
title: "Fixing Valheim server lag with Better Networking (server-side only)"
description: "Valheim caps how much data it sends per player. On a big base that's the real bottleneck, not your internet. How Better Networking raises the cap, and why vanilla friends can still join."
pubDate: 2026-10-15T07:40:00
category: game-servers
tags: [valheim, lag, bepinex, mods, networking]
---

My friends complained about lag on our Valheim server: mobs rubber-banding, items popping around. The obvious suspects looked fine:

- Server CPU: ~16 % of one core, 1.4 GB RAM
- Upload: 20 Mbit/s, of which Valheim used under 2
- Ping to the internet: 14 ms, 0 % loss

The server and the connection had plenty of headroom. The problem was inside Valheim itself.

## Why Valheim lags even with good hardware

Two things about Valheim's networking:

1. **Valheim caps how much it sends per player.** By default about **150 KB/s**. A big base has hundreds of thousands of objects (our world: ~270,000), and syncing them hits that cap. Updates arrive late, and mobs jump around.
2. **Areas are simulated by a player's PC, not the server.** Whoever arrives in an area first "owns" it and simulates its mobs and physics for everyone. If that player has a weak PC or bad Wi-Fi, everyone nearby suffers.

Better hardware can't fix #1, because it's a software limit.

[![The first player to arrive in an area simulates it and sends its updates through the server to everyone else; a weak connection there means lag for all, and the server's own per-player send cap adds to it](/images/posts/valheim-area-owner.svg)](/images/posts/valheim-area-owner.svg)

## Better Networking

[Better Networking](https://thunderstore.io/c/valheim/p/CW_Jesse/BetterNetworking_Valheim/) is a BepInEx mod that:

- **raises Steam's send-rate limits** (this is the big one, and it works **server-side only**)
- enlarges the send queue
- adds **compression**, which only works between two machines that both have the mod

Players without the mod can still join normally.

## Installing it on the Docker server

With the `lloesche/valheim-server` image, mods are easy:

1. Stop the server, which saves the world: `docker compose stop`
2. Enable BepInEx in the compose environment:
   ```yaml
   - BEPINEX=true
   ```
3. Drop the mod's DLL into the plugins folder:
   ```
   ./config/bepinex/plugins/CW_Jesse.BetterNetworking.dll
   ```
4. `docker compose up -d`

The log confirms it:

```
[BepInEx] Loading [Better Networking 2.3.2]
[BepInEx] Chainloader startup complete (1 loaded, 0 skipped, 0 failed)
[Better Networking] Steamworks: k_ESteamNetworkingConfig_SendRateMin: 153600 -> 262144
[Better Networking] Steamworks: k_ESteamNetworkingConfig_SendRateMax: 153600 -> 1048576
```

That's the per-player limit going from **150 KB/s to between 256 KB/s and 1 MB/s**. The last release is from 2023, but it loaded cleanly on the current server. Always check the log for errors after adding an older mod.

## Tuning

Defaults are fine for most servers. The config lives in `./config/bepinex/CW_Jesse.BetterNetworking.cfg`:

- **Good upload** (10+ Mbit/s for a few players): you can raise the queue size.
- **Weak upload**: lower the *update rate* to 75 % or 50%. Movement gets slightly less smooth, but it stops overloading the line.

## Things only players can fix

- **Quit through the menu**, not Alt+F4. Hard quits cause sync issues even in vanilla.
- **Best connection goes first.** Since the first player in an area simulates it, the one with the best PC and connection should lead through portals and into new areas.
- **Press F2 in-game** to see each player's ping and data rate. That points at the friend whose connection is the problem.
- Players who install Better Networking themselves get compression too.

## Does it disable achievements?

No. Steam achievements are tracked by each player's game, and a server-side mod can't touch them.
