---
title: "Prowlarr sync keeps failing with HTTP 400? Find the indexer Sonarr and Radarr reject"
description: "Prowlarr logged '400 BadRequest' when syncing indexers to Sonarr and Radarr several times a day. The culprit was one indexer that never returns movie or TV results. How to find it using the APIs."
pubDate: 2026-10-15T13:00:00
category: homelab
tags: [prowlarr, sonarr, radarr, troubleshooting, media]
---

During a health check of my server, Prowlarr's log had a recurring error, several times a day:

```
[Warn] HttpClient: HTTP Error - Res: HTTP/1.1 [POST] http://radarr:7878/api/v3/indexer: 400.BadRequest
[Warn] RadarrV3Proxy: No Results in configured categories. See FAQ Entry: Prowlarr will not sync X Indexer to App
```

Downloads still worked, so it was easy to ignore. But "something fails every few hours" is how real problems hide. Here's how I found the cause. (As always with the *arr stack: only download what you have the right to.)

## What the error means

When Prowlarr pushes an indexer to Radarr or Sonarr, the app **tests** it before saving: it runs an empty search in **its own categories** (movies `2000` for Radarr, TV `5000` for Sonarr). If the indexer returns nothing there, the app rejects it with **400 Bad Request**, and Prowlarr tries again at the next sync.

The log doesn't say *which* indexer. The APIs do.

## Compare the indexer lists

Each app's API key is in its `config.xml`:

```bash
key(){ docker exec $1 cat /config/config.xml | sed -n 's:.*<ApiKey>\(.*\)</ApiKey>.*:\1:p'; }
PK=$(key prowlarr); RK=$(key radarr); SK=$(key sonarr)

curl -s -H "X-Api-Key: $PK" http://127.0.0.1:9696/api/v1/indexer | jq -r '.[].name'
curl -s -H "X-Api-Key: $RK" http://127.0.0.1:7878/api/v3/indexer | jq -r '.[].name'
curl -s -H "X-Api-Key: $SK" http://127.0.0.1:8989/api/v3/indexer | jq -r '.[].name'
```

My result: Prowlarr had six indexers. Radarr was missing two, Sonarr was missing two.

- One missing from Radarr was a **TV-only** indexer, and one missing from Sonarr was **movie-only**. That's expected, not an error.
- One indexer was missing from **both**. That was the one.

## Test it

Prowlarr can search a single indexer through its API:

```bash
curl -s -H "X-Api-Key: $PK" \
  "http://127.0.0.1:9696/api/v1/search?query=ubuntu&indexerIds=6&type=search" \
  | jq '[.[].categories[].name] | unique'
```

It returned 50 results, all in categories like **Books**, **PC** and **Other**. It worked fine as an indexer, but it had nothing for movies or TV. So both apps' tests failed, every sync, forever.

## The fix

It overlapped with general indexers I already had, so I **disabled** it in Prowlarr (Indexers → edit → uncheck *Enable*). That's reversible with one click. Then I forced a sync:

```bash
curl -s -X POST -H "X-Api-Key: $PK" -H "Content-Type: application/json" \
  -d '{"name":"ApplicationIndexerSync","forceSync":true}' \
  http://127.0.0.1:9696/api/v1/command
```

Zero errors since. Radarr and Sonarr kept all their working indexers. The disabled one had never been in them anyway.

## Alternatives

- If you want to keep the indexer for **manual** searches in Prowlarr, give it a separate **sync profile** with automatic sync disabled, or restrict which apps it syncs to with tags.
- Check the app's **sync categories** in Prowlarr → Settings → Apps. Narrow categories can cause the same 400.

## Related

[How my Jellyfin + *arr stack fits together](/blog/jellyfin-arr-stack-docker/).
