---
title: "Running a big Minecraft modpack (ATM10) in Crafty Controller with Docker"
description: "Crafty can't import a server from a folder, only from an uploaded zip. The placeholder-and-swap workaround, the Java 21 command for NeoForge and where the memory setting really lives."
pubDate: 2026-10-15T06:40:00
category: game-servers
tags: [minecraft, crafty, modpacks, neoforge, docker]
---

I manage my Minecraft servers with **Crafty Controller 4**, a web panel running in Docker. Vanilla and Paper servers are a few clicks. A heavy modpack like **All The Mods 10** took some workarounds.

## Problem 1: no "import from folder"

Modpack server files come as a big zip you unpack on the server. Crafty's web UI can only import by **uploading a zip from your browser**, which is slow for several gigabytes, and it can't import a folder that's already on the server.

**Workaround: placeholder and swap.**

1. In Crafty, create a normal placeholder server (any version), with the **name and port** you want.
2. Start it once, then **stop it**.
3. On the host, find its folder: `crafty/servers/<server-uuid>/`.
4. Replace the contents with the unpacked modpack server files, **but keep `crafty_managed.txt`**. That's how Crafty recognises the folder.
5. Make sure the files are owned by the same user as the other server folders, or Crafty can't write to them.

## Problem 2: the wrong Java version

Inside the Crafty container, plain `java` was **Java 25**. Minecraft 1.21.1 with NeoForge wants **Java 21**. The container ships several JDKs, so point to 21 explicitly.

In the server's **Config → Server Execution Command**:

```
/usr/lib/jvm/java-21-openjdk-amd64/bin/java @user_jvm_args.txt @libraries/net/neoforged/neoforge/<version>/unix_args.txt nogui
```

Replace `<version>` with the NeoForge version in your pack's `libraries` folder. Then click **Save**, which is easy to miss.

## Problem 3: memory settings that don't apply

Crafty has min/max memory fields, but with a NeoForge command like the one above, the real memory flags come from **`user_jvm_args.txt`** in the server folder:

```
-Xms4G
-Xmx12G
```

Edit that file. Crafty's fields don't touch it. ATM10 is hungry: 8 GB is a sensible minimum, and 10–12 GB is comfortable with a few players.

## Ports

Each server needs its own port. I publish a range from the Crafty container:

```yaml
ports:
  - "8443:8443"               # Crafty web UI
  - "25560-25580:25560-25580" # Minecraft servers
```

and give each server a free port in that range. Remember, a port only reaches friends outside your network if you forward it or use a VPN like Tailscale. [I prefer the VPN](/blog/homelab-security-no-port-forwards/).

## Backups

Modpack worlds are precious and the servers are big. My [nightly backup script](/blog/homelab-backup-script-docker/) archives each server folder but skips `libraries`, `cache`, `logs` and `crash-reports`, which can all be re-downloaded or are useless. That keeps the archives a fraction of the full size.
