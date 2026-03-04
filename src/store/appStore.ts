import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Contact {
  id: string;
  name: string;
  online: boolean;
}

export interface Message {
  id: string;
  from: string;
  text: string;
  timestamp: number;
  mine: boolean;
}

export interface IncomingCall {
  from: string;
  fromName: string;
  sdp: string;
}

export type CallState = "idle" | "calling" | "ringing" | "in_call";
export type WsStatus = "disconnected" | "connecting" | "connected";

// ---------------------------------------------------------------------------
// Identity (persisted)
// ---------------------------------------------------------------------------
interface IdentitySlice {
  userId: string;
  username: string;
  setIdentity: (userId: string, username: string) => void;
}

// ---------------------------------------------------------------------------
// Contacts (persisted)
// ---------------------------------------------------------------------------
interface ContactsSlice {
  contacts: Contact[];
  addContact: (id: string, name: string) => void;
  removeContact: (id: string) => void;
  setContactOnline: (id: string, online: boolean, name?: string) => void;
}

// ---------------------------------------------------------------------------
// Messages (in-memory)
// ---------------------------------------------------------------------------
interface MessagesSlice {
  messages: Record<string, Message[]>;
  activeChat: string | null;
  setActiveChat: (id: string | null) => void;
  addMessage: (contactId: string, msg: Message) => void;
}

// ---------------------------------------------------------------------------
// Call state (in-memory)
// ---------------------------------------------------------------------------
interface CallSlice {
  callState: CallState;
  callPeerId: string | null;
  incomingCall: IncomingCall | null;
  setCallState: (s: CallState) => void;
  setCallPeerId: (id: string | null) => void;
  setIncomingCall: (c: IncomingCall | null) => void;
  resetCall: () => void;
}

// ---------------------------------------------------------------------------
// WebSocket status (in-memory)
// ---------------------------------------------------------------------------
interface WsSlice {
  wsStatus: WsStatus;
  setWsStatus: (s: WsStatus) => void;
}

// ---------------------------------------------------------------------------
// Audio (persisted)
// ---------------------------------------------------------------------------
interface AudioSlice {
  isMuted: boolean;
  isPttActive: boolean;
  isScreenSharing: boolean;
  pttKeys: string[];
  audioDeviceId: string;
  setMuted: (v: boolean) => void;
  setPttActive: (v: boolean) => void;
  setScreenSharing: (v: boolean) => void;
  setPttKeys: (keys: string[]) => void;
  setAudioDeviceId: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Combined store
// ---------------------------------------------------------------------------
export type AppStore = IdentitySlice &
  ContactsSlice &
  MessagesSlice &
  CallSlice &
  WsSlice &
  AudioSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Identity
      userId: "",
      username: "",
      setIdentity: (userId, username) => set({ userId, username }),

      // Contacts
      contacts: [],
      addContact: (id, name) =>
        set((s) => {
          if (s.contacts.find((c) => c.id === id)) return s;
          return { contacts: [...s.contacts, { id, name, online: false }] };
        }),
      removeContact: (id) =>
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
      setContactOnline: (id, online, name) =>
        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.id === id ? { ...c, online, name: name ?? c.name } : c
          ),
        })),

      // Messages
      messages: {},
      activeChat: null,
      setActiveChat: (id) => set({ activeChat: id }),
      addMessage: (contactId, msg) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [contactId]: [...(s.messages[contactId] ?? []), msg],
          },
        })),

      // Call
      callState: "idle",
      callPeerId: null,
      incomingCall: null,
      setCallState: (callState) => set({ callState }),
      setCallPeerId: (callPeerId) => set({ callPeerId }),
      setIncomingCall: (incomingCall) => set({ incomingCall }),
      resetCall: () => set({ callState: "idle", callPeerId: null, incomingCall: null }),

      // WS
      wsStatus: "disconnected",
      setWsStatus: (wsStatus) => set({ wsStatus }),

      // Audio
      isMuted: false,
      isPttActive: false,
      isScreenSharing: false,
      pttKeys: [],
      audioDeviceId: "",
      setMuted: (isMuted) => set({ isMuted }),
      setPttActive: (isPttActive) => set({ isPttActive }),
      setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
      setPttKeys: (pttKeys) => set({ pttKeys }),
      setAudioDeviceId: (audioDeviceId) => set({ audioDeviceId }),
    }),
    {
      name: "disintea-app",
      // Only persist identity, contacts, audio settings (not in-memory state)
      partialize: (s) => ({
        userId: s.userId,
        username: s.username,
        contacts: s.contacts,
        pttKeys: s.pttKeys,
        audioDeviceId: s.audioDeviceId,
      }),
    }
  )
);
