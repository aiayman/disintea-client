use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use hmac::{Hmac, Mac};
use sha1::Sha1;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha1 = Hmac<Sha1>;

/// TURN credential response — returned to the frontend so it can build
/// an RTCPeerConnection with time-limited coturn credentials.
#[derive(serde::Serialize)]
pub struct TurnCredentials {
    pub urls: String,
    pub username: String,
    pub credential: String,
}

/// Return short-lived TURN credentials (coturn time-limited HMAC scheme).
/// The TURN_SECRET and TURN_URL are baked in at compile time via env vars,
/// or fall back to placeholder values for development.
#[tauri::command]
fn get_turn_credentials() -> TurnCredentials {
    let secret = option_env!("TURN_SECRET").unwrap_or("change-me-to-a-random-string");
    let turn_url = option_env!("TURN_URL").unwrap_or("turn:your.domain.com:3478");

    // Credential valid for 24 hours
    let ttl = 86400u64;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        + ttl;

    // coturn username format: <timestamp>:<arbitrary-name>
    let username = format!("{timestamp}:dismony");

    let mut mac = HmacSha1::new_from_slice(secret.as_bytes()).expect("HMAC init failed");
    mac.update(username.as_bytes());
    let credential = BASE64.encode(mac.finalize().into_bytes());

    TurnCredentials {
        urls: turn_url.to_string(),
        username,
        credential,
    }
}

/// Return the signaling server WebSocket URL.
#[tauri::command]
fn get_server_config() -> serde_json::Value {
    let ws_url = option_env!("SIGNALING_URL").unwrap_or("ws://localhost:8080/ws");
    serde_json::json!({ "ws_url": ws_url })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_turn_credentials,
            get_server_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
