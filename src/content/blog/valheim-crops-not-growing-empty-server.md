---
title: "Why Valheim crops don't grow on a dedicated server when nobody's online"
description: "I measured the world clock in the server's save files: it stops about 13 minutes after the last player leaves. Crops, smelters and kilns only progress while someone is connected."
pubDate: 2026-10-15T11:40:00
category: game-servers
tags: [valheim, farming, dedicated-server, world-time]
---

I planted carrot seeds, logged off for the night, and expected a harvest in the morning. Nearly nine hours later: still seedlings.

Carrots take roughly **4,000–5,000 seconds** (about 67–83 minutes) to grow. So what happened?

## Measuring the world clock

My server makes [hourly world backups](/blog/valheim-dedicated-server-docker/), and each one contains the world's `_main.N.db2` file, which stores the current **world time** in seconds. I read that value from every backup across the night and lined it up with when I was online:

| Backup | Players online | World time |
|---|---|---|
| 03:00 | me (logged off 03:02) | 70,471 s |
| 04:00 | nobody | 71,438 s |
| 05:00 | nobody | 71,438 s |
| … | nobody | 71,438 s |
| 11:00 | nobody | 71,438 s |

After I left at 03:02, the clock kept running for about **13 more minutes**, then **froze**. For the next eight hours, no time passed in the world at all.

## What this means

On (at least) current Valheim versions, the dedicated server **pauses world time when it's empty**. So everything that depends on time pauses too:

- **Crops and saplings** don't grow
- **Smelters, blast furnaces and kilns** don't process
- **Fermenters** don't finish
- **Beehives** don't fill

When someone logs back in, the clock resumes from where it stopped. Nothing is lost, it just didn't advance.

So "plant before bed, harvest at breakfast" doesn't work on a dedicated server unless someone stays connected.

## Workarounds

- **Plan sessions around it.** Plant and fill the smelters at the *start* of a session, harvest at the end.
- **Leave a character connected** at the base if you really need things to finish. Stand somewhere safe: an idle player still counts as present, so raids and night spawns still happen around them (unless raids are turned off in the world modifiers).
- **Don't blame your farming mod.** I first suspected my planting mod. The real cause was the clock.

## Bonus: other reasons crops vanish

While investigating, I also lost most of a fresh carrot field in the first half hour. That wasn't the clock. The server log showed Greydwarfs, a Greydwarf Shaman and Skeletons spawning around the base all evening. Young plants have very little health, and enemies trample and smash them. Fence fields in, and keep workbenches or fires near them: player-built structures stop enemies from **spawning** close by.

Unhealthy plants (too close together, uncultivated ground, wrong biome) don't disappear right away either. They just sit there and never grow. Hover over one to see why.
