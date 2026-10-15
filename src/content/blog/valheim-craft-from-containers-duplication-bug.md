---
title: "Why my Valheim 'craft from chests' mod crafted 70 muckshakes from one click"
description: "A craft-from-containers mod took only the first ingredient and kept crafting until my inventory was full. I decompiled it, found a one-line reflection bug, and wrote a small client-side replacement."
pubDate: 2026-10-15T23:25:00
category: game-servers
tags: [valheim, mods, bepinex, harmony, csharp, debugging]
---

I clicked **Craft** once at the cauldron. Muckshake costs 1 ooze, 2 raspberries and 2 blueberries. I had six blueberries, so I could make three at most.

I got about seventy. The ooze went down, the berries didn't move, and the cauldron kept crafting until every free slot in my inventory was full of muckshakes. The same thing happened with carrot soup: mushrooms gone, carrots untouched, a few dozen soups.

The mod responsible was a popular "craft from containers" mod (a reupload of an older mod, version 3.5.8). It lets crafting stations use ingredients from nearby chests. Here's what was going on, and the replacement I wrote.

## Looking inside the mod

BepInEx mods are ordinary .NET DLLs, so you can decompile them with [ILSpy](https://github.com/icsharpcode/ILSpy) (I used the command-line `ilspycmd` in a Docker container). The interesting part is its replacement for the game's `Player.ConsumeResources`, which removes a recipe's ingredients. After taking items out of a chest, it does this:

```csharp
typeof(Container).GetMethod("Save", BindingFlags.Instance | BindingFlags.NonPublic)
    .Invoke(container, new object[0]);
typeof(Inventory).GetMethod("Changed", BindingFlags.Instance | BindingFlags.NonPublic)
    .Invoke(inventory, new object[0]);
```

It calls the game's private `Inventory.Changed()` method by reflection, with **no arguments**. That's how the method looked when the mod was written. In the current game it looks like this:

```csharp
private void Changed(bool success = false, bool cheatedStateChanged = false)
```

C# fills in default parameter values at **compile time**. Reflection doesn't: `MethodInfo.Invoke` with an empty argument array for a two-parameter method throws a `TargetParameterCountException`. The game added two optional parameters, the mod still compiles and loads fine, and it crashes the first time it takes something from a chest.

## Why one crash became seventy crafts

That alone would explain "only the first ingredient was used": the exception aborts the loop as soon as it takes an ingredient from a chest. But why did it keep going?

Here's the end of the game's own crafting update, slightly simplified:

```csharp
m_craftTimer += dt;
if (m_craftTimer >= craftDuration)
{
    DoCrafting(player);
    m_craftTimer = -1f;
}
```

And inside `DoCrafting`, the order is:

1. Check that you have the ingredients.
2. **Add the crafted item** to your inventory.
3. **Remove the ingredients** (`ConsumeResources`, where the mod crashes).

So the item is already in your bag when the exception hits. The exception jumps out of `DoCrafting`, `m_craftTimer = -1f` never runs, and the timer stays "finished". On the next frame the game calls `DoCrafting` again. The berries are still there, so the check passes, it adds another muckshake, takes another ooze, crashes again… every single frame.

It only stops when the inventory is full. Then `DoCrafting` returns early ("can't add item") without reaching the crash, and the timer is finally reset.

One stale reflection call, and a crafting bench turned into an item duplicator.

## A second problem: chests you don't own

While reading the code I noticed something else. The mod edits the chest's inventory and saves it **without checking who owns the chest**.

In Valheim, every object in the world is owned by one client at a time (usually the player whose PC simulates that area, see [how areas are simulated](/blog/valheim-server-lag-better-networking/)). Only the owner's changes count. The game's own `Container` only saves when it's the owner:

```csharp
private void OnContainerChanged()
{
    if (!m_loading && IsOwner())
        Save();
}
```

When you open a chest normally, the game first asks the current owner to hand it over. A mod that skips that step can make changes that get overwritten by the real owner's copy, so items come back, or a friend who has the chest open at that moment sees a conflicting version. In a multiplayer base that's an easy way to lose or duplicate items.

## Writing a replacement

I wanted the same convenience without either problem, so I wrote a small client-side BepInEx mod, **[ChestCrafting](https://github.com/realFinDev/ChestCrafting)** (MIT licensed, source and install steps on GitHub). Only the player using it needs it, not the server or the other players. The idea is to change as little as possible:

**1. Don't replace the game's crafting logic. Just extend the player's inventory at the right moments.** The game checks and removes ingredients through `Inventory.CountItems` and `Inventory.RemoveItem`. The mod patches those two (with [Harmony](https://harmony.pardeike.net/)), and only while the game is inside a crafting or building check, and only for the local player's inventory:

```csharp
[HarmonyPatch(typeof(Inventory), nameof(Inventory.CountItems))]
static class CountItemsPatch
{
    static void Postfix(Inventory __instance, string name, int quality, bool matchWorldLevel, ref int __result)
    {
        if (!Chests.Applies(__instance) || name == null) return;
        foreach (Container c in Chests.Nearby())
            __result += c.GetInventory().CountItems(name, quality, matchWorldLevel);
    }
}
```

Everything else stays vanilla: the order of ingredients, multi-crafting (Shift ×5), upgrades, the craft timer. If the game changes how crafting works, the mod is unaffected, because it only changes what "how many do I have?" and "remove these" mean.

**2. Remove from your own bag first, then from the nearest chests, through the public API.** No reflection on private methods, so no `Changed()` time bomb. The game's own `RemoveItem` fires the change event, and the chest saves itself.

**3. Take ownership like the game does.** Before removing anything from a chest:

```csharp
ZNetView nview = NView(c);
if (!nview.IsOwner()) nview.ClaimOwnership();
if (!nview.IsOwner()) continue;
```

And chests are skipped entirely when:

- **someone else has it open** right now,
- it's **another player's private chest**,
- it's in a **warded area you don't have access to**,
- it's a **gravestone**. Building a wall out of a friend's death loot would be a bad look.

**4. Exceptions can't leave it half-active.** The "we're in a crafting check" state is a counter that's increased in a Harmony `Prefix` and decreased in a `Finalizer`, which runs even if something throws.

## Testing

The first test was the muckshake again: ooze in my bag, berries in a chest. One click gave **one** muckshake, and ooze −1, raspberries −2 and blueberries −2. The berries came out of the chest.

Every crafting station uses the same `UpdateRecipe` → `DoCrafting` → `ConsumeResources` path, so the workbench, forge, cauldron, stonecutter and the rest are all covered by those few patches. Smelters, kilns and fermenters aren't. They don't use the crafting window, and loading them is a different job.

## Lessons

- **Reflection on private game methods is fragile.** Optional parameters, renames or overloads won't show up as compile errors, only as runtime exceptions in someone's save.
- **A crash in the middle of a game loop is worse than a crash.** Here an exception that skipped one line (`m_craftTimer = -1f`) turned "crafting failed" into "crafting repeats forever".
- **In a multiplayer game, ask who owns the data before you change it.**
- **When a mod misbehaves, decompile it.** It took ten minutes to go from "weird bug" to the exact line, and it's the best way to tell whether a mod is safe on a shared server.

**Get it:** [ChestCrafting on GitHub](https://github.com/realFinDev/ChestCrafting). Download `ChestCrafting.dll` from Releases and put it in `BepInEx/plugins`. Found a bug? [Open an issue](https://github.com/realFinDev/ChestCrafting/issues).

Earlier in this series: [which Valheim mods need to be on the server and which don't](/blog/valheim-mods-client-vs-server/).
