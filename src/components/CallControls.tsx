import { useCallStore } from "../store/callStore";
import {
  MicrophoneIcon,
  NoSymbolIcon,
  ComputerDesktopIcon,
  PhoneXMarkIcon,
} from "@heroicons/react/24/solid";

interface Props {
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleScreenShare: () => void;
  onOpenSettings: () => void;
}

export function CallControls({
  onHangUp,
  onToggleMute,
  onToggleScreenShare,
  onOpenSettings,
}: Props) {
  const { isMuted, isPttActive, isScreenSharing, pttKeys, roomCode, status } = useCallStore();

  return (
    <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gray-900 border-t border-gray-700">
      {/* Room info */}
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-gray-500 uppercase tracking-wider">Room</span>
        <span className="text-sm font-mono font-bold text-white tracking-widest">{roomCode}</span>
        <span className={`text-xs mt-0.5 ${status === "connected" ? "text-green-400" : "text-yellow-400"}`}>
          {status}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Mute */}
        <button
          title={isMuted ? "Unmute" : "Complete Mute"}
          onClick={onToggleMute}
          className={`
            p-3 rounded-full transition-all
            ${isMuted
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-gray-300"}
          `}
        >
          {isMuted ? (
            <NoSymbolIcon className="w-5 h-5" />
          ) : (
            <MicrophoneIcon className="w-5 h-5" />
          )}
        </button>

        {/* Screen share */}
        <button
          title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
          onClick={onToggleScreenShare}
          className={`
            p-3 rounded-full transition-all
            ${isScreenSharing
              ? "bg-indigo-600 hover:bg-indigo-500 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-gray-300"}
          `}
        >
          <ComputerDesktopIcon className="w-5 h-5" />
        </button>

        {/* Hang up */}
        <button
          title="Leave Call"
          onClick={onHangUp}
          className="p-3 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
        >
          <PhoneXMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* PTT indicator + settings */}
      <div className="flex flex-col items-end gap-1 min-w-[80px]">
        <button
          onClick={onOpenSettings}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          ⚙ Settings
        </button>
        {pttKeys.length > 0 && (
          <div
            className={`
              px-2 py-0.5 rounded text-xs font-mono select-none
              ${isPttActive
                ? "bg-green-500 text-black ptt-active"
                : "bg-gray-700 text-gray-400"}
            `}
          >
            {isPttActive ? "● TALKING" : `PTT: ${pttKeys[0]}`}
          </div>
        )}
        {pttKeys.length === 0 && (
          <span className="text-xs text-gray-600">no PTT bound</span>
        )}
      </div>
    </div>
  );
}
