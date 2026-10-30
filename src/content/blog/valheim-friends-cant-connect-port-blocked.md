---
title: "Friends got 'Failed to connect' to my Valheim server: the port was blocked before it reached me"
description: "Same game version, no mods, whitelisted, and still 'Failed to connect'. The router never passed UDP 2456 in. Running the server on a different external port with one Docker line fixed it, and here's how to check that it actually works."
pubDate: 2026-10-30T19:30:00
category: game-servers
tags: [valheim, docker, networking, port-forwarding, troubleshooting]
---

A friend tried to join our Valheim server and got **"Failed to connect"**. Same game version, no mods, and his Steam ID was on the whitelist. People on my home network could join without any problem.

When it works at home but not from outside, the problem is almost always between the internet and the server. Here's how I found it, the one-line fix, and how to prove the fix works when port checkers say it doesn't.

## Rule out the server first

Before blaming the network, three quick checks:

1. **Is the server actually up?** `docker logs valheim | grep "Game server connected"` should show a line after the last restart.
2. **Is it the same version?** Valheim updates often. My server image [updates itself only when nobody's online](/blog/valheim-dedicated-server-docker/), so for a few minutes after a game patch the server can be one version behind. That usually gives a version error, not "Failed to connect".
3. **Is the player allowed in?** With a [whitelist](/blog/valheim-whitelist-instead-of-password/), a missing Steam ID gets the player kicked right after connecting. That shows up in the log as a connection followed by a disconnect.

All three were fine. Nothing at all appeared in the server log when he tried, so his connection never reached the server.

## Port checkers lie about Valheim

My first idea was an online port checker. It said the port was **closed**. That sounds like proof, but it isn't:

- **UDP has no handshake.** For TCP, a checker can see whether a connection is accepted. For UDP it can only send a packet and hope for an answer.
- **A private Valheim server doesn't answer queries.** With `SERVER_PUBLIC=false` the server doesn't respond to Steam server queries at all. I tested this from the server itself: a query to `127.0.0.1` got no answer either.

So a "closed" result for a private Valheim server tells you nothing. You need to look at what arrives on the server instead (more on that below).

## The actual problem: the router never passed 2456 in

The port forward for UDP 2456–2457 was set up on the router, pointing at the server. It looked correct, but packets from outside never arrived.

Some ISP-supplied routers don't forward every port, or forward some ports to their own services. You can't always see that in the web interface. The rule saves, shows up in the list, and does nothing.

The test that settled it: the **same rule with a different external port** worked straight away.

## The fix: a different outside port, same inside port

Valheim uses two UDP ports: the game port and the one above it (game port + 1) for Steam. You don't need to change Valheim's configuration. Docker can listen on a second pair of ports and send them to the same container ports:

```yaml
services:
  valheim:
    image: lloesche/valheim-server
    ports:
      - "2456-2457:2456-2457/udp"     # inside the home network, as before
      - "26000-26001:2456-2457/udp"   # from the internet: the router forwards these
```

On the router, forward **UDP 26000 → 26000** and **UDP 26001 → 26001** to the server. Use any free pair of consecutive ports. 26000 is just the example here.

Recreate the container (`docker compose up -d`). Friends outside now join with `your-address:26000`, and people at home can keep using `:2456`.

**Before you restart,** check nobody is playing. The server logs its player count every few minutes:

```bash
docker logs valheim 2>&1 | grep "Connections" | tail -1
```

## Checking that it works without a second person

You don't need a friend standing by, and you don't need a port checker. Two tools on the server show the truth.

**1. Do packets from outside arrive?** `tcpdump` shows every packet to those ports that doesn't come from your own network (replace the interface and the local network with yours):

```bash
sudo tcpdump -n -i eth0 'udp and (dst port 26000 or dst port 26001) and not src net 192.168.1.0/24'
```

Then try to join from outside, for example from a laptop on your phone's hotspot. If lines appear, the router forward works. If nothing appears, the problem is still at the router or the ISP.

**2. Is there a real two-way connection?** Docker's port mapping runs through the Linux connection tracker. It shows a flow as `[ASSURED]` once traffic has gone both ways:

```bash
sudo conntrack -L -p udp | grep 'dport=26000'
```

```text
udp 17 119 src=<friend's IP> dst=<server> sport=55237 dport=26000 src=<container> dst=<friend's IP> sport=2456 dport=55237 [ASSURED]
```

This line says: a player from outside connected to port 26000, Docker passed it to the container's 2456, and the server answered. That's the whole path. If you see that line while your friend is in the game, you're done.

If packets arrive but there's no `[ASSURED]` flow and nothing in the server log, look at the server's firewall. If the log shows a connection followed by a quick disconnect, check the whitelist.

## Summary

- "Failed to connect" with the right version and no mods means the connection never reached the server.
- Don't trust port checkers for a private Valheim server. It doesn't answer them even when everything works.
- If a forward for 2456 does nothing, try another external port. Docker can map it to 2456 inside, so Valheim doesn't need any changes.
- `tcpdump` shows whether packets arrive. `conntrack` shows whether a real connection exists.

A game port is the one port forward I make an exception for ([why I don't open anything else](/blog/homelab-security-no-port-forwards/)). The server is whitelist-only, and the forward goes to one UDP port pair on one container, not to the whole machine.
