import { useCallback, useMemo, useState } from "react";
import "./App.css";
import { useCallStore } from "./store/callStore";
import { useWebRTC } from "./hooks/useWebRTC";
import { useSignaling } from "./hooks/useSignaling";
import { usePushToTalk } from "./hooks/usePushToTalk";
import { RoomJoin } from "./components/RoomJoin";
import { CallControls } from "./components/CallControls";
import { PeerVideo } from "./components/PeerVideo";
import { Settings } from "./components/Settings";

type Screen = "join" | "call";

export default function App() {
  const [screen, setScreen] = useState<Screen>("join");
  const [showSettings, setShowSettings] = useState(false);

  const { isMuted, setMuted, isScreenSharing, remotePeerIds, reset } = useCallStore();

  const {
    remoteStreams,
    startCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handlePeerLeft,
    setMicEnabled,
    startScreenShare,
    stopScreenShare,
    hangUp,
  } = useWebRTC();

  // PTT — must be always mounted once we're in a call
  usePushToTalk(setMicEnabled);

  // Handlers passed to signaling — stable refs via useCallback
  const signalingHandlers = useMemo(() => ({
    onOffer: (sdp: string, from: string) => handleOffer(sdp, from, send),
    onAnswer: handleAnswer,
    onIceCandidate: handleIceCandidate,
    onPeerJoined: (peerId: string) => startCall(peerId, send),
    onPeerLeft: (peerId: string) => handlePeerLeft(peerId),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const { connect, disconnect, send } = useSignaling(signalingHandlers);

  const handleJoin = useCallback(async () => {
    setScreen("call");
    await connect();
  }, [connect]);

  const handleHangUp = useCallback(() => {
    hangUp();
    disconnect();
    reset();
    setScreen("join");
  }, [hangUp, disconnect, reset]);

  const handleToggleMute = useCallback(() => {
    const next = !isMuted;
    setMuted(next);
    if (next) {
      // Complete mute — disable mic regardless of PTT
      setMicEnabled(false);
    }
    // When unmuting, mic stays off until PTT is pressed (or user removes mute)
  }, [isMuted, setMuted, setMicEnabled]);

  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  if (screen === "join") {
    return <RoomJoin onJoin={handleJoin} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Peer tiles */}
      <div className="flex-1 overflow-auto p-4 pb-24">
        {remotePeerIds.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4 text-gray-500">
              <div className="text-5xl">🎙</div>
              <p className="text-sm">Waiting for someone to join…</p>
              <p className="text-xs font-mono bg-gray-800 px-4 py-2 rounded-lg text-gray-400">
                Share room code: <span className="text-white font-bold">{useCallStore.getState().roomCode}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-fr">
            {remotePeerIds.map((pid) => {
              const stream = remoteStreams.get(pid);
              return stream ? (
                <PeerVideo key={pid} stream={stream} peerId={pid} />
              ) : (
                <div key={pid} className="bg-gray-800 rounded-2xl flex items-center justify-center aspect-video">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-indigo-700 flex items-center justify-center text-lg font-bold">
                      {pid.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-500 font-mono">connecting…</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom controls bar */}
      <CallControls
        onHangUp={handleHangUp}
        onToggleMute={handleToggleMute}
        onToggleScreenShare={handleToggleScreenShare}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Settings overlay */}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          setMicEnabled={setMicEnabled}
        />
      )}
    </div>
  );
}
