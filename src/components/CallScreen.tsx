import { useAppStore } from "../store/appStore";
import type { RemoteStreams } from "../hooks/useWebRTC";
import { PeerVideo } from "./PeerVideo";

interface Props {
  remoteStreams: RemoteStreams;
  onHangUp: () => void;
  onToggleMute: () => void;
}

export function CallScreen({ remoteStreams, onHangUp, onToggleMute }: Props) {
  const { callState, callPeerId, contacts, isMuted } = useAppStore();

  const contact = contacts.find((c) => c.id === callPeerId);
  const displayName = contact?.name ?? callPeerId ?? "Unknown";

  const statusLabel =
    callState === "calling"
      ? "Calling…"
      : callState === "ringing"
      ? "Incoming…"
      : "In call";

  return (
    <div className="flex h-screen flex-col items-center justify-between bg-gray-900 py-12 text-white">
      {/* Contact info */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-700 text-5xl font-bold">
          {displayName[0]?.toUpperCase()}
        </div>
        <p className="text-2xl font-semibold">{displayName}</p>
        <p className="text-sm text-gray-400">{statusLabel}</p>
      </div>

      {/* Remote audio tiles (hidden but needed for audio) */}
      <div className="hidden">
        {[...remoteStreams.entries()].map(([peerId, stream]) => (
          <PeerVideo key={peerId} stream={stream} peerId={peerId} />
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-8">
        <button
          onClick={onToggleMute}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-lg transition active:scale-95 ${
            isMuted
              ? "bg-red-700 hover:bg-red-600"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? "🔇" : "🎙"}
        </button>

        <button
          onClick={onHangUp}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl shadow-lg transition hover:bg-red-500 active:scale-95"
          title="Hang up"
        >
          📵
        </button>
      </div>
    </div>
  );
}
