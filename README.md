<p align="center">
  <img src="public/logo.png" alt="SubMaker Logo" width="120"/>
</p>

<h1 align="center">SubMaker</h1>

<p align="center">
  <b>AI-Powered Subtitle Translation for Stremio</b><br/>
  Watch any content in your language. Fetch subtitles from multiple sources, translate instantly with AI — without ever leaving your player.
</p>

<p align="center">
  <a href="https://www.gnu.org/licenses/agpl-3.0"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=flat-square" alt="License: AGPL v3"/></a>
  <img src="https://img.shields.io/badge/node-22.12%2B%20%7C%2024-brightgreen?style=flat-square" alt="Node 22.12+ or 24"/>
  <img src="https://img.shields.io/badge/Stremio-Addon-purple?style=flat-square" alt="Stremio Addon"/>
  <img src="https://img.shields.io/badge/languages-433-orange?style=flat-square" alt="433 Languages"/>
  <img src="https://img.shields.io/badge/AI-10%2B%20providers-ff69b4?style=flat-square" alt="10+ AI Providers"/>
</p>

<p align="center">
  <a href="#-try-it-now">Try It Now</a> •
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-troubleshooting">Troubleshooting</a>
</p>

---

## 🎉 Try It Now

**No setup required!**

### **[https://submaker.elfhosted.com](https://submaker.elfhosted.com?utm_source=github&utm_medium=readme&utm_campaign=stremiosubmaker-readme)**

Configure, install, done. A huge thanks to [ElfHosted](https://elfhosted.com?utm_source=github&utm_medium=readme&utm_campaign=stremiosubmaker-readme) for the free community hosting!

Check their [FREE Stremio Addons Guide](https://stremio-addons-guide.elfhosted.com/?utm_source=github&utm_medium=readme&utm_campaign=stremiosubmaker-readme) for more great addons and features!

> For self-hosting, see [Quick Start](#-quick-start) below.

---

## ✨ Features

| Category | Highlights |
|----------|------------|
| **Languages** | 197 supported languages (433 for translation) |
| **Interface** | English, Spanish, Portuguese, Arabic, and Hungarian (`hu`/`hu-HU`) |
| **Subtitle Sources** | OpenSubtitles, SubDL, SubSource, Wyzie, Stremio Community, Subs.ro |
| **AI Translation** | 10+ providers: Gemini, OpenAI, Claude, DeepL, DeepSeek, Grok, Mistral, OpenRouter, Cloudflare, Custom/Local |
| **Smart Caching** | Shared translation database — translate once, benefit everyone |
| **Timestamp Workflows** | XML Tags, JSON, Numbered Timestamps, Send Timestamps to AI |
| **No-Translation Mode** | Just fetch subtitles without translation |
| **Subtitle Studio** | Repair, shift, FPS-convert, rewrap, and safely search/replace SRT files locally |
| **Statistics & Performance** | Translation success, speed, cache, storage, workload, and hardware health dashboard |

---

### 🧪 Subtitle Studio

Open **Sub Toolbox → Subtitle Studio** to work on SRT files without uploading their
content. The studio provides:

1. Structural validation and safe repair
2. Exact positive or negative timing shifts
3. Source-to-target FPS conversion
4. Smart one-to-four-line text wrapping
5. Literal or regular-expression find and replace

Live diagnostics flag malformed blocks, overlaps, invalid durations, ordering
problems, long lines, and fast reading speed. Drag-and-drop, undo/redo, copy,
UTF-8 download, mobile controls, and local draft recovery are built in. Files over
5 MB are rejected to keep browser processing responsive.

---

### 📊 Statistics & Performance

After saving a configuration, use the **Translation History** and
**Statistics & Performance** shortcuts directly below the main SubMaker header.
They are also available as separate items in every tool-page navigation menu.

The statistics dashboard shows recent success/failure rates, translation duration,
cache effectiveness, active jobs, provider and target-language usage, seven-day
activity, Redis/filesystem cache utilization, sessions, HTTP connections, process
CPU and memory, system memory pressure, event-loop delay, uptime, and runtime
architecture. It refreshes every 30 seconds by default and keeps the last successful
snapshot visible if a refresh fails.

The endpoint requires a valid configuration token and never returns provider API
keys, Redis credentials, or the complete user configuration.

---

### 🌍 Subtitle Sources

| Provider | Auth Required | Notes |
|----------|---------------|-------|
| OpenSubtitles | Optional (recommended) | V3 or authenticated mode |
| SubDL | API key | [subdl.com/panel/api](https://subdl.com/panel/api) |
| SubSource | API key | [subsource.net](https://subsource.net/) |
| Wyzie Subs | API key | [sub.wyzie.io/redeem](https://sub.wyzie.io/redeem) |
| Stremio Community Subtitles | None | Curated subtitles (beta) |
| Subs.ro | API key | Romanian subtitles (beta) |

### 🤖 AI Translation Providers

| Provider | Notes |
|----------|-------|
| **Google Gemini** | Default: stable Gemini 3.1 Flash-Lite; key rotation and structured JSON supported |
| OpenAI | GPT models |
| Anthropic | Claude models |
| DeepL | Traditional translation API |
| DeepSeek | |
| XAI (Grok) | |
| Mistral | |
| OpenRouter | Access multiple models |
| Cloudflare Workers AI | |
| Google Translate | Unofficial, no key needed |
| Custom | Ollama, LM Studio, LocalAI, any OpenAI-compatible API |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 22.12+ or 24 LTS — [nodejs.org](https://nodejs.org)
- **Gemini API Key** — [Get free](https://aistudio.google.com/app/api-keys)
- At least one subtitle provider key (optional but recommended)

### Installation

```bash
# Clone this maintained fork and install its locked dependencies
git clone https://github.com/kbarni05/StremioSubMaker.git
cd StremioSubMaker
npm ci

# Linux/macOS: create and configure .env
cp .env.example .env
# Set STORAGE_TYPE=filesystem for a single-machine install and add your API key.

# Start the server
npm start
```

On Windows PowerShell, create the environment file with:

```powershell
Copy-Item .env.example .env
```

Then set `STORAGE_TYPE=filesystem` in `.env`, start with `npm start`, and verify
`http://localhost:7001/health`. Keep `.env`, `data/`, and the generated encryption
key out of source control.

For Docker, Redis/HA deployment, upgrades, and syncing this fork with upstream,
see the **[complete installation and update guide](docs/INSTALLATION.md)**.

### 🐳 Docker

📦 **[See complete Docker deployment guide →](docs/DOCKER.md)**

```bash
docker pull ghcr.io/kbarni05/stremiosubmaker:latest
```

### Open Configuration

Visit: **http://localhost:7001**

---

## 🎯 How It Works

```
1. Install SubMaker in Stremio
2. Play content → the subtitle list shows one translation group per target language
3. Open the group (for example `Make Hungarian`) and choose the source subtitle at the matching position
4. Wait ~1-3 minutes → AI translates in batches
5. Reselect the subtitle → Now translated!
6. Next time? Instant — cached in database
```

Stremio addons can return subtitle `id`, `url`, and `lang` fields, but cannot inject
arbitrary custom controls into the native player. Stremio also uses `lang` as the
grouping key, so every source entry for the same target language intentionally shares
one concise, localized label. The individual source mapping remains unique through
each entry's `id`, `url`, and deterministic list position.

### Configuration Steps

1. **Add Subtitle Sources API keys**
2. **Add Gemini API Key** (required for translation)
3. **Select source languages** (translate from)
4. **Select target languages** (translate to)
5. **Click "Install in Stremio"** or copy the URL

### Pro Tips

| Tip | Description |
|-----|-------------|
| **Single source language** | Keeps subtitle order consistent |
| **Test sync first** | Try original subtitle before translating |
| **Triple-click** | Forces re-translation if result looks wrong |
| **Use Flash-Lite** | Fastest model, check rate limits |

---

## ⚙️ Configuration Guide

### Sections Overview

| Section | Purpose |
|---------|---------|
| **API Keys** | Subtitle providers and AI translation keys |
| **Languages** | Source (translate from) and target (translate to) |
| **Settings** | Translation behavior, workflows, and caching |

### Key Settings

| Setting | Recommendation |
|---------|----------------|
| Translation Workflow | "XML Tags" for best sync |
| Database Mode | "Use SubMaker Database" for shared caching |
| Provider Timeout | 12s default, increase to 30s for SCS/Wyzie |
| Mobile Mode | Complete Android/iOS delivery with a configurable 2–10 minute wait |

### Advanced Mode

Enable "Advanced Mode" in Other Settings to unlock:
- Batch Context (surrounding context for coherence)
- Mismatch Retries (retry on wrong entry count)
- Gemini Parameters (temperature, top-p, thinking budget)

Gemini 2.5 and Gemini 3.x use different thinking controls. Keep the default value
unless you need to tune it: the UI sends token budgets to 2.5 models and safely
maps the same control to low/medium/high thinking for 3.x. Internal model thoughts
are never included in subtitle output.

---

## 🐛 Troubleshooting

> **📖 Full Guide:** [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

### ⏱️ Subtitles Out of Sync?

Test other **Translation Workflow** in Settings:
| Workflow | Description |
|----------|-------------|
| **XML Tags** (default) | Uses XML id tags for reconstruction |
| **Original Timestamps** | Reattaches original timecodes using numbered entries |
| **Send Timestamps to AI** | Trusts AI to preserve timecodes |

### 🔄 Bad / Broken Translation?

1. **Force re-translation** — Triple-click the subtitle (within 6 seconds)
2. **Try a different model** — Switch between Flash-Lite, Flash, or others
3. **Bypass cache** — Enable "Bypass Cache" in Translation Settings

### ❌ Translation Fails / Rate Limits?

1. **Validate API key** — Test at [Google AI Studio](https://aistudio.google.com)
2. **Switch model** — Gemma 27b has higher rate limits than Flash
3. **Enable key rotation** — Add multiple Gemini keys
4. **Use secondary provider** — Enable fallback provider

### 📱 Android / Mobile Issues?

1. **Enable Mobile Mode** — Check “Mobile Mode (complete delivery)” in Other Settings
2. **Choose the maximum wait** — Four minutes is recommended; slower/local models can use 6–10 minutes
3. **Select the 📱 entry** — Repeated requests share one translation and return only the complete subtitle
4. **If the limit is reached** — Translation continues; reopen the video/list and select the same source entry inside the target-language group
5. **Use Flash-Lite** — Usually the fastest option for mobile

Mobile Mode’s total wait is separate from an individual AI request timeout. Self-hosted
reverse proxies must allow a response to remain open for the selected duration. The
server refreshes the mobile subtitle URL after completion/failure so reopening the
stream does not reuse an older Stremio-cached response.

### 💾 Configuration Not Saving?

1. **Verify Token** — Ensure installed token matches config page
2. **Hard refresh** — `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac)
3. **Check console** — `F12` → Console for errors
4. **Try incognito** — Rules out extension conflicts

### ⚡ Reset Everything

Click the **Reset** button at the bottom of the config page.

---

## 🙏 Acknowledgments

**Built With**
- [Stremio Addon SDK](https://github.com/Stremio/stremio-addon-sdk) — Addon framework
- [OpenSubtitles](https://www.opensubtitles.com/) — Primary subtitle database
- [SubDL](https://subdl.com/) — Alternative subtitle source
- [SubSource](https://subsource.net/) — Alternative subtitle source
- [Google Gemini](https://ai.google.dev/) — AI translation

**Special Thanks**
- Stremio team for excellent addon SDK
- Google for free Gemini API access
- All subtitle communities
- [ElfHosted](https://elfhosted.com/?utm_source=github&utm_medium=readme&utm_campaign=stremiosubmaker-readme) — Free community hosting

---

## 📧 Support

| Channel | Link |
|---------|------|
| **Issues & Bugs** | [Open an issue](https://github.com/kbarni05/StremioSubMaker/issues) |
| **Documentation** | Open `/configure` for the live interactive config/help page |
| **Community** | [Stremio Discord](https://discord.gg/stremio) • [r/StremioAddons](https://reddit.com/r/StremioAddons) |

---

<p align="center">
  <b>SubMaker</b> — Watch anything. Understand everything.<br/>
  <sub>Made with ❤️ for the Stremio community</sub>
</p>

<p align="center">
  <a href="https://github.com/kbarni05/StremioSubMaker">⭐ Star this fork</a> •
  <a href="https://github.com/kbarni05/StremioSubMaker/issues">🐛 Report Bug</a> •
  <a href="https://github.com/kbarni05/StremioSubMaker/issues">✨ Request Feature</a>
</p>
