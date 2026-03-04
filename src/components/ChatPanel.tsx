import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAppStore } from "../store/appStore";

interface Props {
  contactId: string;
  onBack: () => void;
  onCall: (contactId: string) => void;
  onSendMessage: (to: string, text: string, msgId: string) => void;
}

export function ChatPanel({ contactId, onBack, onCall, onSendMessage }: Props) {
  const { contacts, messages, userId, addMessage } = useAppStore();
  const contact = contacts.find((c) => c.id === contactId);
  const thread = messages[contactId] ?? [];
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    const msgId = uuidv4();
    const timestamp = Date.now();

    addMessage(contactId, { id: msgId, from: userId, text, timestamp, mine: true });
    onSendMessage(contactId, text, msgId);
    setDraft("");
  };

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white"
        >
          ←
        </button>

        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-700 font-semibold">
            {contact?.name[0]?.toUpperCase() ?? "?"}
          </div>
          <span
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-gray-900 ${
              contact?.online ? "bg-green-400" : "bg-gray-600"
            }`}
          />
        </div>

        <div className="flex-1">
          <p className="font-medium">{contact?.name ?? contactId}</p>
          <p className="text-xs text-gray-500">{contact?.online ? "Online" : "Offline"}</p>
        </div>

        <button
          onClick={() => onCall(contactId)}
          disabled={!contact?.online}
          className="rounded-full p-2 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30"
          title="Start call"
        >
          📞
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
        {thread.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No messages yet. Say hello!
          </div>
        ) : (
          thread.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${
                  msg.mine
                    ? "rounded-br-md bg-indigo-600 text-white"
                    : "rounded-bl-md bg-gray-700 text-white"
                }`}
              >
                <p>{msg.text}</p>
                <p className={`mt-1 text-xs ${msg.mine ? "text-indigo-200" : "text-gray-400"}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 px-4 py-3 flex gap-3">
        <input
          className="flex-1 rounded-full bg-gray-700 px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
        />
        <button
          className="rounded-full bg-indigo-600 px-4 py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-40"
          disabled={!draft.trim()}
          onClick={handleSend}
        >
          Send
        </button>
      </div>
    </div>
  );
}
