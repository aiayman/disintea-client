import { create } from "zustand";

export type CallStatus = "idle" | "connecting" | "connected" | "disconnected";

export interface CallState {
  // Connection
  status: CallStatus;
  roomCode: string;
  myPeerId: string;
  remotePeerIds: string[];

  // Audio
  isMuted: boolean;         // complete mute — ignores PTT
  isPttActive: boolean;     // true while PTT key is held

  // Screen share
  isScreenSharing: boolean;

  // Settings
  pttKeys: string[];        // e.g. ["Space", "KeyV"]
  audioDeviceId: string;    // selected mic deviceId, "" = default

  // Setters
  setStatus: (s: CallStatus) => void;
  setRoomCode: (code: string) => void;
  setMyPeerId: (id: string) => void;
  addRemotePeer: (id: string) => void;
  removeRemotePeer: (id: string) => void;
  setMuted: (v: boolean) => void;
  setPttActive: (v: boolean) => void;
  setScreenSharing: (v: boolean) => void;
  setPttKeys: (keys: string[]) => void;
  setAudioDeviceId: (id: string) => void;
  reset: () => void;
}

const initialState = {
  status: "idle" as CallStatus,
  roomCode: "",
  myPeerId: "",
  remotePeerIds: [],
  isMuted: false,
  isPttActive: false,
  isScreenSharing: false,
  pttKeys: [],
  audioDeviceId: "",
};

export const useCallStore = create<CallState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setMyPeerId: (myPeerId) => set({ myPeerId }),
  addRemotePeer: (id) =>
    set((s) => ({ remotePeerIds: [...s.remotePeerIds, id] })),
  removeRemotePeer: (id) =>
    set((s) => ({ remotePeerIds: s.remotePeerIds.filter((p) => p !== id) })),
  setMuted: (isMuted) => set({ isMuted }),
  setPttActive: (isPttActive) => set({ isPttActive }),
  setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
  setPttKeys: (pttKeys) => set({ pttKeys }),
  setAudioDeviceId: (audioDeviceId) => set({ audioDeviceId }),
  reset: () => set(initialState),
}));
