---
title: "Valheim server without a password: use a Steam ID whitelist instead"
description: "Valheim never remembers server passwords. permittedlist.txt lets only your friends' Steam IDs in, with no password prompt, and it's arguably more secure."
pubDate: 2026-10-15T07:20:00
category: game-servers
tags: [valheim, security, whitelist, dedicated-server]
---

Valheim asks for the server password **every single time** you join, even for favourited servers. After the twentieth time typing it, I switched our server to a whitelist instead.

## How it works

Valheim servers read a file called `permittedlist.txt`. If it contains any Steam IDs, **only those players can join**. Everyone else is rejected, whatever they know about your server. Combined with an **empty password**, your friends just click Join.

It's arguably safer than a password: a password can be passed around or leaked, but nobody can fake someone else's Steam ID.

One requirement: Valheim only allows an empty password on servers that **aren't listed publicly** (`SERVER_PUBLIC=false`).

## 1. Collect Steam IDs

You need each player's **SteamID64**, the long number starting with `7656119…`. Ways to get it:

- From their Steam profile URL, if they haven't set a custom one (`steamcommunity.com/profiles/7656119…`).
- From any Steam ID lookup site, using their profile link.
- From the world itself: an imported world's `_main.N.fwl2` contains the IDs of everyone who has played on it (`Steam_7656119…` entries). The server also prints this "player history" on start-up.

## 2. Write the whitelist

In the server's config folder (`./config/permittedlist.txt` with the `lloesche/valheim-server` image):

```
// List permitted players ID ONE per line
// Alice
76561198000000001
// Bob
76561198000000002
// Charlie
76561198000000003
```

Lines starting with `//` are comments. Label each ID, or you'll forget whose is whose.

## 3. Remove the password

In the compose `.env`:

```
SERVER_PASS=
```

and make sure the compose file has `SERVER_PUBLIC=false`. With BepInEx enabled, the image's start script leaves out the `-password` argument entirely when it's empty. Without BepInEx, check the image's docs, because some modes always pass it.

Restart:

```bash
docker compose up -d
```

Check the server process to confirm there's no `-password` flag:

```bash
docker exec valheim sh -c 'ps -eo args | grep valheim_server.x86 | grep -v grep'
```

## 4. Join

Friends add the server once (`address:2456`) and favourite it. No password box. Anyone not on the list gets turned away.

## Adding someone later

Add their ID on a new line and restart the server. The list is read on start-up.

## Admins

`adminlist.txt` in the same folder works the same way. IDs listed there can use admin console commands in-game (F5: `kick`, `ban`, `save`…). Only add people you'd trust with your world.
