import { useCallback, useEffect, useRef } from "react";
import { isTauri } from "../lib/tauri-compat";
import { useAppStore } from "../store/appStore";

const STORE_FILE = "disintea-settings.json";
const PTT_KEYS_KEY = "pttKeys";
const PTT_LS_KEY = "disintea_ptt_keys";

/** Load saved PTT keys (Tauri store or localStorage fallback) */
export async function loadPttKeys(): Promise<string[]> {
  if (isTauri()) {
    const { load: loadStore } = await import("@tauri-apps/plugin-store");
    const store = await loadStore(STORE_FILE);
    const val = await store.get<string[]>(PTT_KEYS_KEY);
    return val ?? [];
  }
  try {
    const raw = localStorage.getItem(PTT_LS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Save PTT keys (Tauri store or localStorage fallback) */
export async function savePttKeys(keys: string[]): Promise<void> {
  if (isTauri()) {
    const { load: loadStore } = await import("@tauri-apps/plugin-store");
    const store = await loadStore(STORE_FILE);
    await store.set(PTT_KEYS_KEY, keys);
    await store.save();
    return;
  }
  localStorage.setItem(PTT_LS_KEY, JSON.stringify(keys));
}

/** Convert a KeyboardEvent to a Tauri-compatible accelerator string */
export function normalizeKey(e: KeyboardEvent): string {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  const k = e.code === "Space" ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.code;
  return [...mods, k].join("+");
}

/** Convert a MouseEvent button index to a stable string identifier */
export function normalizeMouseButton(e: MouseEvent): string {
  const names: Record<number, string> = {
    0: "MouseLeft", 1: "MouseMiddle", 2: "MouseRight", 3: "MouseBack", 4: "MouseForward",
  };
  return names[e.button] ?? `Mouse${e.button}`;
}

const GAMEPAD_BUTTON_NAMES: Record<number, string> = {
  0: "A / Cross",   1: "B / Circle", 2: "X / Square", 3: "Y / Triangle",
  4: "LB / L1",     5: "RB / R1",   6: "LT / L2",    7: "RT / R2",
  8: "Back / Share", 9: "Start / Options",
  10: "L3", 11: "R3",
  12: "D\u2191", 13: "D\u2193", 14: "D\u2190", 15: "D\u2192", 16: "Home",
};

/** Format a stored PTT identifier for human-readable display */
export function formatPttKey(key: string): string {
  if (key.startsWith("GP:B")) {
    const idx = parseInt(key.slice(4), 10);
    return `\uD83C\uDFAE ${GAMEPAD_BUTTON_NAMES[idx] ?? `Button ${idx}`}`;
  }
  const mouseLabels: Record<string, string> = {
    MouseLeft: "\uD83D\uDDB1 Left Click",   MouseMiddle: "\uD83D\uDDB1 Middle Click",
    MouseRight: "\uD83D\uDDB1 Right Click",  MouseBack: "\uD83D\uDDB1 Back",
    MouseForward: "\uD83D\uDDB1 Forward",
  };
  if (key in mouseLabels) return mouseLabels[key];
  return key;
}

/**
 * Manages push-to-talk: registers/unregisters OS-level global shortcuts (Tauri only)
 * and toggles the mic track when keys are pressed/released.
 * In a plain browser context, PTT keys are stored but shortcuts are not registered
 * (OS-level interception is not available in browsers).
 */
export function usePushToTalk(
  setMicEnabled: (enabled: boolean) => void,
) {
  const { pttKeys, setPttKeys, setPttActive, isMuted, micMode } = useAppStore();
  const isMutedRef = useRef(isMuted);
  const micModeRef = useRef(micMode);
  const pttKeysRef = useRef(pttKeys);

  // Keep refs in sync so shortcut handlers always see current values
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { micModeRef.current = micMode; }, [micMode]);
  useEffect(() => { pttKeysRef.current = pttKeys; }, [pttKeys]);

  // ── DOM keyboard + mouse listeners (primary PTT mechanism when app is focused) ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (micModeRef.current !== "push_to_talk") return;
      if (isMutedRef.current) return;
      if (!pttKeysRef.current.includes(normalizeKey(e))) return;
      // Skip when the user is typing in a text field
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      setMicEnabled(true);
      setPttActive(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (micModeRef.current !== "push_to_talk") return;
      if (pttKeysRef.current.includes(normalizeKey(e))) {
        setMicEnabled(false);
        setPttActive(false);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (micModeRef.current !== "push_to_talk") return;
      if (isMutedRef.current) return;
      if (pttKeysRef.current.includes(normalizeMouseButton(e))) {
        setMicEnabled(true);
        setPttActive(true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (micModeRef.current !== "push_to_talk") return;
      if (pttKeysRef.current.includes(normalizeMouseButton(e))) {
        setMicEnabled(false);
        setPttActive(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [setMicEnabled, setPttActive]);

  // ── Gamepad polling via requestAnimationFrame (works while app is focused) ──
  useEffect(() => {
    let raf: number;
    const prevStates = new Map<number, boolean[]>();

    const poll = () => {
      if (micModeRef.current === "push_to_talk") {
        for (const gp of navigator.getGamepads()) {
          if (!gp) continue;
          const prev = prevStates.get(gp.index) ?? (new Array(gp.buttons.length).fill(false) as boolean[]);
          for (let i = 0; i < gp.buttons.length; i++) {
            const key = `GP:B${i}`;
            const pressed = gp.buttons[i].pressed;
            if (pttKeysRef.current.includes(key)) {
              if (pressed && !prev[i] && !isMutedRef.current) {
                setMicEnabled(true);
                setPttActive(true);
              } else if (!pressed && prev[i]) {
                setMicEnabled(false);
                setPttActive(false);
              }
            }
            prev[i] = pressed;
          }
          prevStates.set(gp.index, prev);
        }
      }
      raf = requestAnimationFrame(poll);
    };

    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [setMicEnabled, setPttActive]);

  /** Re-register all PTT shortcuts (Tauri only) */
  const registerShortcuts = useCallback(async (keys: string[]) => {
    if (!isTauri()) return;

    const { register, unregisterAll } = await import("@tauri-apps/plugin-global-shortcut");
    type ShortcutEvent = { state: "Pressed" | "Released" };
    await unregisterAll();

    // In always_on mode PTT shortcuts do nothing — mic is always live
    if (micModeRef.current === "always_on") return;

    for (const key of keys) {
      try {
        await register(key, (evt: ShortcutEvent) => {
          if (isMutedRef.current) return; // complete mute overrides PTT
          if (evt.state === "Pressed") {
            setMicEnabled(true);
            setPttActive(true);
          } else if (evt.state === "Released") {
            setMicEnabled(false);
            setPttActive(false);
          }
        });
      } catch (e) {
        console.error(`[ptt] failed to register shortcut "${key}":`, e);
      }
    }
  }, [setMicEnabled, setPttActive]);

  /** Bootstrap: load keys from store and register */
  useEffect(() => {
    loadPttKeys().then((keys) => {
      setPttKeys(keys);
      if (keys.length > 0) registerShortcuts(keys);
    });

    return () => {
      if (isTauri()) {
        import("@tauri-apps/plugin-global-shortcut").then(({ unregisterAll }) => {
          unregisterAll();
        });
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply shortcut registration whenever the mic mode changes
  useEffect(() => {
    void registerShortcuts(pttKeys);
  }, [micMode]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Add a new PTT key */
  const addKey = useCallback(async (key: string) => {
    const next = [...new Set([...pttKeys, key])];
    setPttKeys(next);
    await savePttKeys(next);
    await registerShortcuts(next);
  }, [pttKeys, setPttKeys, registerShortcuts]);

  /** Remove a PTT key */
  const removeKey = useCallback(async (key: string) => {
    const next = pttKeys.filter((k) => k !== key);
    setPttKeys(next);
    await savePttKeys(next);
    await registerShortcuts(next);
  }, [pttKeys, setPttKeys, registerShortcuts]);

  return { addKey, removeKey };
}
