import { useState } from "react";
import { useAppStore } from "../store/appStore";

interface Props {
  onStartChat: (contactId: string) => void;
  onStartCall: (contactId: string) => void;
  onAddContact: (contactId: string) => void;
  onRemoveContact: (contactId: string) => void;
  onOpenSettings: () => void;
  userId: string;
}

export function ContactList({ onStartChat, onStartCall, onAddContact, onRemoveContact, onOpenSettings, userId }: Props) {
  const { contacts, wsStatus, username, unreadFrom } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newId, setNewId] = useState("");
  const [showMyId, setShowMyId] = useState(false);

  const handleAdd = () => {
    const id = newId.trim();
    if (!id) return;
    onAddContact(id);
    setNewId("");
    setShowAddModal(false);
  };

  const wsColor =
    wsStatus === "connected"
      ? "bg-green-500"
      : wsStatus === "connecting"
      ? "bg-yellow-400"
      : "bg-red-500";

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${wsColor}`} title={wsStatus} />
          <span className="font-semibold">{username}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMyId((v) => !v)}
            className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-700"
            title="Show my ID"
          >
            My ID
          </button>
          <button
            onClick={onOpenSettings}
            className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-700"
            title="Settings"
          >
            ⚙
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500"
          >
            + Add Contact
          </button>
        </div>
      </div>

      {/* My ID banner */}
      {showMyId && (
        <button
          className="cursor-pointer bg-gray-800 px-4 py-2 text-center text-xs text-gray-400 hover:bg-gray-750 w-full"
          onClick={() => { navigator.clipboard?.writeText(userId); }}
          title="Click to copy"
        >
          Your ID: <span className="font-mono text-white break-all">{userId}</span>
          <span className="ml-2 text-indigo-400">📋 copy</span>
        </button>
      )}

      {/* Contacts */}
      <div className="flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
            <span className="text-4xl">👥</span>
            <p className="text-sm">No contacts yet.</p>
            <p className="text-xs text-gray-600">Share your ID with someone, then add theirs.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 group">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-700 text-lg font-semibold">
                    {c.name[0]?.toUpperCase()}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-gray-900 ${
                      c.online ? "bg-green-400" : "bg-gray-600"
                    }`}
                  />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`truncate ${unreadFrom.includes(c.id) ? "font-bold text-white" : "font-medium text-gray-200"}`}>
                    {c.name}
                    {unreadFrom.includes(c.id) && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-indigo-400 align-middle" />
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{c.online ? "Online" : "Offline"}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onStartChat(c.id)}
                    className="rounded-full p-2 text-gray-400 hover:bg-gray-700 hover:text-white"
                    title="Chat"
                  >
                    💬
                  </button>
                  <button
                    onClick={() => onStartCall(c.id)}
                    disabled={!c.online}
                    className={`rounded-full p-2 transition hover:bg-gray-700 disabled:opacity-30 ${
                      c.online ? "text-green-500 hover:text-green-400" : "text-gray-400"
                    }`}
                    title="Call"
                  >
                    📞
                  </button>
                  <button
                    onClick={() => onRemoveContact(c.id)}
                    className="rounded-full p-2 text-gray-400 hover:bg-red-900 hover:text-red-400"
                    title="Remove contact"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold">Add Contact</h2>
            <p className="mb-4 text-xs text-gray-400">
              Paste their user ID. They must have opened the app at least once.
            </p>

            <input
              className="mb-5 w-full rounded-lg bg-gray-700 px-4 py-2.5 font-mono text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="User ID…"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />

            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg bg-gray-700 py-2.5 font-medium hover:bg-gray-600"
                onClick={() => { setShowAddModal(false); setNewId(""); }}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-40"
                disabled={!newId.trim()}
                onClick={handleAdd}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
