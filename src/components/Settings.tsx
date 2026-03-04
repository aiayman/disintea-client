import { useEffect, useState } from "react";
import { useCallStore } from "../store/callStore";
import { usePushToTalk } from "../hooks/usePushToTalk";

interface Props {
  onClose: () => void;
  setMicEnabled: (v: boolean) => void;
}

export function Settings({ onClose, setMicEnabled }: Props) {
  const { pttKeys, audioDeviceId, setAudioDeviceId } = useCallStore();
  const { addKey, removeKey } = usePushToTalk(setMicEnabled);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
    });
  }, []);

  const startBinding = () => {
    setBinding(true);

    const onKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();
      const key = normalizeKey(e);
      setBinding(false);
      window.removeEventListener("keydown", onKeyDown);
      await addKey(key);
    };

    window.addEventListener("keydown", onKeyDown);

    // Cancel if window loses focus
    const onBlur = () => {
      setBinding(false);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
    window.addEventListener("blur", onBlur);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Settings</h2>
          <button className="text-gray-400 hover:text-white text-xl" onClick={onClose}>×</button>
        </div>

        {/* Push-to-Talk keys */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Push to Talk</h3>
          <p className="text-xs text-gray-500">
            Hold any bound key to unmute your mic. You can bind multiple keys.
          </p>

          <div className="flex flex-wrap gap-2">
            {pttKeys.map((key) => (
              <div
                key={key}
                className="flex items-center gap-1.5 bg-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white"
              >
                {key}
                <button
                  onClick={() => removeKey(key)}
                  className="text-gray-400 hover:text-red-400 ml-1 text-xs"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={startBinding}
            disabled={binding}
            className={`
              w-full py-2 rounded-lg text-sm font-medium transition-colors
              ${binding
                ? "bg-indigo-700 text-indigo-200 cursor-wait animate-pulse"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"}
            `}
          >
            {binding ? "Press a key to bind…" : "+ Add PTT Key"}
          </button>
        </section>

        {/* Microphone device */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Microphone</h3>
          <select
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={audioDeviceId}
            onChange={(e) => setAudioDeviceId(e.target.value)}
          >
            <option value="">Default</option>
            {audioDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || d.deviceId.slice(0, 12)}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">Device change applies on next call.</p>
        </section>

        <button
          className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}

/** Convert a KeyboardEvent into a Tauri-compatible accelerator string */
function normalizeKey(e: KeyboardEvent): string {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  // For single keys, use the code (e.g. Space, KeyV, F1)
  const key = e.code === "Space" ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.code;
  return [...mods, key].join("+");
}
