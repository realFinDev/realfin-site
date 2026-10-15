---
title: "A Cloudflare API token that can't hurt you (least privilege, IP lock, expiry)"
description: "How I scoped a Cloudflare API token to one domain, five permissions, my home IP and three months, so automation can manage DNS and redirects without being able to touch billing or the domain itself."
pubDate: 2026-10-15T16:00:00
category: homelab
tags: [cloudflare, security, api, dns]
---

I wanted my home server to manage parts of my Cloudflare setup (DNS records, a redirect rule) from scripts instead of clicking through the dashboard. The tempting shortcut is the **Global API Key** or a token with "all permissions". I didn't, and here's how I scoped it instead.

## Why not "all permissions"

A full-access token can:

- transfer or delete the **domain itself** (Registrar)
- see and change **billing**
- create **new API tokens** and add **members** to the account
- reroute your **email**, change every DNS record, deploy code

The token lives in a file on a home server. If that file ever leaks (a backup, a screenshot, a compromised container), whoever finds it owns everything. Scoping is cheap insurance.

## The token I made

**My Profile → API Tokens → Create Token → Create Custom Token**:

| Scope | Permission | Level |
|---|---|---|
| Zone | Zone | Read |
| Zone | DNS | Edit |
| Zone | Single Redirect | Edit |
| Zone | Transform Rules | Edit |
| Zone | Email Routing Rules | Edit |
| Account | Cloudflare Pages | Edit |

Plus three restrictions that matter as much as the permissions:

1. **Zone Resources → Specific zone → my domain**, not "All zones". Any future domains stay untouchable.
2. **Account Resources → my account only**, not "All accounts".
3. **Client IP Address Filtering → "Is in" → my home IP.** A leaked token is useless from anywhere else. (If your ISP changes your IP, edit the token and click "Use my IP" again.)
4. **TTL**: an end date three months out. Forgotten tokens expire on their own.

The summary screen shows exactly what you're about to grant. Read it: it should name your one domain, not "All zones".

## Store it properly

Don't paste it into chats, tickets or scripts. A file only your user can read:

```bash
mkdir -p ~/.config/cloudflare && chmod 700 ~/.config/cloudflare
nano ~/.config/cloudflare/mydomain.token
chmod 600 ~/.config/cloudflare/mydomain.token
```

And verify it:

```bash
curl -s https://api.cloudflare.com/client/v4/user/tokens/verify \
  -H "Authorization: Bearer $(cat ~/.config/cloudflare/mydomain.token)"
# {"result":{"status":"active"},"success":true,...}
```

## Using it: a www → root redirect

Here's the redirect I set up with it, a permanent 301 from `www` to the bare domain that keeps the path and query string:

```bash
T=$(cat ~/.config/cloudflare/mydomain.token)
ZONE=<zone id>
curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets/phases/http_request_dynamic_redirect/entrypoint" \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" --data '{
  "rules": [{
    "description": "Redirect from WWW to root",
    "expression": "(http.host eq \"www.example.dev\")",
    "action": "redirect",
    "action_parameters": {"from_value": {
      "status_code": 301,
      "target_url": {"expression": "concat(\"https://example.dev\", http.request.uri.path)"},
      "preserve_query_string": true}},
    "enabled": true
  }]}'
```

Note that `PUT` on the entrypoint **replaces all rules in that phase**. Fine for the first rule; for later ones, fetch the ruleset first and add to it.

## If a token leaks anyway

**API Tokens → ⋯ → Roll** gives you a new secret and kills the old one instantly, with the same permissions. Do that the moment a token shows up somewhere it shouldn't, like a screenshot. It happens.
