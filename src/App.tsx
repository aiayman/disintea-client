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

  // Push-to-talk (only active in Tauri)
  usePushToTalk(setMicEnabled);

  // Keep latest refs to avoid stale closures
  const startCallRef = useRef(startCall);
  const handleOfferRef = useRef(handleOffer);
  startCallRef.current = startCall;
  handleOfferRef.current = handleOffer;

  // ---- Signaling callbacks ----
  const signalingCallbacks = {
    onIncomingCall: useCallback((from: string, fromName: string, sdp: string) => {
      // Only accept a new incoming call when we're idle
      const state = useAppStore.getState();
      if (state.callState !== "idle") return;
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
    sendCallReject,
    sendHangUp,
    sendChatMessage,
  } = useSignaling(signalingCallbacks);

  // Keep send ref stable for WebRTC callbacks
  const sendRef = useRef(send);
  sendRef.current = send;

  // Connect to signaling server once identity is set
  useEffect(() => {
    if (!userId) return;
    connect();
    return () => { disconnect(); };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Call handlers ----
  const handleStartCall = useCallback(async (contactId: string) => {
    setCallState("calling");
    setCallPeerId(contactId);
    await startCallRef.current(contactId, sendRef.current);
  }, [setCallState, setCallPeerId]);

  const handleAcceptCall = useCallback(async () => {
    const ic = useAppStore.getState().incomingCall;
    if (!ic) return;
    setCallState("in_call");
    setCallPeerId(ic.from);
    setIncomingCall(null);
    await handleOfferRef.current(ic.sdp, ic.from, sendRef.current);
  }, [setCallState, setCallPeerId, setIncomingCall]);

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

  const handleSendChatMessage = useCallback((to: string, text: string, msgId: string) => {
    sendChatMessage(to, text, msgId);
  }, [sendChatMessage]);

  // ---- Routing ----
  // First-run: no identity
  if (!userId) {
    return <IdentitySetup />;
  }

  // Active call (calling, in call)
  if (callState === "calling" || callState === "in_call") {
    return (
      <>
        <CallScreen
          remoteStreams={remoteStreams}
          onHangUp={handleHangUp}
          onToggleMute={handleToggleMute}
        />
      </>
    );
  }

  // Chat panel
  if (activeChat) {
    return (
      <>
        <ChatPanel
          contactId={activeChat}
          onBack={() => setActiveChat(null)}
          onCall={handleStartCall}
          onSendMessage={handleSendChatMessage}
        />
        {callState === "ringing" && (
          <IncomingCallOverlay onAccept={handleAcceptCall} onReject={handleRejectCall} />
        )}
      </>
    );
  }

  // Contacts list (main screen)
  return (
    <>
      <ContactList
        userId={userId}
        onStartChat={setActiveChat}
        onStartCall={handleStartCall}
      />
      {callState === "ringing" && (
        <IncomingCallOverlay onAccept={handleAcceptCall} onReject={handleRejectCall} />
      )}
    </>
  );
}
