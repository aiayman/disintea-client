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

  // ── diagnostics helper ──────────────────────────────────────────────────
  const log = useCallback((level: "info" | "warn" | "error", msg: string) => {
    useAppStore.getState().addLog(level, msg);
    console[level](`[ws] ${msg}`);
  }, []);

  // ── low-level send ──────────────────────────────────────────────────────
  const send = useCallback((msg: object) => {
    const type = (msg as Record<string, unknown>).type as string ?? "?";
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      log("info", `→ ${type}`);
    } else {
      log("warn", `→ ${type} DROPPED (WS not open — status: ${wsRef.current ? wsRef.current.readyState : "no socket"})`);
    }
  }, [log]);

  // ── connect ─────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const { userId, username } = useAppStore.getState();
    const config = await getServerConfig();
    log("info", `Connecting to ${config.ws_url} as '${username}' (${userId.slice(0, 8)}…)`);
    const ws = new WebSocket(config.ws_url);
    wsRef.current = ws;
    setWsStatus("connecting");

    ws.onopen = () => {
      log("info", `WS open — sending register`);
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

      log("info", `← ${msg.type}${
        msg.type === "error" ? `: ${msg.reason as string}` :
        msg.type === "user_online" ? ` (${msg.user_id as string})` :
        msg.type === "user_offline" ? ` (${msg.user_id as string})` :
        msg.type === "contact_added" ? ` (${msg.user_id as string})` :
        msg.type === "added_by_user" ? ` (${msg.user_id as string})` :
        msg.type === "incoming_call" ? ` from ${msg.from as string}` :
        ""
      }`);

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
          // If the peer we're in a call with went offline, treat it as a hang-up
          // so we don't get stuck on a frozen CallScreen
          if (store.callPeerId === msg.user_id as string && store.callState !== "idle") {
            callbacksRef.current.onHangUp(msg.user_id as string);
          }
          break;

        // Server confirmed we added a contact
        case "contact_added":
          store.upsertContact(
            msg.user_id as string,
            msg.username as string,
            msg.online as boolean
          );
          break;

        // Someone added us — add them to OUR list AND persist it server-side
        // so the contact survives reconnects (server only knows about contacts
        // we explicitly added; upsertContact alone is client-side only).
        case "added_by_user": {
          const addedId = msg.user_id as string;
          // Check BEFORE upsert so we know if this is genuinely new.
          // If already in list → we already sent add_contact for them → skip
          // to avoid an echo loop (server sends AddedByUser back to adder).
          const alreadyAdded = store.contacts.some((c) => c.id === addedId);
          store.upsertContact(addedId, msg.username as string, msg.online as boolean);
          if (!alreadyAdded) {
            send({ type: "add_contact", contact_id: addedId });
          }
          break;
        }

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
          // Badge the sender if the chat window isn't currently open with them
          if (store.activeChat !== contactId) {
            store.markUnread(contactId);
          }
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
          alert(`Server error: ${msg.reason as string}`);
          break;
      }
    };

    ws.onclose = (evt) => {
      log("warn", `WS closed (code ${evt.code}${evt.reason ? `: ${evt.reason}` : ""})`);
      setWsStatus("disconnected");
      // We have no presence feed while disconnected — mark everyone offline
      // so the UI never shows a stale "Online" badge.
      const s = useAppStore.getState();
      s.setContacts(s.contacts.map((c) => ({ ...c, online: false })));
    };
    ws.onerror = () => {
      log("error", `WS error — check server URL in Settings and network connectivity`);
    };
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
