---
title: "Clean music tags from YouTube downloads with yt-dlp (for Navidrome)"
description: "How I turned 'ARTIST - TITLE (OFFICIAL VIDEO) 1998.' into proper artist, title and album tags with yt-dlp's --parse-metadata and --replace-in-metadata."
pubDate: 2026-10-15T08:40:00
category: homelab
tags: [music, navidrome, yt-dlp, metadata]
---

I stream my music library with **Navidrome**, a self-hosted Spotify-style server. Navidrome builds the whole library from the **tags inside the files**: artist, title and album. Folder names don't matter. So when downloads came in tagged like this:

- Artist: `SomeLabel Official`
- Title: `ARTIST - SONG TITLE (OFFICIAL VIDEO) 1998.`
- Album: *(empty)*

my library turned into one giant "artist" per YouTube channel. Here's how I fixed it at download time. As always: only download music you have the rights to.

## Split "Artist - Title" into real fields

yt-dlp's `--parse-metadata` reads one field and writes others using a pattern:

```bash
--parse-metadata "title:%(artist)s - %(title)s"
```

If the video title is `Artist Name - Song Title`, this sets `artist = Artist Name` and `title = Song Title`. If the pattern doesn't match, the fields stay unchanged, so it's safe to always include.

## Strip the junk

`--replace-in-metadata FIELD REGEX REPLACEMENT` runs a regex over a field:

```bash
--replace-in-metadata "title" "(?i)\s*[\(\[](official\s*)?(music\s*)?(video|audio|lyrics?)[^\)\]]*[\)\]]" "" \
--replace-in-metadata "title" "(?i)\s*\b(HD|4K)\b\s*$" "" \
--replace-in-metadata "title" "\s*\b(19|20)\d{2}\.?\s*$" ""
```

The `(?i)` makes it case-insensitive. That removes `(Official Video)`, `(OFFICIAL VIDEO)`, `[Official Audio]`, `(Lyrics)` a dangling `HD` or `4K`, and a trailing year like `1998.`. Adjust the patterns to what your sources do. Every channel invents its own style.

## Fill in the album

Most single uploads have no album, and then players lump them together oddly. A default value fixes it:

```bash
--parse-metadata "%(album|Singles)s:%(album)s"
```

Two details that cost me time:

- `%(album|Singles)s` means "album, or `Singles` if empty". In `--parse-metadata`, the *from* part is a template, so this default syntax is needed. A plain word there gets read as a **field name**, not as literal text.
- YouTube's "genre" is just the video category ("Music", "Entertainment"), which is useless. I blank it.

## Embed it

```bash
yt-dlp -x --audio-format mp3 --embed-metadata --embed-thumbnail \
  --parse-metadata "title:%(artist)s - %(title)s" \
  --parse-metadata "%(album|Singles)s:%(album)s" \
  --replace-in-metadata "title" "(?i)\s*[\(\[](official\s*)?(music\s*)?(video|audio|lyrics?)[^\)\]]*[\)\]]" "" \
  -o "/music/%(artist)s/%(title)s.%(ext)s" \
  "<url>"
```

`--embed-metadata` writes the cleaned fields into the file, which is what Navidrome reads.

## Bonus: consistent artist names

The same artist arrives as `ARTIST`, `Artist` and `Artíst` (with or without diacritics). My downloader runs a small post-processing hook via `--exec` that reuses the spelling of an existing artist folder (matching case- and accent-insensitively), and otherwise title-cases ALL-CAPS multi-word names. Single-word all-caps names like ABBA stay as they are.

## What about the old files?

This only fixes **new** downloads. For an existing messy library, a tagger that matches against MusicBrainz, such as **beets** or **MusicBrainz Picard**, is the right tool. Expect partial matches for regional music and singles, which aren't well covered.
