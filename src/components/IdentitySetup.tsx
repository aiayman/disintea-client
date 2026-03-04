import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAppStore } from "../store/appStore";

export function IdentitySetup() {
  const [name, setName] = useState("");
  const { setIdentity } = useAppStore();

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = uuidv4();
    setIdentity(id, trimmed);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900">
      <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Welcome to Disintea</h1>
        <p className="mb-6 text-sm text-gray-400">
          Choose a display name to get started. Your unique ID is generated automatically.
        </p>

        <input
          className="mb-4 w-full rounded-lg bg-gray-700 px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500"
          type="text"
          placeholder="Your name…"
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
        />

        <button
          className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40"
          disabled={!name.trim()}
          onClick={handleSubmit}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
