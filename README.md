# dismony-client

Desktop voice call + screen sharing app — Discord without servers. Built with Tauri v2 + React + TypeScript.

## Features
- 🎙 **Voice calls** — 1-on-1 (expandable to small groups)
- 🖥 **Screen sharing** — share any window via `getDisplayMedia`
- 🔴 **Push-to-talk** — configure one or more global hotkeys (works even when window is minimized)
- 🔇 **Complete mute** — overrides PTT, disables mic entirely
- 🔑 **Room codes** — invite-code based, no accounts required
- 🌙 **Dark theme** — minimal Tailwind CSS UI

## Stack
- [Tauri v2](https://tauri.app) — Rust shell + webview
- React 18 + TypeScript — UI
- Vite — frontend build
- Zustand — client state
- `tauri-plugin-global-shortcut` — OS-level PTT hotkeys
- `tauri-plugin-store` — persist PTT bindings
- WebRTC (browser API) — audio/video/screen P2P
- coturn — TURN server for NAT traversal

## Development

### Prerequisites
- Rust (via `rustup`) + stable toolchain
- Node.js 22 + pnpm
- Linux: `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

### Running

```bash
pnpm install

# Set signaling server URL and TURN config
export SIGNALING_URL="ws://localhost:8080/ws"
export TURN_URL="turn:your.domain.com:3478"
export TURN_SECRET="your-shared-secret"

pnpm tauri dev
```

### Building

```bash
SIGNALING_URL="wss://your.domain.com/ws" \
TURN_URL="turn:your.domain.com:3478" \
TURN_SECRET="your-secret" \
pnpm tauri build
```

## Configuration

The Tauri Rust backend reads these at **compile time** (baked into the binary):

| Variable | Default | Description |
|---|---|---|
| `SIGNALING_URL` | `ws://localhost:8080/ws` | WebSocket signaling server URL |
| `TURN_URL` | `turn:your.domain.com:3478` | coturn server URL |
| `TURN_SECRET` | `change-me-to-a-random-string` | Shared HMAC secret with coturn |

## Usage

1. Launch the app
2. Enter or create a room code (share with the other person)
3. Both join the same room — WebRTC negotiation starts automatically
4. Use **Settings** (⚙) to bind PTT keys and select microphone
5. Hold PTT key to talk · click 🔴 for complete mute · click 🖥 to share screen

## Project Structure

```
src/
  App.tsx                 ← top-level routing + wires hooks together
  store/callStore.ts      ← Zustand state (connection, mute, PTT, screen share)
  hooks/
    useSignaling.ts       ← WebSocket + server message dispatch
    useWebRTC.ts          ← RTCPeerConnection lifecycle, tracks, screen share
    usePushToTalk.ts      ← Global shortcut registration, mic gate
  components/
    RoomJoin.tsx          ← Lobby screen
    CallControls.tsx      ← Bottom bar: mute, screen share, hang up, PTT indicator
    PeerVideo.tsx         ← Remote peer tile
    Settings.tsx          ← PTT key binding + mic picker
src-tauri/src/lib.rs      ← Tauri commands: get_turn_credentials, get_server_config
```
