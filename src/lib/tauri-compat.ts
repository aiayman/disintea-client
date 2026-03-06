/**
 * tauri-compat.ts
 * Browser shim so the app works both inside Tauri and as a plain web page.
 *
 * In a Tauri webview `__TAURI_INTERNALS__` is injected by the runtime.
 * In a plain browser it's absent, so we fall back to HTTP/WebSocket calls.
 */

import { useAppStore } from "../store/appStore";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface ServerConfig {
  ws_url: string;
}

export interface TurnCredentials {
  urls: string;
  username: string;
  credential: string;
}

/** Returns the signaling WebSocket URL.
 *  Priority: 1) user-saved override in store  2) production server default
 *  The Tauri compiled-in URL (SIGNALING_URL env var) is no longer needed for
 *  normal deployments — the default below is used for all new installs.
 */
const DEFAULT_SERVER_URL = "ws://161.97.187.145:8080/ws";

export async function getServerConfig(): Promise<ServerConfig> {
  // Runtime override: user can paste their server URL in Settings
  const saved = useAppStore.getState().serverUrl.trim();
  if (saved) return { ws_url: saved };
  // Fall back to the known production server
  return { ws_url: DEFAULT_SERVER_URL };
}

/** Returns TURN credentials for WebRTC. */
export async function getTurnCredentials(): Promise<TurnCredentials> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TurnCredentials>("get_turn_credentials");
  }
  const res = await fetch("/turn-credentials");
  if (!res.ok) throw new Error(`TURN credentials fetch failed: ${res.status}`);
  return res.json() as Promise<TurnCredentials>;
}
