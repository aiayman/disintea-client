import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/appStore";
import type { RemoteStreams } from "../hooks/useWebRTC";

/** Attaches a remote MediaStream to a hidden audio element and keeps it in sync. */
function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    ref.current.play().catch(() => { /* autoplay policy */ });
  }, [stream]);
  return <audio ref={ref} autoPlay style={{ position: "absolute", width: 0, height: 0 }} />;
}

/** Renders a remote video stream (e.g. screen share). */
function RemoteVideo({ stream, label, fill }: { stream: MediaStream; label?: string; fill?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    ref.current.play().catch(() => {});
  }, [stream]);
  const hasVideo = stream.getVideoTracks().some((t) => t.readyState === "live" && !t.muted);
  if (!hasVideo) return null;
  if (fill) {
    return (
      <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
        <video ref={ref} autoPlay playsInline className="w-full h-full object-contain" />
        {label && (
          <span className="absolute bottom-2 left-3 text-xs text-white bg-black/50 rounded px-1.5 py-0.5">{label}</span>
        )}
      </div>
    );
  }
  return (
    <div className="relative rounded-xl overflow-hidden bg-black shadow-lg w-full">
      <video ref={ref} autoPlay playsInline className="w-full h-full object-contain" />
      {label && (
        <span className="absolute bottom-2 left-3 text-xs text-white bg-black/50 rounded px-1.5 py-0.5">{label}</span>
      )}
    </div>
  );
}

interface Props {
  remoteStreams: RemoteStreams;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleMode: () => void;
  onToggleScreenShare: () => void;
  setMicEnabled: (enabled: boolean) => void;
}

export function CallScreen({ remoteStreams, onHangUp, onToggleMute, onToggleMode, onToggleScreenShare, setMicEnabled }: Props) {
  const { callState, callPeerId, contacts, isMuted, micMode, isPttActive, setPttActive, isScreenSharing } = useAppStore();

  const contact = contacts.find((c) => c.id === callPeerId);
  const displayName = contact?.name ?? callPeerId ?? "Unknown";
  const inCall = callState === "in_call";

  // ── Call duration timer ──────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);  const [dismissedRemoteVideo, setDismissedRemoteVideo] = useState(false);  const startRef = useRef<number>(0);
  useEffect(() => {
    if (callState !== "in_call") { setElapsed(0); return; }
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [callState]);
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  // ────────────────────────────────────────────────────────────────────

  const statusLabel =
    callState === "calling"
      ? "Calling…"
      : callState === "ringing"
      ? "Incoming…"
      : micMode === "push_to_talk"
      ? isPttActive
        ? "● Transmitting"
        : "Push to talk — hold button below"
      : "In call";

  const handlePttDown = () => {
    if (isMuted) return;
    setMicEnabled(true);
    setPttActive(true);
  };

  const handlePttUp = () => {
    setMicEnabled(false);
    setPttActive(false);
  };

  // True when at least one remote peer is sending live video (screen share)
  const anyRemoteHasVideo = inCall && !dismissedRemoteVideo && [...remoteStreams.entries()].some(
    ([, s]) => s.getVideoTracks().some((t) => t.readyState === "live" && !t.muted)
  );

  // Reset dismiss when remote video goes away (so next share shows up again)
  const hasLiveRemoteVideo = inCall && [...remoteStreams.entries()].some(
    ([, s]) => s.getVideoTracks().some((t) => t.readyState === "live" && !t.muted)
  );
  useEffect(() => {
    if (!hasLiveRemoteVideo) setDismissedRemoteVideo(false);
  }, [hasLiveRemoteVideo]);

  // ── Screen-share full-screen layout ─────────────────────────────────
  if (anyRemoteHasVideo) {
    return (
      <div className="flex h-full flex-col bg-black text-white overflow-hidden">
        {/* Hidden audio elements */}
        {[...remoteStreams.entries()].map(([peerId, stream]) => (
          <RemoteAudio key={peerId} stream={stream} />
        ))}

        {/* Compact top bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-700 text-sm font-bold">
              {displayName[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium">{displayName}</span>
          </div>
          {inCall && <span className="font-mono text-sm text-indigo-300">{fmt(elapsed)}</span>}
        </div>

        {/* Video tiles — fill all remaining space */}
        <div className="flex flex-col flex-1 min-h-0">
          {[...remoteStreams.entries()].map(([peerId, stream]) => {
            const c = contacts.find((ct) => ct.id === peerId);
            return <RemoteVideo key={peerId} stream={stream} label={c?.name ?? peerId.slice(0, 8)} fill />;
          })}
        </div>

        {/* Floating bottom controls */}
        <div className="flex items-center justify-center gap-4 px-6 py-3 bg-gray-900/90 backdrop-blur-sm shrink-0">
          <button
            onClick={onToggleMute}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-xl shadow-lg transition active:scale-95 ${
              isMuted ? "bg-red-700 hover:bg-red-600" : "bg-gray-700 hover:bg-gray-600"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? "🔇" : "🎙"}
          </button>

          <button
            onClick={onToggleMode}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold shadow-lg transition active:scale-95 ${
              micMode === "push_to_talk"
                ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
            }`}
            title={micMode === "always_on" ? "Switch to Push to Talk" : "Switch to Always On"}
          >
            {micMode === "always_on" ? "PTT" : "AON"}
          </button>

          {micMode === "push_to_talk" && (
            <button
              onPointerDown={handlePttDown}
              onPointerUp={handlePttUp}
              onPointerLeave={handlePttUp}
              className={`flex h-14 w-14 items-center justify-center rounded-full text-3xl shadow-xl select-none transition-transform ${
                isPttActive
                  ? "bg-green-500 scale-110 ring-4 ring-green-300"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
              title="Hold to talk"
            >
              🎤
            </button>
          )}

          <button
            onClick={isScreenSharing ? onToggleScreenShare : () => setDismissedRemoteVideo(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 hover:bg-green-500 text-white text-xl shadow-lg transition active:scale-95"
            title={isScreenSharing ? "Stop Screen Share" : "Stop Watching"}
          >
            🖥
          </button>

          <button
            onClick={onHangUp}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-2xl shadow-lg transition hover:bg-red-500 active:scale-95"
            title="Hang up"
          >
            📵
          </button>
        </div>
      </div>
    );
  }

  // ── Standard audio-call layout ──────────────────────────────────────
  return (
    <div className="flex h-full flex-col items-center justify-between bg-gray-900 py-8 text-white overflow-hidden">
      {/* Hidden audio for all peers */}
      {[...remoteStreams.entries()].map(([peerId, stream]) => (
        <RemoteAudio key={peerId} stream={stream} />
      ))}

      {/* Contact info */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-700 text-5xl font-bold">
          {displayName[0]?.toUpperCase()}
        </div>
        <p className="text-2xl font-semibold">{displayName}</p>
        <p className="text-sm text-gray-400">{statusLabel}</p>
        {inCall && (
          <p className="font-mono text-lg text-indigo-300">{fmt(elapsed)}</p>
        )}
      </div>

      {/* PTT hold button — only visible in push_to_talk mode while in the call */}
      {inCall && micMode === "push_to_talk" ? (
        <button
          onPointerDown={handlePttDown}
          onPointerUp={handlePttUp}
          onPointerLeave={handlePttUp}
          className={`flex h-28 w-28 items-center justify-center rounded-full text-5xl shadow-xl select-none transition-transform ${
            isPttActive
              ? "bg-green-500 scale-110 ring-4 ring-green-300"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
          title="Hold to talk"
        >
          🎤
        </button>
      ) : (
        <div /> /* spacer to keep layout consistent */
      )}

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-3 mt-4">
        <div className="flex gap-4">
          {/* Complete mute / unmute */}
          <button
            onClick={onToggleMute}
            className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition active:scale-95 ${
              isMuted
                ? "bg-red-700 hover:bg-red-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? "🔇" : "🎙"}
          </button>

          {/* Mic mode toggle: AON = Always On, PTT = Push to Talk */}
          <button
            onClick={onToggleMode}
            className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold shadow-lg transition active:scale-95 ${
              micMode === "push_to_talk"
                ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
            }`}
            title={micMode === "always_on" ? "Switch to Push to Talk" : "Switch to Always On"}
          >
            {micMode === "always_on" ? "PTT" : "AON"}
          </button>

          {/* Screen share */}
          <button
            onClick={onToggleScreenShare}
            className={`flex h-14 w-14 items-center justify-center rounded-full text-xl shadow-lg transition active:scale-95 ${
              isScreenSharing
                ? "bg-green-600 hover:bg-green-500 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
            }`}
            title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
          >
            🖥
          </button>

          {/* Hang up */}
          <button
            onClick={onHangUp}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-2xl shadow-lg transition hover:bg-red-500 active:scale-95"
            title="Hang up"
          >
            📵
          </button>
        </div>

        <p className="text-xs text-gray-500">
          {micMode === "always_on"
            ? "Mic always on — tap PTT to push‑to‑talk"
            : "Push to talk — tap AON for always‑on"}
        </p>
      </div>
    </div>
  );
}
