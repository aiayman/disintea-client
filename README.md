# Disintea

A private, self-hosted voice & chat desktop app. 1-on-1 calls, screen sharing with audio, persistent text chat — no third-party servers required.

Built with **Tauri v2 + React 19 + TypeScript**.

---

## Features

- 🎙 **Voice calls** — crystal-clear 1-on-1 audio via WebRTC
- 🖥 **Screen sharing** — share your screen with system audio captured
- 💬 **Persistent chat** — text messages stored server-side, full history on reconnect
- 🔴 **Push-to-talk** — bind one or more keys; works in the foreground (doesn't interfere with typing)
- 🔇 **Complete mute** — overrides PTT, disables mic entirely
- 🔔 **Unread badges** — bold name + indicator dot when messages arrive while chat isn't open
- 🔑 **Contact-based** — add contacts by their ID; no accounts, no email, no phone number
- 🌙 **Dark theme** — minimal Tailwind CSS UI

---

## Stack

| Layer | Tech |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) (Rust) |
| UI | React 19 + TypeScript + Tailwind CSS v4 |
| Build | Vite 7 + pnpm |
| State | Zustand 5 (persisted to localStorage) |
| P2P media | WebRTC (browser API via Tauri webview) |
| Signaling | Custom Rust/Axum WebSocket server |
| NAT traversal | coturn TURN server |
| PTT hotkeys | `tauri-plugin-global-shortcut` (OS-level, background) |
| Settings persistence | `tauri-plugin-store` |

---

## Development

### Prerequisites

- Rust stable (via `rustup`)
- Node.js 22 + pnpm
- Linux: `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Run in dev mode

```bash
pnpm install

export SIGNALING_URL="ws://localhost:8080/ws"
export TURN_URL="turn:your.domain.com:3478"
export TURN_SECRET="your-shared-secret"

pnpm tauri dev
```

### Build

```bash
SIGNALING_URL="wss://your.domain.com/ws" \
TURN_URL="turn:your.domain.com:3478" \
TURN_SECRET="your-secret" \
pnpm tauri build
```

---

## Configuration

These are baked into the binary at **compile time**:

| Variable | Default | Description |
|---|---|---|
| `SIGNALING_URL` | `ws://localhost:8080/ws` | WebSocket signaling server URL |
| `TURN_URL` | `turn:your.domain.com:3478` | coturn TURN server |
| `TURN_SECRET` | `change-me` | Shared HMAC secret for coturn credentials |

---

## Releasing

Push a `v*` tag — GitHub Actions builds and uploads platform installers automatically:

```bash
git tag v1.2.3 && git push origin v1.2.3
```

The CI workflow injects the tag version into `tauri.conf.json` before building, so installer filenames always match the tag.

| Platform | Output |
|---|---|
| Windows | `.msi` + `.exe` (NSIS) |
| Linux | `.AppImage` + `.deb` |

---

## Project Structure

```
src/
  App.tsx                      ← routing + wires all hooks together
  store/
    appStore.ts                ← Zustand store: contacts, call state, chat, PTT, settings
  hooks/
    useSignaling.ts            ← WebSocket connection + server message dispatch
    useWebRTC.ts               ← RTCPeerConnection lifecycle, tracks, screen share
    usePushToTalk.ts           ← PTT key registration and mic gate
    useRingtone.ts             ← ringtone playback for call states
  components/
    IdentitySetup.tsx          ← first-run: set display name
    ContactList.tsx            ← main screen: contacts, status, unread badges
    ChatPanel.tsx              ← text chat with history
    CallScreen.tsx             ← active call: mute, PTT, screen share, hang up
    IncomingCallOverlay.tsx    ← incoming call ring + accept/reject
    Settings.tsx               ← PTT key binding + mic mode
src-tauri/src/
  lib.rs                       ← Tauri commands: get_server_config, get_turn_credentials
  main.rs                      ← entry point
```

