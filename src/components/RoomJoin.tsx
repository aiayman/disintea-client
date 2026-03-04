import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useCallStore } from "../store/callStore";

interface Props {
  onJoin: () => void;
}

export function RoomJoin({ onJoin }: Props) {
  const { setRoomCode, setMyPeerId, roomCode } = useCallStore();
  const [inputCode, setInputCode] = useState(roomCode);
  const [error, setError] = useState("");

  const handleJoin = () => {
    const code = inputCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("Room code must be at least 4 characters.");
      return;
    }
    setError("");
    setRoomCode(code);
    setMyPeerId(uuidv4());
    onJoin();
  };

  const handleCreate = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    setInputCode(code);
    setRoomCode(code);
    setMyPeerId(uuidv4());
    onJoin();
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-8 px-6">
      <div className="flex flex-col items-center gap-2">
        <div className="text-4xl font-bold tracking-tight text-white">disintea</div>
        <div className="text-sm text-gray-400">voice calls &amp; screen sharing</div>
      </div>

      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4 shadow-xl">
        <label className="text-sm font-medium text-gray-300">Join with invite code</label>
        <input
          className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-widest"
          placeholder="e.g. XKCD42"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          maxLength={16}
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors"
          onClick={handleJoin}
        >
          Join Room
        </button>

        <div className="flex items-center gap-3">
          <hr className="flex-1 border-gray-600" />
          <span className="text-xs text-gray-500">or</span>
          <hr className="flex-1 border-gray-600" />
        </div>

        <button
          className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded-lg transition-colors"
          onClick={handleCreate}
        >
          Create New Room
        </button>
      </div>
    </div>
  );
}
