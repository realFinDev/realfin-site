---
title: "Roblox DataStores without data loss: retries, UpdateAsync and BindToClose"
description: "Player data loss is the bug that kills Roblox games. The patterns that prevent it: UpdateAsync over SetAsync, retry with backoff, saving on shutdown and session locking."
pubDate: 2026-10-15T06:00:00
category: roblox
tags: [roblox, luau, datastore, saving]
---

Nothing makes players quit faster than losing their progress. DataStores look simple: `GetAsync`, `SetAsync`, done. That simple version loses data in a few very common situations. These are the patterns I use in my game.

## 1. Every DataStore call can fail

DataStore calls go over the network and **will** fail sometimes: throttling, outages, timeouts. Unwrapped, an error simply stops your script. Always use `pcall` and retry:

```lua
--!strict
local function retry<T>(fn: () -> T, attempts: number?): (boolean, T?)
    local tries = attempts or 5
    for i = 1, tries do
        local ok, result = pcall(fn)
        if ok then return true, result end
        warn(`DataStore attempt {i} failed: {result}`)
        task.wait(2 ^ i) -- 2, 4, 8, 16 s: exponential backoff
    end
    return false, nil
end
```

## 2. Never overwrite data you failed to load

The most common data-loss bug:

1. `GetAsync` fails (or the player's data doesn't load in time)
2. the script carries on with **default data**
3. on leave, it **saves the defaults over the real data**

Fix: track whether loading succeeded, and **never save** a profile that didn't load:

```lua
local ok, data = retry(function() return store:GetAsync(key) end)
if not ok then
    player:Kick("Couldn't load your data. Please rejoin.")
    return
end
profiles[player] = { data = data or defaultData(), loaded = true }
```

Kicking feels harsh, but it's far better than wiping someone's progress.

## 3. Prefer UpdateAsync over SetAsync

`SetAsync` blindly overwrites. `UpdateAsync` gives you the current stored value first, so you can refuse to save over something newer, for example using a version counter:

```lua
store:UpdateAsync(key, function(old)
    if old and old.version and old.version > profile.data.version then
        return nil -- stored data is newer: cancel this write
    end
    profile.data.version += 1
    return profile.data
end)
```

## 4. Save on shutdown with BindToClose

When a server shuts down (an update, or the last player leaves), `PlayerRemoving` may not get time to finish saving. `game:BindToClose` gives you up to ~30 seconds:

```lua
game:BindToClose(function()
    for player, profile in profiles do
        task.spawn(saveProfile, player, profile)
    end
    -- wait until all saves finish (or the time runs out)
    while next(profiles) do task.wait(0.5) end
end)
```

Remove each profile from `profiles` when its save completes, so the loop can end.

## 5. Autosave

Save every few minutes as well, so a crash costs minutes, not a whole session. Stagger the saves so you don't hit DataStore limits all at once.

## 6. Session locking (when players hop servers)

If a player leaves server A and joins server B quickly, B can load **old** data before A's final save lands. A session lock stores "server X owns this profile" in the data (via `UpdateAsync`) and makes B wait or retry until the lock is released or expires. Libraries like ProfileStore or ProfileService implement this properly. For anything beyond a hobby game, using one is wiser than writing your own.

## 7. Version your data format

Store a `schemaVersion` and migrate old data when it loads. Your data format *will* change as the game grows.

## Testing it

Test saving in Studio with **"Enable Studio Access to API Services"** turned on. Use a separate test DataStore name, so testing never touches real player data.
