import { useCallback, useEffect, useRef } from "react";
import "./App.css";
import { useAppStore } from "./store/appStore";
import { useWebRTC } from "./hooks/useWebRTC";
import { useSignaling } from "./hooks/useSignaling";
import { usePushToTalk } from "./hooks/usePushToTalk";
import { IdentitySetup } from "./components/IdentitySetup";
import { ContactList } from "./components/ContactList";
import { ChatPanel } from "./components/ChatPanel";
import { CallScreen } from "./components/CallScreen";
import { IncomingCallOverlay } from "./components/IncomingCallOverlay";

export default function App() {
  const {
    userId,
    callState,
    callPeerId,
    activeChat,
    isMuted,
    setMuted,
    setCallState,
    setCallPeerId,
    setIncomingCall,
    resetCall,
    setActiveChat,
    removeContact,
  } = useAppStore();

  const {
    remoteStreams,
    startCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    setMicEnabled,
    hangUp,
  } = useWebRTC();

  usePushToTalk(setMicEnabled);

  const startCallRef = useRef(startCall);
  const handleOfferRef = useRef(handleOffer);
  startCallRef.current = startCall;
  handleOfferRef.current = handleOffer;

  const signalingCallbacks = {
    onIncomingCall: useCallback((from: string, fromName: string, sdp: string) => {
      if (useAppStore.getState().callState !== "idle") return;
      useAppStore.getState().setIncomingCall({ from, fromName, sdp });
      useAppStore.getState().setCallState("ringing");
    }, []),

    onCallAnswered: useCallback((from: string, sdp: string) => {
      handleAnswer(sdp, from);
      useAppStore.getState().setCallState("in_call");
    }, [handleAnswer]),

    onCallRejected: useCallback((_from: string) => {
      hangUp();
      resetCall();
    }, [hangUp, resetCall]),

    onHangUp: useCallback((_from: string) => {
      hangUp();
      resetCall();
    }, [hangUp, resetCall]),

    onIceCandidate: useCallback((
      from: string,
      candidate: string,
      sdpMid: string | null,
      sdpMLineIndex: number | null,
    ) => {
      handleIceCandidate(candidate, sdpMid, sdpMLineIndex, from);
    }, [handleIceCandidate]),
  };

  const {
    connect,
    disconnect,
    send,
    sendAddContact,
    sendRemoveContact,
    sendGetHistory,
    sendCallReject,
    sendHangUp,
    sendChatMessage,
  } = useSignaling(signalingCallbacks);

  const sendRef = useRef(send);
  sendRef.current = send;

  // Connect once identity is set
  useEffect(() => {
    if (!userId) return;
    connect();
    return () => { disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Call handlers ──────────────────────────────────────────────────────
  const handleStartCall = useCallback(async (contactId: string) => {
    setCallState("calling");
    setCallPeerId(contactId);
    try {
      await startCallRef.current(contactId, sendRef.current);
    } catch (err) {
      console.error("[call] startCall failed", err);
      // Most likely cause: microphone permission denied.
      // Reset call state so the user isn't stuck on the CallScreen.
      hangUp();
      resetCall();
      alert(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was denied. Please allow microphone access in your system settings and try again."
          : `Could not start call: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [setCallState, setCallPeerId, hangUp, resetCall]);

  const handleAcceptCall = useCallback(async () => {
    const ic = useAppStore.getState().incomingCall;
    if (!ic) return;
    setCallState("in_call");
    setCallPeerId(ic.from);
    setIncomingCall(null);
    try {
      await handleOfferRef.current(ic.sdp, ic.from, sendRef.current);
    } catch (err) {
      console.error("[call] handleOffer failed", err);
      hangUp();
      resetCall();
      alert(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was denied. Please allow microphone access in your system settings and try again."
          : `Could not accept call: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [setCallState, setCallPeerId, setIncomingCall, hangUp, resetCall]);

  const handleRejectCall = useCallback(() => {
    const ic = useAppStore.getState().incomingCall;
    if (ic) sendCallReject(ic.from);
    setIncomingCall(null);
    resetCall();
  }, [sendCallReject, setIncomingCall, resetCall]);

  const handleHangUp = useCallback(() => {
    if (callPeerId) sendHangUp(callPeerId);
    hangUp();
    resetCall();
  }, [callPeerId, sendHangUp, hangUp, resetCall]);

  const handleToggleMute = useCallback(() => {
    const next = !isMuted;
    setMuted(next);
    setMicEnabled(!next);
  }, [isMuted, setMuted, setMicEnabled]);

  const handleRemoveContact = useCallback((id: string) => {
    sendRemoveContact(id);
    removeContact(id);
  }, [sendRemoveContact, removeContact]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (!userId) return <IdentitySetup />;

  if (callState === "calling" || callState === "in_call") {
    return (
      <CallScreen
        remoteStreams={remoteStreams}
        onHangUp={handleHangUp}
        onToggleMute={handleToggleMute}
      />
    );
  }

  if (activeChat) {
    return (
      <>
        <ChatPanel
          contactId={activeChat}
          onBack={() => setActiveChat(null)}
          onCall={handleStartCall}
          onSendMessage={(to, text, msgId) => sendChatMessage(to, text, msgId)}
          onLoadHistory={(id) => sendGetHistory(id)}
        />
        {callState === "ringing" && (
          <IncomingCallOverlay onAccept={handleAcceptCall} onReject={handleRejectCall} />
        )}
      </>
    );
  }

  return (
    <>
      <ContactList
        userId={userId}
        onStartChat={setActiveChat}
        onStartCall={handleStartCall}
        onAddContact={sendAddContact}
        onRemoveContact={handleRemoveContact}
      />
      {callState === "ringing" && (
        <IncomingCallOverlay onAccept={handleAcceptCall} onReject={handleRejectCall} />
      )}
    </>
  );
}
