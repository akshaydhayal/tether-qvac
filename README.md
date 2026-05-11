# ⚡ Sovereign — Local Multimodal AI Terminal Workspace

> **Fully offline. No API keys. No cloud. Runs on your machine.**

Sovereign is a TUI-first AI workspace that lets you chat, analyze images (OCR), transcribe audio, and summarize documents — all powered by [QVAC](https://qvac.tether.io) running entirely on-device.

Built for the **[Tether Frontier Hackathon](https://earn.superteam.fun)** — QVAC side track.

---

## ✨ Features

| Capability | QVAC Module | Description |
|---|---|---|
| **Local LLM Chat** | `llm-llamacpp` | Stream chat with Llama 3.2 1B — fully offline |
| **Image OCR** | `ocr-onnx` | Extract text from screenshots and images |
| **Audio Transcription** | `transcription-whispercpp` | Transcribe meetings, voice notes with Whisper |
| **File Summarization** | `llm-llamacpp` | Drop any text file, get an AI summary |
| **Multimodal Context** | Combined | Ask the LLM about OCR results or transcripts |

---

## 🚀 Quick Start

### Requirements
- **Node.js ≥ 22.17** — [Download](https://nodejs.org)
- **~1GB free RAM** (Llama 1B) + **~200MB** for Whisper + OCR models
- **GPU drivers with Vulkan support** (QVAC uses Vulkan for hardware acceleration)
  - macOS: built-in Metal (Vulkan via MoltenVK — verify with `vulkaninfo --summary`)
  - Linux: install GPU drivers + `sudo apt install libvulkan1`
- **ffmpeg** (for audio conversion): `brew install ffmpeg` / `sudo apt install ffmpeg`

### Install

```bash
# Clone the repo
git clone https://github.com/your-username/sovereign
cd sovereign

# Install dependencies
npm install
```

### Step 1: Download Models

```bash
npx tsx src/cli/index.ts setup
```

This will:
1. ✅ Check Node.js version and available RAM
2. 📥 Download **Llama 3.2 1B** (~700MB) — cached after first run
3. 📥 Download **Whisper Tiny** (~75MB)
4. 📥 Download **OCR models** (~100MB)

> Models are cached locally by QVAC. Subsequent starts are instant.

### Step 2: Launch

```bash
# Launch the TUI workspace
npx tsx src/cli/index.ts

# Or install globally
npm link
sovereign setup
sovereign
```

---

## 🖥️ TUI Controls

```
┌──────────────┬──────────────────────────────────────┬──────────────────┐
│  📁 FILES    │  💬 CONVERSATION                     │  📝 METADATA     │
│              │                                       │                  │
│  image.png   │  You │ Explain this screenshot        │  OCR TEXT        │
│  meeting.mp3 │  AI  │ The image shows a terminal...  │  Hello World     │
│  notes.txt   │                                       │  SOVEREIGN v0.1  │
│              │  ─────────────────────────────────    │                  │
│              │  › type message here                  │  ⚡ STATS        │
└──────────────┴──────────────────────────────────────┴──────────────────┘
[CHAT]  Tab: mode  Ctrl+F: files  Ctrl+L: clear  Ctrl+C: quit
```

| Key | Action |
|---|---|
| `Tab` | Switch mode: CHAT → OCR → TRANSCRIBE |
| `Ctrl+F` | Toggle focus between file browser and chat |
| `↑ ↓` | Navigate file browser |
| `Enter` | Select file (auto-routes by type: image → OCR, audio → transcribe) |
| `Ctrl+C` | Quit and unload models |

---

## 💻 CLI Subcommands

```bash
# One-shot chat
sovereign chat "Explain quantum computing in one sentence"

# Interactive chat session
sovereign chat --interactive

# OCR an image
sovereign ocr screenshots/dashboard.png

# Transcribe audio
sovereign transcribe meeting.mp3 --timestamps

# Summarize a document
sovereign summarize report.pdf --length short

# Download/refresh models
sovereign setup
```

---

## 📁 Project Structure

```
sovereign/
├── src/
│   ├── engine/        # QVAC SDK wrappers (LLM, OCR, Whisper)
│   │   ├── qvac.ts    # Singleton model lifecycle manager
│   │   ├── chat.ts    # Streaming LLM completion
│   │   ├── ocr.ts     # Image text extraction
│   │   └── transcribe.ts  # Whisper speech-to-text
│   ├── tui/           # Ink React TUI components
│   │   ├── App.tsx    # Root three-panel layout
│   │   ├── panels/    # FilePanel, ChatPanel, MetaPanel
│   │   ├── components/# StatusBar
│   │   └── hooks/     # useQvac, useFileWatcher
│   ├── cli/           # Commander.js subcommands
│   │   ├── index.ts   # Entry point
│   │   └── commands/  # setup, chat, ocr, transcribe, summarize
│   └── utils/         # audio.ts, fileDetect.ts, format.ts
├── uploads/           # Drop files here
│   ├── images/
│   ├── audio/
│   └── docs/
└── bin/sovereign.js   # Global binary
```

---

## 🏗️ Architecture

```
sovereign (TUI/CLI)
    │
    ▼
Engine Layer (src/engine/)
    │
    ├─ chat.ts  ──────► @qvac/sdk completion()    → Llama 3.2 1B (local)
    ├─ ocr.ts   ──────► @qvac/sdk ocr()           → CRAFT + Latin OCR (local)
    └─ transcribe.ts ►  @qvac/sdk transcribe()    → Whisper Tiny (local)
                                │
                         QVAC Worker Process
                         (Vulkan GPU / CPU)
                         No internet required
```

---

## 🔒 Why QVAC?

| Traditional AI | Sovereign + QVAC |
|---|---|
| API keys required | ✅ No keys |
| Data sent to cloud | ✅ Data never leaves device |
| Subscription cost | ✅ Free after download |
| Requires internet | ✅ Fully offline |
| Central point of failure | ✅ Runs anywhere |

---

## 🏆 Hackathon Submission

**Track:** Tether Frontier Hackathon — QVAC Side Track  
**QVAC Integrations:**
- `@qvac/llm-llamacpp` — Local LLM inference (chat, summarization, multimodal analysis)
- `@qvac/ocr-onnx` — Offline OCR on any image
- `@qvac/transcription-whispercpp` — Local speech-to-text with Whisper

---

## License

MIT
