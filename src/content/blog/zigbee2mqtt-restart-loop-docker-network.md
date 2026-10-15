---
title: "Zigbee2MQTT restarted 22,112 times, and Docker never told me"
description: "A container that lost its Docker network after a reboot, couldn't resolve the MQTT broker, and crash-looped for three days. How to spot it and fix it."
pubDate: 2026-10-15T12:40:00
category: homelab
tags: [docker, zigbee2mqtt, home-assistant, mqtt, troubleshooting]
---

During a routine check of my server, one line in `docker ps` looked off:

```
zigbee2mqtt   koenkk/zigbee2mqtt:latest   Up 1 second
```

"Up 1 second" on a server that has been running for days means the container is dying and restarting. The restart counter made it obvious:

```bash
$ docker inspect zigbee2mqtt --format '{{.RestartCount}}'
22112
```

Twenty-two thousand restarts in about three days, one every ~14 seconds, ever since the last reboot. My Zigbee temperature sensor hadn't reported anything to Home Assistant the whole time, and nothing had warned me.

## The error

The logs repeated the same loop:

```
z2m: Connecting to MQTT server at mqtt://mosquitto:1883
z2m: MQTT failed to connect, exiting... (getaddrinfo EAI_AGAIN mosquitto)
```

`EAI_AGAIN` is a DNS failure: the container couldn't resolve the name `mosquitto`. Containers in the same Compose project normally find each other by service name through Docker's built-in DNS. That only works if they're attached to the same network.

## The cause: a container with no network

```bash
$ docker inspect zigbee2mqtt --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'

$ docker inspect mosquitto --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
homeassistant-stack_default
```

Mosquitto was on the stack's network. Zigbee2MQTT was attached to **nothing**. Its config still said it belonged to `homeassistant-stack_default`, but after the host rebooted, the network attachment was gone. Every restart reused the same broken container, so restarting could never fix it.

## The fix

Recreate the container from the Compose file:

```bash
cd ~/dockerapps/homeassistant-stack
docker compose up -d --force-recreate zigbee2mqtt
```

`--force-recreate` throws away the broken container and builds a fresh one with the network attached properly. Data is safe because it lives in the mounted `./zigbee2mqtt` folder. Within seconds:

```
z2m: Zigbee2MQTT started!
z2m:mqtt: MQTT publish: topic 'zigbee2mqtt/0xa4c1...', payload '{"humidity":61.7,"temperature":25.4,...}'
```

The sensor reported immediately.

## How to catch this earlier

The real problem was that nothing noticed for three days. A few cheap checks:

- **Look at restart counts**, not just "Up". This one-liner lists any container that has restarted at all:
  ```bash
  for c in $(docker ps -q); do docker inspect $c --format '{{.RestartCount}} {{.Name}}'; done | sort -rn | head
  ```
- **Monitor the thing you care about.** I now watch the sensor itself: if Home Assistant hasn't seen a new temperature in an hour, something upstream is broken.
- **Check after every reboot.** Network attachment problems show up at boot, so a quick `docker ps` after a reboot catches them.
- **Cap your logs.** A crash loop also writes the same startup log thousands of times. This one had grown to 1.1 GB. [Here's how I limited Docker logs](/blog/docker-log-size-limits/).

## Takeaway

`restart: unless-stopped` is great at keeping a service *running*. It's also great at hiding a service that's *broken*. If a container's state looks fine but the restart count keeps climbing, recreate it before you start debugging the app itself.
