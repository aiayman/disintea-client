import { useState } from "react";
import { useAppStore } from "../store/appStore";

interface Props {
  onStartChat: (contactId: string) => void;
  onStartCall: (contactId: string) => void;
  userId: string;
}

export function ContactList({ onStartChat, onStartCall, userId }: Props) {
  const { contacts, addContact, wsStatus, username } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [showMyId, setShowMyId] = useState(false);

  const handleAdd = () => {
    const id = newId.trim();
    const name = newName.trim();
    if (!id || !name) return;
    addContact(id, name);
    setNewId("");
    setNewName("");
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
          <span
            className={`h-2.5 w-2.5 rounded-full ${wsColor}`}
            title={wsStatus}
          />
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
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500"
          >
            + Add Contact
          </button>
        </div>
      </div>

      {/* My ID banner */}
      {showMyId && (
        <div
          className="cursor-pointer bg-gray-800 px-4 py-2 text-center text-xs text-gray-400"
          onClick={() => { navigator.clipboard?.writeText(userId); }}
          title="Click to copy"
        >
          Your ID: <span className="font-mono text-white">{userId}</span>
        </div>
      )}

      {/* Contacts */}
      <div className="flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
            <span className="text-4xl">👥</span>
            <p className="text-sm">No contacts yet. Add one to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800"
              >
                {/* Avatar */}
                <div className="relative">
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
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.online ? "Online" : "Offline"}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
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
                    className="rounded-full p-2 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30"
                    title="Call"
                  >
                    📞
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
            <h2 className="mb-4 text-lg font-semibold">Add Contact</h2>

            <input
              className="mb-3 w-full rounded-lg bg-gray-700 px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Their name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <input
              className="mb-5 w-full rounded-lg bg-gray-700 px-4 py-2.5 font-mono text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Their user ID…"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg bg-gray-700 py-2.5 font-medium hover:bg-gray-600"
                onClick={() => { setShowAddModal(false); setNewId(""); setNewName(""); }}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-40"
                disabled={!newId.trim() || !newName.trim()}
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
