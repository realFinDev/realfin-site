---
title: "Valheim mods on a dedicated server: which ones need the server, and which are client-only"
description: "Some mods only change your own game, others need every player and the server on the same version. How to tell the difference so vanilla friends can still join."
pubDate: 2026-10-15T07:00:00
category: game-servers
tags: [valheim, mods, bepinex, r2modman, thunderstore]
---

When I started modding our Valheim server, the most important question wasn't *which* mods. It was **who needs to install them**. Get it wrong and half your friends can't connect.

## Three kinds of mods

| Kind | Who installs it | Vanilla players can join? | Examples |
|---|---|---|---|
| **Server-only** | the server | ✅ yes | Better Networking (send-rate part) |
| **Client-only** | whoever wants it | ✅ yes | quick-stacking, map pins, recipe browser, planting helpers |
| **Everyone** (server + all clients, same version) | everybody | ❌ no | Multi User Chest, most mods that add items or change game rules |

The third kind usually enforces a **version check**: if you don't have the exact same mod and version as the server, you get disconnected. That's what makes "everyone" mods a group decision.

## How to tell which kind a mod is

1. **Read the mod page.** Good authors say it directly: "client-side only", or "must be installed on the server and all clients".
2. **Does it add content?** New items, creatures or building pieces need everyone.
3. **Does it change shared rules?** Stack sizes, carry weight or crafting from chests usually need everyone (or a config-sync library).
4. **Does it only change *your* UI or inputs?** Usually client-only.

## A real example: quick-stacking into chests

The popular **Quick Stack – Store – Sort – Trash – Restock** mod is client-only. Quick-stacking into the chest you have open always works. Stacking into *all nearby* chests in multiplayer is **off by default**, though, because without the "everyone" mod **Multi User Chest**, two players touching the same chest at the same moment can lose or duplicate items.

The options:

- **Everyone installs Multi User Chest** (server + clients) → safe, but vanilla players are locked out.
- **Only you enable `AllowAreaStackingInMultiplayerWithoutMUC`** → vanilla friends can still join. It's "almost always safe", as the mod's own description puts it. Just avoid quick-stacking while someone else is using those chests.

Since I'm the only one in our group who mods, I chose the second option.

## Watch for overlapping mods

Two mods doing the same job fight each other. Things I ran into:

- Two **planting** mods (PlantEasily and MassFarming): pick one. PlantEasily's page lists MassFarming as incompatible.
- Two **chest sorting/stacking** mods: the same thing, pick one.
- **Hotkey clashes**: a gear-slot mod bound Z/X/C/V and unbound Valheim's own sit/walk/auto-pickup keys. Check every new mod's keybinds in the config editor.

## Achievements

Valheim doesn't disable Steam achievements for mods, and server mods can't affect them at all. Cheat commands (`devcommands`) are a separate thing.

## Tools

- **r2modman** or the **Thunderstore Mod Manager** for your PC. Search by **author name** if a mod's title has special characters. Always launch with the **Modded** button.
- On a Docker server ([setup](/blog/valheim-dedicated-server-docker/)), set `BEPINEX=true` and put DLLs in `config/bepinex/plugins`.
