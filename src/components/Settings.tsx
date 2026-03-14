import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/appStore";
import { usePushToTalk, normalizeKey, normalizeMouseButton, formatPttKey } from "../hooks/usePushToTalk";
import { isTauri } from "../lib/tauri-compat";
import { getVersion } from "@tauri-apps/api/app";

interface Props {
  onClose: () => void;
  setMicEnabled: (v: boolean) => void;
  onReconnect: () => void;
}

export function Settings({ onClose, setMicEnabled, onReconnect }: Props) {
  const { pttKeys, audioDeviceId, setAudioDeviceId, serverUrl, setServerUrl, logs, clearLogs, wsStatus } = useAppStore();
  const { addKey, removeKey } = usePushToTalk(setMicEnabled);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [binding, setBinding] = useState(false);
  const [urlDraft, setUrlDraft] = useState(serverUrl);
  const [showDiag, setShowDiag] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTauri()) {
      getVersion().then(setAppVersion).catch(() => {});
    }
  }, []);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
    });
  }, []);

  useEffect(() => {
    if (showDiag) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [showDiag, logs.length]);

  const startBinding = () => {
    setBinding(true);
    let done = false;
    let gpRaf = 0;

    const finish = async (inputId: string) => {
      if (done) return;
      done = true;
      setBinding(false);
      cleanup();
      await addKey(inputId);
    };

    const onKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();
      await finish(normalizeKey(e));
    };

    const onMouseDown = async (e: MouseEvent) => {
      e.preventDefault();
      await finish(normalizeMouseButton(e));
    };

    const prevGPButtons = new Map<number, boolean[]>();
    const pollGamepad = async (): Promise<void> => {
      for (const gp of navigator.getGamepads()) {
        if (!gp) continue;
        const prev = prevGPButtons.get(gp.index) ?? (new Array(gp.buttons.length).fill(false) as boolean[]);
        for (let i = 0; i < gp.buttons.length; i++) {
          if (gp.buttons[i].pressed && !prev[i]) {
            await finish(`GP:B${i}`);
            return;
          }
          prev[i] = gp.buttons[i].pressed;
        }
        prevGPButtons.set(gp.index, prev);
      }
      if (!done) gpRaf = requestAnimationFrame(() => { void pollGamepad(); });
    };

    const cleanup = () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("blur", onBlur);
      cancelAnimationFrame(gpRaf);
    };

    const onBlur = () => {
      done = true;
      setBinding(false);
      cleanup();
    };

    window.addEventListener("keydown", onKeyDown);
    // Delay mouse listener slightly to avoid capturing the click that opened binding
    setTimeout(() => { if (!done) window.addEventListener("mousedown", onMouseDown); }, 200);
    window.addEventListener("blur", onBlur);
    gpRaf = requestAnimationFrame(() => { void pollGamepad(); });
  };

  const handleDone = () => {
    const trimmed = urlDraft.trim();
    if (trimmed !== serverUrl) {
      setServerUrl(trimmed);
      onClose();
      onReconnect();
    } else {
      onClose();
    }
  };

  const copyLogs = () => {
    const text = logs
      .map((e) => `[${new Date(e.ts).toISOString()}] [${e.level.toUpperCase()}] ${e.msg}`)
      .join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const wsColor =
    wsStatus === "connected" ? "text-green-400" :
    wsStatus === "connecting" ? "text-yellow-400" : "text-red-400";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={handleDone}>
      <div
        className="bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Settings</h2>
          <button className="text-gray-400 hover:text-white text-xl" onClick={handleDone}>×</button>
        </div>

        {/* Server connection */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Server</h3>
          <p className="text-xs text-gray-500">
            Paste your server's WebSocket URL. Changing this reconnects immediately.
            Use plain <span className="font-mono text-gray-400">ws://</span> (not wss://) unless you have a real TLS certificate.
            Example: <span className="font-mono text-gray-400">ws://161.97.187.145:8080/ws</span>
          </p>
          <input
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 font-mono text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="wss://your-server:8443/ws"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          <div className="flex items-center gap-2 text-xs">
            <span className={`font-medium ${wsColor}`}>● {wsStatus}</span>
            {urlDraft.trim() && urlDraft.trim() !== serverUrl && (
              <span className="text-yellow-400">▲ unsaved — click Done to apply</span>
            )}
          </div>
        </section>

        {/* Push-to-Talk keys — Tauri desktop only */}
        {isTauri() && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Push to Talk</h3>
          <p className="text-xs text-gray-500">
            Hold any bound key, mouse button, or controller button to unmute. You can bind multiple.
          </p>
          <div className="flex flex-wrap gap-2">
            {pttKeys.map((key) => (
              <div
                key={key}
                className="flex items-center gap-1.5 bg-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
              >
                {formatPttKey(key)}
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
            {binding ? "Press a key, mouse button or controller button…" : "+ Add PTT Key"}
          </button>
        </section>
        )}

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

        {/* Diagnostics */}
        <section className="flex flex-col gap-2">
          <button
            className="flex items-center justify-between text-sm font-semibold text-gray-300 uppercase tracking-wide hover:text-white"
            onClick={() => setShowDiag((v) => !v)}
          >
            <span>Diagnostics</span>
            <span className="text-xs normal-case text-gray-500">{showDiag ? "▲ hide" : "▼ show"}</span>
          </button>
          {showDiag && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end gap-2">
                <button
                  onClick={copyLogs}
                  className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                  title="Copy all log entries to clipboard"
                >
                  📋 Copy logs
                </button>
                <button
                  onClick={clearLogs}
                  className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  🗑 Clear
                </button>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs space-y-0.5">
                {logs.length === 0 ? (
                  <p className="text-gray-600">No log entries yet.</p>
                ) : (
                  logs.map((e, i) => (
                    <div
                      key={i}
                      className={
                        e.level === "error" ? "text-red-400" :
                        e.level === "warn" ? "text-yellow-400" : "text-gray-400"
                      }
                    >
                      <span className="text-gray-600">{new Date(e.ts).toISOString().slice(11, 23)}</span>{" "}
                      {e.msg}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </section>

        <button
          className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors"
          onClick={handleDone}
        >
          Done
        </button>

        {appVersion && (
          <p className="text-center text-xs text-gray-600">Disintea v{appVersion}</p>
        )}
      </div>
    </div>
  );
}


