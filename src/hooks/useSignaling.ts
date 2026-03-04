import { useCallback, useRef } from "react";
import { getServerConfig } from "../lib/tauri-compat";
import { useAppStore } from "../store/appStore";

// Raw shape of messages from the server
interface ServerMsg {
  type: string;
  [key: string]: unknown;
}

export type SignalingCallbacks = {
  /** Someone is calling us — we should show the incoming-call overlay */
  onIncomingCall: (from: string, fromName: string, sdp: string) => void;
  /** Our outgoing call was accepted — start WebRTC answer flow */
  onCallAnswered: (from: string, sdp: string) => void;
  /** Our outgoing call was rejected */
  onCallRejected: (from: string) => void;
  /** Other side hung up */
  onHangUp: (from: string) => void;
  /** Relayed ICE candidate */
  onIceCandidate: (
    from: string,
    candidate: string,
    sdpMid: string | null,
    sdpMLineIndex: number | null
  ) => void;
};

export function useSignaling(callbacks: SignalingCallbacks) {
  const wsRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const { setWsStatus } = useAppStore();

  // ---- low-level send ----
  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // ---- connect ----
  const connect = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Read fresh values at call time
    const { userId, username, contacts } = useAppStore.getState();
    const config = await getServerConfig();
    const ws = new WebSocket(config.ws_url);
    wsRef.current = ws;
    setWsStatus("connecting");

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "register",
          user_id: userId,
          username,
          contacts: contacts.map((c) => c.id),
        })
      );
    };

    ws.onmessage = (evt) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(evt.data as string);
      } catch {
        return;
      }

      switch (msg.type) {
        case "registered":
          setWsStatus("connected");
          break;

        case "user_online": {
          const { setContactOnline } = useAppStore.getState();
          setContactOnline(
            msg.user_id as string,
            true,
            msg.username as string
          );
          break;
        }

        case "user_offline": {
          const { setContactOnline } = useAppStore.getState();
          setContactOnline(msg.user_id as string, false);
          break;
        }

        case "incoming_call":
          callbacksRef.current.onIncomingCall(
            msg.from as string,
            msg.from_name as string,
            msg.sdp as string
          );
          break;

        case "call_answered":
          callbacksRef.current.onCallAnswered(
            msg.from as string,
            msg.sdp as string
          );
          break;

        case "call_rejected":
          callbacksRef.current.onCallRejected(msg.from as string);
          break;

        case "hang_up":
          callbacksRef.current.onHangUp(msg.from as string);
          break;

        case "ice_candidate":
          callbacksRef.current.onIceCandidate(
            msg.from as string,
            msg.candidate as string,
            (msg.sdp_mid as string) ?? null,
            (msg.sdp_m_line_index as number) ?? null
          );
          break;

        case "incoming_message": {
          const { addMessage } = useAppStore.getState();
          const contactId = msg.from as string;
          addMessage(contactId, {
            id: msg.msg_id as string,
            from: contactId,
            text: msg.text as string,
            timestamp: msg.timestamp as number,
            mine: false,
          });
          break;
        }

        case "error":
          console.error("[signaling] server error:", msg.reason);
          break;
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
    };

    ws.onerror = (e) => {
      console.error("[signaling] ws error", e);
    };
  }, [setWsStatus]);

  // ---- disconnect ----
  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus("disconnected");
  }, [setWsStatus]);

  // ---- outbound signaling helpers ----
  const sendCallOffer = useCallback(
    (to: string, sdp: string) => send({ type: "call_offer", to, sdp }),
    [send]
  );

  const sendCallAnswer = useCallback(
    (to: string, sdp: string) => send({ type: "call_answer", to, sdp }),
    [send]
  );

  const sendCallReject = useCallback(
    (to: string) => send({ type: "call_reject", to }),
    [send]
  );

  const sendHangUp = useCallback(
    (to: string) => send({ type: "hang_up", to }),
    [send]
  );

  const sendIceCandidate = useCallback(
    (
      to: string,
      candidate: string,
      sdpMid: string | null,
      sdpMLineIndex: number | null
    ) =>
      send({
        type: "ice_candidate",
        to,
        candidate,
        sdp_mid: sdpMid,
        sdp_m_line_index: sdpMLineIndex,
      }),
    [send]
  );

  const sendChatMessage = useCallback(
    (to: string, text: string, msgId: string) =>
      send({ type: "chat_message", to, text, msg_id: msgId }),
    [send]
  );

  return {
    connect,
    disconnect,
    send,
    sendCallOffer,
    sendCallAnswer,
    sendCallReject,
    sendHangUp,
    sendIceCandidate,
    sendChatMessage,
  };
}
