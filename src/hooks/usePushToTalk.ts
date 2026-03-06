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

  // Keep refs in sync so shortcut handlers always see current values
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { micModeRef.current = micMode; }, [micMode]);

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
