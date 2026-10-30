---
title: "Turning on my gaming PC from my phone, from anywhere, without opening a port"
description: "Wake-on-LAN magic packets can't cross the internet. The trick is to send them from a small server that's always on at home, and reach that server over Tailscale. Setup for the PC, the server and the phone."
pubDate: 2026-10-30T19:40:00
category: homelab
tags: [wake-on-lan, tailscale, ssh, windows, networking]
---

I wanted to start my gaming PC from my phone: before I get home, or when I'm away and need a file from it or want to stream a game. The PC is normally off, so it can't run anything to make that happen.

This is what Wake-on-LAN is for. Getting it to work from outside the house is the tricky part, and the usual answer ("forward a port for the magic packet") is one I didn't want.

## Why you can't wake a PC directly over the internet

A Wake-on-LAN "magic packet" is a broadcast on your local network: six bytes of `FF`, then the PC's MAC address repeated 16 times. The network card listens for it even when the PC is off.

A broadcast doesn't leave your home network. Routers don't forward it, and a VPN like Tailscale can't deliver it either, because the sleeping PC isn't running Tailscale. So the packet has to be sent **from inside the home network**.

If you already have an always-on device at home (a home server, a Raspberry Pi, even a NAS), you're set:

**Phone → (Tailscale) → home server → (broadcast) → PC wakes up.**

Nothing is forwarded on the router. Tailscale handles the connection from the phone.

## 1. Prepare the PC

Wake-on-LAN has to be enabled in three places. If any one is missing, it silently doesn't work.

**BIOS/UEFI** (names vary by board):

- "Wake on LAN", "Power On by PCI-E" or "Resume by PCI-E device": **enabled**.
- "ErP" or "EuP Ready" (a low-power mode for when the PC is off): **disabled**. When it's on, the network card has no power while the PC is off.

**Windows, network card settings** (Device Manager → Network adapters → your wired card → Properties):

- **Advanced** tab: "Wake on Magic Packet" **enabled**. On Realtek cards, also "Shutdown Wake-On-Lan" **enabled**. Without it the card only wakes from sleep, not from shut down.
- **Power Management** tab: tick "Allow this device to wake the computer" and "Only allow a magic packet to wake the computer". The second one stops random network traffic from waking the PC at night.

**Windows Fast Startup: off.** Control Panel → Power Options → "Choose what the power buttons do" → untick "Turn on fast startup". With Fast Startup, "Shut down" is really a kind of hibernation, and many network drivers don't arm Wake-on-LAN for it.

Then write down the **MAC address** of the wired card (`ipconfig /all`, "Physical Address"). Wake-on-LAN over Wi-Fi rarely works, so use a cable.

## 2. The script on the home server

On a Debian/Ubuntu server:

```bash
sudo apt install wakeonlan
```

(On Ubuntu a "Daemons using outdated libraries" screen may pop up after installing. It's `needrestart` offering to restart services. Accepting the defaults is fine.)

Test it while the PC is off. Use your network's broadcast address (for `192.168.1.x` that's `192.168.1.255`) and the PC's MAC:

```bash
wakeonlan -i 192.168.1.255 AA:BB:CC:DD:EE:FF
```

If the PC turns on, put it in a short command so you don't have to remember the MAC:

```bash
sudo tee /usr/local/bin/wake-pc >/dev/null <<'EOF'
#!/bin/sh
wakeonlan -i 192.168.1.255 AA:BB:CC:DD:EE:FF
echo "Wake packet sent"
EOF
sudo chmod 755 /usr/local/bin/wake-pc
```

If the test does nothing, check the three PC settings again. The most common culprits are ErP and Fast Startup. Also check that the PC's network light stays on while it's off. If it doesn't, the card has no power and can't hear anything.

## 3. Reach the server from your phone

Install [Tailscale](https://tailscale.com/) on the server and on the phone, and log in to the same account on both. The server gets a Tailscale address (`100.x.y.z`) that works from anywhere, over mobile data too.

Make sure Tailscale and SSH start on boot. Otherwise a power cut leaves you locked out:

```bash
sudo systemctl enable --now tailscaled ssh
```

On the phone, any SSH app works (for example Termius or JuiceSSH). Save a host with the server's Tailscale address and your username, and run:

```bash
wake-pc
```

Most SSH apps can save a command as a "snippet" or run it on connect, so waking the PC becomes one tap.

Use an SSH key instead of a password if your app supports it. The server is only reachable over Tailscale anyway, but it's a good habit.

## Why I like this setup

- **Nothing is open to the internet.** No port forward for Wake-on-LAN, no port forward for SSH. Tailscale does the reaching-in ([more on that approach](/blog/homelab-security-no-port-forwards/)).
- **It's tiny.** One package, a three-line script, and settings you only change once.
- **It also works at home.** The Tailscale address works on Wi-Fi too, so you only need one saved host on the phone.

Once the PC is on, the same Tailscale connection gets you to it for remote desktop or game streaming. If you use that, install Tailscale on the PC as well.
