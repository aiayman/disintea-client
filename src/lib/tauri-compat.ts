/**
 * tauri-compat.ts
 * Browser shim so the app works both inside Tauri and as a plain web page.
 *
 * In a Tauri webview `__TAURI_INTERNALS__` is injected by the runtime.
 * In a plain browser it's absent, so we fall back to HTTP/WebSocket calls.
 */

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

/** Returns the signaling WebSocket URL. */
export async function getServerConfig(): Promise<ServerConfig> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<ServerConfig>("get_server_config");
  }
  // In browser: connect back to the same host over WSS (or WS in dev).
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return { ws_url: `${proto}://${location.host}/ws` };
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
