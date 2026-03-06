import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { useAppStore } from "./store/appStore";
import { useWebRTC } from "./hooks/useWebRTC";
import { useSignaling } from "./hooks/useSignaling";
import { usePushToTalk } from "./hooks/usePushToTalk";
import { useRingtone } from "./hooks/useRingtone";
import { IdentitySetup } from "./components/IdentitySetup";
import { ContactList } from "./components/ContactList";
import { ChatPanel } from "./components/ChatPanel";
import { CallScreen } from "./components/CallScreen";
import { IncomingCallOverlay } from "./components/IncomingCallOverlay";
import { Settings } from "./components/Settings";

export default function App() {
  const [
    showSettings, setShowSettings,
  ] = useState(false);
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
    startScreenShare,
    stopScreenShare,
  } = useWebRTC();

  usePushToTalk(setMicEnabled);

  // Play calm ringtones during outgoing/incoming call states
  const ringType =
    callState === "calling" ? "outgoing"
    : callState === "ringing" ? "incoming"
    : null;
  useRingtone(ringType);

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

  const handleReconnect = useCallback(() => {
    disconnect();
    void connect();
  }, [disconnect, connect]);

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
      // Set mic state immediately: always-on → enabled, PTT → start muted
      setMicEnabled(useAppStore.getState().micMode === "always_on" && !useAppStore.getState().isMuted);
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
      // Set mic state immediately: always-on → enabled, PTT → start muted
      setMicEnabled(useAppStore.getState().micMode === "always_on" && !useAppStore.getState().isMuted);
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

  const handleToggleMode = useCallback(() => {
    const { micMode, setMicMode, isMuted: muted } = useAppStore.getState();
    const newMode = micMode === "always_on" ? "push_to_talk" : "always_on";
    setMicMode(newMode);
    // Immediately apply mic state: always_on → enable; push_to_talk → disable
    if (!muted) setMicEnabled(newMode === "always_on");
  }, [setMicEnabled]);

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
        onToggleMode={handleToggleMode}
        setMicEnabled={setMicEnabled}
        onToggleScreenShare={async () => {
          const { isScreenSharing } = useAppStore.getState();
          if (isScreenSharing) { await stopScreenShare(); }
          else { try { await startScreenShare(); } catch (e) { console.error("[screen]", e); } }
        }}
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
        onOpenSettings={() => setShowSettings(true)}
      />
      {callState === "ringing" && (
        <IncomingCallOverlay onAccept={handleAcceptCall} onReject={handleRejectCall} />
      )}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          setMicEnabled={setMicEnabled}
          onReconnect={handleReconnect}
        />
      )}
    </>
  );
}
