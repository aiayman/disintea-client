import { useCallback, useRef } from "react";
import { getServerConfig } from "../lib/tauri-compat";
import { useAppStore } from "../store/appStore";

interface ServerMsg {
  type: string;
  [key: string]: unknown;
}

export type SignalingCallbacks = {
  onIncomingCall: (from: string, fromName: string, sdp: string) => void;
  onCallAnswered: (from: string, sdp: string) => void;
  onCallRejected: (from: string) => void;
  onHangUp: (from: string) => void;
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

  // ── low-level send ──────────────────────────────────────────────────────
  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // ── connect ─────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const { userId, username } = useAppStore.getState();
    const config = await getServerConfig();
    const ws = new WebSocket(config.ws_url);
    wsRef.current = ws;
    setWsStatus("connecting");

    ws.onopen = () => {
      // No contacts in Register — server loads from DB
      ws.send(JSON.stringify({ type: "register", user_id: userId, username }));
    };

    ws.onmessage = (evt) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(evt.data as string);
      } catch {
        return;
      }

      const store = useAppStore.getState();

      switch (msg.type) {
        case "registered":
          store.setWsStatus("connected");
          break;

        // Full contact list from server (sent right after registered)
        case "contact_list": {
          type CI = { user_id: string; username: string; online: boolean };
          const contacts = (msg.contacts as CI[]).map((c) => ({
            id: c.user_id,
            name: c.username,
            online: c.online,
          }));
          // Reset online status for all cached contacts then apply server truth
          store.setContacts(
            store.contacts.map((c) => ({ ...c, online: false }))
          );
          for (const c of contacts) {
            store.upsertContact(c.id, c.name, c.online);
          }
          break;
        }

        case "user_online":
          store.setContactOnline(
            msg.user_id as string,
            true,
            msg.username as string
          );
          break;

        case "user_offline":
          store.setContactOnline(msg.user_id as string, false);
          break;

        // Server confirmed we added a contact
        case "contact_added":
          store.upsertContact(
            msg.user_id as string,
            msg.username as string,
            msg.online as boolean
          );
          break;

        // Someone added us — add them to OUR list too (mutual discovery)
        case "added_by_user":
          store.upsertContact(
            msg.user_id as string,
            msg.username as string,
            msg.online as boolean
          );
          break;

        // Historical messages
        case "message_history": {
          type HM = { msg_id: string; from_id: string; text: string; timestamp: number };
          const myId = useAppStore.getState().userId;
          const withId = msg.with_user_id as string;
          const msgs = (msg.messages as HM[]).map((m) => ({
            id: m.msg_id,
            from: m.from_id,
            text: m.text,
            timestamp: m.timestamp,
            mine: m.from_id === myId,
          }));
          store.setHistory(withId, msgs);
          break;
        }

        case "incoming_message": {
          const contactId = msg.from as string;
          store.addMessage(contactId, {
            id: msg.msg_id as string,
            from: contactId,
            text: msg.text as string,
            timestamp: msg.timestamp as number,
            mine: false,
          });
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

        case "error":
          console.error("[signaling] server error:", msg.reason);
          break;
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
      // We have no presence feed while disconnected — mark everyone offline
      // so the UI never shows a stale "Online" badge.
      const s = useAppStore.getState();
      s.setContacts(s.contacts.map((c) => ({ ...c, online: false })));
    };
    ws.onerror = (e) => console.error("[signaling] ws error", e);
  }, [setWsStatus]);

  // ── disconnect ──────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus("disconnected");
  }, [setWsStatus]);

  // ── outbound helpers ────────────────────────────────────────────────────
  const sendAddContact = useCallback(
    (contactId: string) => send({ type: "add_contact", contact_id: contactId }),
    [send]
  );

  const sendRemoveContact = useCallback(
    (contactId: string) => send({ type: "remove_contact", contact_id: contactId }),
    [send]
  );

  const sendGetHistory = useCallback(
    (withUserId: string, before?: number) =>
      send({ type: "get_history", with_user_id: withUserId, before, limit: 50 }),
    [send]
  );

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
    (to: string, candidate: string, sdpMid: string | null, sdpMLineIndex: number | null) =>
      send({ type: "ice_candidate", to, candidate, sdp_mid: sdpMid, sdp_m_line_index: sdpMLineIndex }),
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
    sendAddContact,
    sendRemoveContact,
    sendGetHistory,
    sendCallOffer,
    sendCallAnswer,
    sendCallReject,
    sendHangUp,
    sendIceCandidate,
    sendChatMessage,
  };
}
