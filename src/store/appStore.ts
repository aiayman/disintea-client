import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface Contact {
  id: string;
  name: string;
  online: boolean;
}

export interface LogEntry {
  ts: number;
  level: "info" | "warn" | "error";
  msg: string;
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
export type MicMode = "always_on" | "push_to_talk";

// ─────────────────────────────────────────────────────────────────────────────
// Full store shape
// ─────────────────────────────────────────────────────────────────────────────
export interface AppStore {
  // Identity (persisted)
  userId: string;
  username: string;
  setIdentity: (userId: string, username: string) => void;

  // Contacts (persisted as offline cache; server is source of truth)
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  upsertContact: (id: string, name: string, online: boolean) => void;
  removeContact: (id: string) => void;
  setContactOnline: (id: string, online: boolean, name?: string) => void;

  // Messages (in-memory; loaded from server)
  messages: Record<string, Message[]>;
  activeChat: string | null;
  setActiveChat: (id: string | null) => void;
  addMessage: (contactId: string, msg: Message) => void;
  setHistory: (contactId: string, msgs: Message[]) => void;

  // Call
  callState: CallState;
  callPeerId: string | null;
  incomingCall: IncomingCall | null;
  setCallState: (s: CallState) => void;
  setCallPeerId: (id: string | null) => void;
  setIncomingCall: (c: IncomingCall | null) => void;
  resetCall: () => void;

  // WS
  wsStatus: WsStatus;
  setWsStatus: (s: WsStatus) => void;

  // Server URL override (persisted; empty = use compiled-in default)
  serverUrl: string;
  setServerUrl: (url: string) => void;

  // Diagnostic log — last 300 entries, in-memory only (never persisted)
  logs: LogEntry[];
  addLog: (level: "info" | "warn" | "error", msg: string) => void;
  clearLogs: () => void;

  // Audio
  isMuted: boolean;
  isPttActive: boolean;
  isScreenSharing: boolean;
  pttKeys: string[];
  audioDeviceId: string;
  micMode: MicMode;
  setMuted: (v: boolean) => void;
  setPttActive: (v: boolean) => void;
  setScreenSharing: (v: boolean) => void;
  setPttKeys: (keys: string[]) => void;
  setAudioDeviceId: (id: string) => void;
  setMicMode: (mode: MicMode) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────
export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Identity
      userId: "",
      username: "",
      setIdentity: (userId, username) => set({ userId, username }),

      // Contacts
      contacts: [],
      setContacts: (contacts) => set({ contacts }),
      upsertContact: (id, name, online) =>
        set((s) => {
          const existing = s.contacts.find((c) => c.id === id);
          if (existing) {
            return {
              contacts: s.contacts.map((c) =>
                c.id === id ? { ...c, name, online } : c
              ),
            };
          }
          return { contacts: [...s.contacts, { id, name, online }] };
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
        set((s) => {
          const existing = s.messages[contactId] ?? [];
          // deduplicate by id
          if (existing.find((m) => m.id === msg.id)) return s;
          return { messages: { ...s.messages, [contactId]: [...existing, msg] } };
        }),
      setHistory: (contactId, msgs) =>
        set((s) => ({ messages: { ...s.messages, [contactId]: msgs } })),

      // Call
      callState: "idle",
      callPeerId: null,
      incomingCall: null,
      setCallState: (callState) => set({ callState }),
      setCallPeerId: (callPeerId) => set({ callPeerId }),
      setIncomingCall: (incomingCall) => set({ incomingCall }),
      resetCall: () =>
        set({ callState: "idle", callPeerId: null, incomingCall: null }),

      // WS
      wsStatus: "disconnected",
      setWsStatus: (wsStatus) => set({ wsStatus }),

      // Server URL override
      serverUrl: "",
      setServerUrl: (serverUrl) => set({ serverUrl }),

      // Diagnostic log
      logs: [],
      addLog: (level, msg) =>
        set((s) => {
          const entry: LogEntry = { ts: Date.now(), level, msg };
          const trimmed = s.logs.length >= 300 ? s.logs.slice(-299) : s.logs;
          return { logs: [...trimmed, entry] };
        }),
      clearLogs: () => set({ logs: [] }),

      // Audio
      isMuted: false,
      isPttActive: false,
      isScreenSharing: false,
      pttKeys: [],
      audioDeviceId: "",
      micMode: "always_on",
      setMuted: (isMuted) => set({ isMuted }),
      setPttActive: (isPttActive) => set({ isPttActive }),
      setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
      setPttKeys: (pttKeys) => set({ pttKeys }),
      setAudioDeviceId: (audioDeviceId) => set({ audioDeviceId }),
      setMicMode: (micMode) => set({ micMode }),
    }),
    {
      name: "disintea-app",
      // Persist identity + contacts (offline cache) + audio prefs
      partialize: (s) => ({
        userId: s.userId,
        username: s.username,
        contacts: s.contacts,
        pttKeys: s.pttKeys,
        audioDeviceId: s.audioDeviceId,
        serverUrl: s.serverUrl,
        micMode: s.micMode,
      }),
    }
  )
);
