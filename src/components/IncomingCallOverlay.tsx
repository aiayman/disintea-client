import { useAppStore } from "../store/appStore";

interface Props {
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallOverlay({ onAccept, onReject }: Props) {
  const { incomingCall } = useAppStore();

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-gray-800 px-12 py-10 shadow-2xl">
        {/* Avatar */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-700 text-4xl font-bold text-white">
          {incomingCall.fromName[0]?.toUpperCase() ?? "?"}
        </div>

        <div className="text-center">
          <p className="text-xl font-semibold text-white">{incomingCall.fromName}</p>
          <p className="mt-1 text-sm text-gray-400">Incoming voice call…</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-8">
          <button
            onClick={onReject}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl shadow-lg transition hover:bg-red-500 active:scale-95"
            title="Decline"
          >
            📵
          </button>
          <button
            onClick={onAccept}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-2xl shadow-lg transition hover:bg-green-500 active:scale-95"
            title="Accept"
          >
            📞
          </button>
        </div>
      </div>
    </div>
  );
}
