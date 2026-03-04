import { useEffect, useRef } from "react";

interface Props {
  stream: MediaStream;
  peerId: string;
  label?: string;
}

export function PeerVideo({ stream, peerId, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream.getVideoTracks().length > 0;

  return (
    <div className="relative flex flex-col items-center justify-center bg-gray-800 rounded-2xl overflow-hidden aspect-video min-w-[240px]">
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain bg-black"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 p-8">
          {/* Avatar placeholder */}
          <div className="w-16 h-16 rounded-full bg-indigo-700 flex items-center justify-center text-2xl font-bold text-white select-none">
            {(label ?? peerId).slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm text-gray-400 font-mono">{label ?? peerId.slice(0, 8)}</span>
          {/* Audio-only indicator */}
          <span className="text-xs text-green-400 animate-pulse">● audio only</span>
        </div>
      )}

      {/* Label overlay */}
      <div className="absolute bottom-2 left-3 text-xs text-gray-300 bg-black/50 px-2 py-0.5 rounded font-mono">
        {label ?? peerId.slice(0, 8)}
      </div>

      {/* Hidden audio element for audio-only streams */}
      {!hasVideo && (
        <audio
          ref={(el) => { if (el) el.srcObject = stream; }}
          autoPlay
        />
      )}
    </div>
  );
}
