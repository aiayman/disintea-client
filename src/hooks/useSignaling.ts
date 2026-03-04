import { useCallback, useEffect, useRef } from "react";
import { getServerConfig } from "../lib/tauri-compat";
import { useCallStore } from "../store/callStore";

// ---- Message types (mirroring the server protocol) ----
export interface ServerMsg {
  type: string;
  [key: string]: unknown;
}

export type SignalingHandlers = {
  onOffer: (sdp: string, from: string) => void;
  onAnswer: (sdp: string, from: string) => void;
  onIceCandidate: (candidate: string, sdpMid: string | null, sdpMLineIndex: number | null, from: string) => void;
  onPeerJoined: (peerId: string) => void;
  onPeerLeft: (peerId: string) => void;
};

export function useSignaling(handlers: SignalingHandlers) {
  const wsRef = useRef<WebSocket | null>(null);
  const { setStatus, addRemotePeer, removeRemotePeer } = useCallStore();

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(async () => {
    // Read fresh values from the store at call time — avoids stale closure
    // when connect() is called immediately after setRoomCode/setMyPeerId.
    const { roomCode, myPeerId } = useCallStore.getState();

    const config = await getServerConfig();
    const ws = new WebSocket(config.ws_url);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", room_code: roomCode, peer_id: myPeerId }));
    };

    ws.onmessage = (evt) => {
      let msg: ServerMsg;
      try { msg = JSON.parse(evt.data as string); } catch { return; }

      switch (msg.type) {
        case "joined":
          setStatus("connected");
          for (const pid of (msg.existing_peers as string[]) ?? []) {
            addRemotePeer(pid);
            handlers.onPeerJoined(pid);
          }
          break;
        case "peer_joined":
          addRemotePeer(msg.peer_id as string);
          handlers.onPeerJoined(msg.peer_id as string);
          break;
        case "peer_left":
          removeRemotePeer(msg.peer_id as string);
          handlers.onPeerLeft(msg.peer_id as string);
          break;
        case "offer":
          handlers.onOffer(msg.sdp as string, msg.from as string);
          break;
        case "answer":
          handlers.onAnswer(msg.sdp as string, msg.from as string);
          break;
        case "ice_candidate":
          handlers.onIceCandidate(
            msg.candidate as string,
            (msg.sdp_mid as string) ?? null,
            (msg.sdp_m_line_index as number) ?? null,
            msg.from as string,
          );
          break;
        case "room_full":
          setStatus("disconnected");
          ws.close();
          break;
        case "error":
          console.error("[signaling] server error:", msg.reason);
          break;
      }
    };

    ws.onclose = () => setStatus("disconnected");
    ws.onerror = (e) => console.error("[signaling] ws error", e);
  }, [handlers, setStatus, addRemotePeer, removeRemotePeer]);

  const disconnect = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "leave" }));
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  // auto-cleanup
  useEffect(() => () => { wsRef.current?.close(); }, []);

  return { connect, disconnect, send };
}
