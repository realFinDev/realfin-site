---
title: "Running a private ChatGPT on a 4 GB GPU: Ollama + Open WebUI + SearXNG"
description: "What actually fits on a GTX 1050 Ti, why I baked the context length into the model, and how to give a local LLM web search with self-hosted SearXNG."
pubDate: 2026-10-15T09:20:00
category: homelab
tags: [ai, ollama, open-webui, searxng, gpu, llm]
---

I wanted a ChatGPT-style assistant that runs at home, keeps my chats private and can search the web. The catch: my server's GPU is a **GTX 1050 Ti with 4 GB of VRAM**. Here's what works on that, and two settings that took me way too long to figure out.

## The stack

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:11434:11434"   # localhost only, it has no authentication
    volumes:
      - ./ollama:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    restart: unless-stopped
    ports:
      - "8090:8080"
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
    volumes:
      - ./open-webui:/app/backend/data

  searxng:
    image: searxng/searxng:latest
    restart: unless-stopped
    volumes:
      - ./searxng:/etc/searxng
```

Note the Ollama port: **`127.0.0.1:11434`**. Ollama's API has no login. Published on `0.0.0.0`, anyone on the network could use your GPU or pull models. Open WebUI reaches it over the internal Docker network anyway, so it doesn't need the host port at all.

## What fits in 4 GB

Rule of thumb: a model needs roughly its size on disk **plus** memory for the context window. On 4 GB:

- **~3B-parameter models** (Llama 3.2 3B and similar, 4-bit quantised) fit comfortably *with* a decent context window.
- **7–8B models** technically load, but spill into system RAM and become painfully slow.

I use a 3B model. It's quick, and fine for summaries, rewriting text and simple questions. It is *not* reliable for facts. Small models make things up with total confidence, and that's a model-size limit, not a config problem.

## Setting 1: bake the context length into the model

By default Ollama uses a small context window, so longer chats or web results get cut off. Open WebUI has a context-length setting, but for me it was **silently ignored**. The reliable way is to create a model variant with the parameter built in:

```bash
docker exec -it ollama sh -c 'cat > /tmp/Modelfile <<EOT
FROM llama3.2:3b
PARAMETER num_ctx 8192
EOT
ollama create llama3.2-8k -f /tmp/Modelfile'
```

Then pick `llama3.2-8k` in Open WebUI. On my card, 8192 tokens of context uses about 3 GB of VRAM, leaving roughly 1 GB spare. Check with `nvidia-smi` before going higher.

## Setting 2: web search needs JSON enabled in SearXNG

Open WebUI can use **SearXNG**, a self-hosted meta search engine, for web search. It didn't work at first, because SearXNG only returns HTML unless you allow JSON. In `searxng/settings.yml`:

```yaml
search:
  formats:
    - html
    - json
```

Then in Open WebUI → Admin → Settings → Web Search, choose **searxng** with the query URL:

```
http://searxng:8080/search?q=<query>
```

One more trap: some of Open WebUI's settings are stored in its **database** after the first save, and the database value wins over environment variables. If an env var seems to do nothing, change the setting in the admin UI instead.

## Sharing the GPU

My 1050 Ti also does Jellyfin's video transcoding. Both work side by side, as long as the AI model leaves some VRAM free. If GPU features suddenly fail after an Ubuntu update, check for an [NVIDIA driver mismatch](/blog/nvidia-driver-mismatch-jellyfin-transcoding/).

## Verdict

A 4 GB card gives you a private, fast, *small* assistant. It's great for text tasks and tinkering, but not a ChatGPT replacement for hard questions. The setup is the same with a bigger GPU, though: just pull a larger model.
