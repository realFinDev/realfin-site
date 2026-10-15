---
title: "Roblox RemoteEvents: never trust the client (a checklist for AI-written code)"
description: "Exploiters can fire any RemoteEvent with any arguments. The validation every remote needs, and the mistakes AI coding assistants make by default."
pubDate: 2026-10-15T06:20:00
category: roblox
tags: [roblox, luau, security, remote-events, ai-coding]
---

I'm building a Roblox game with AI as a coding partner. AI is great at producing working gameplay code quickly. It's also very good at producing code that **trusts the client**, which on Roblox means trusting exploiters. This is the checklist I use on every RemoteEvent and RemoteFunction.

## Why the client can't be trusted

Everything in a LocalScript runs on the player's device. Exploit tools let players:

- fire **any** RemoteEvent, at any time, as often as they like
- pass **any arguments**: wrong types, huge numbers, other players' objects, `nil`
- read and change anything on their own client

So the server must treat every remote call as a **request**, never as a fact.

## The classic AI mistake

Ask for "a shop where the client tells the server to buy an item" and you'll often get something like:

```lua
-- ❌ Server trusts the client completely
BuyItem.OnServerEvent:Connect(function(player, itemName, price)
    player.leaderstats.Coins.Value -= price
    giveItem(player, itemName)
end)
```

An exploiter sends `price = -1000000` and gains coins, or buys an item that isn't for sale.

## The fixed version

```lua
--!strict
local ITEMS = {
    Sword = { price = 100 },
    Shield = { price = 150 },
}
local lastPurchase: { [Player]: number } = {}

BuyItem.OnServerEvent:Connect(function(player: Player, itemName: unknown)
    -- 1. Validate types: never assume what the client sent
    if typeof(itemName) ~= "string" then return end

    -- 2. Look up data on the SERVER; the client never sends prices
    local item = ITEMS[itemName]
    if not item then return end

    -- 3. Rate limit
    local now = os.clock()
    if lastPurchase[player] and now - lastPurchase[player] < 0.5 then return end
    lastPurchase[player] = now

    -- 4. Check server-side state
    local coins = player:FindFirstChild("leaderstats")
        and player.leaderstats:FindFirstChild("Coins")
    if not coins or coins.Value < item.price then return end

    -- 5. Act
    coins.Value -= item.price
    giveItem(player, itemName)
end)

game.Players.PlayerRemoving:Connect(function(p) lastPurchase[p] = nil end)
```

## The checklist

For every remote handler:

1. **Type-check every argument** with `typeof()`. Treat them as `unknown`.
2. **Never accept values the server can work out itself**: prices, damage, rewards, positions of things the server controls.
3. **Validate ranges and ownership.** Is the target actually in range? Does the player own that item? Is the number finite and sensible?
4. **Rate-limit** anything that can be spammed.
5. **Check server state** (cooldowns, currency, inventory), never a client-reported version of it.
6. **Clean up per-player tables** on `PlayerRemoving`, or they leak memory.
7. **RemoteFunctions**: never `InvokeClient` and wait on the server. A client can simply never answer.

Shortcut: the [RemoteEvent validator generator](/tools/roblox-remote-validator/) writes steps 1, 3, 4 and 6 for you from a short description of the arguments.

## How I use AI for this

- I ask for the feature **and** say "the server must not trust any argument; validate types, ownership, ranges and rate-limit."
- I review every `OnServerEvent` / `OnServerInvoke` myself before it ships. That's the one place I never just accept generated code.
- `--!strict` Luau typing catches a lot of sloppy assumptions early.

AI writes the code fast. Making sure it's safe is still my job.
