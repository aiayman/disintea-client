import { useCallback, useEffect, useRef } from "react";
import {
  register,
  unregisterAll,
  type ShortcutEvent,
} from "@tauri-apps/plugin-global-shortcut";
import { load as loadStore } from "@tauri-apps/plugin-store";
import { useCallStore } from "../store/callStore";

const STORE_FILE = "dismony-settings.json";
const PTT_KEYS_KEY = "pttKeys";

/** Load saved PTT keys from the persistent store */
export async function loadPttKeys(): Promise<string[]> {
  const store = await loadStore(STORE_FILE);
  const val = await store.get<string[]>(PTT_KEYS_KEY);
  return val ?? [];
}

/** Save PTT keys to the persistent store */
export async function savePttKeys(keys: string[]): Promise<void> {
  const store = await loadStore(STORE_FILE);
  await store.set(PTT_KEYS_KEY, keys);
  await store.save();
}

/**
 * Manages push-to-talk: registers/unregisters OS-level global shortcuts
 * and toggles the mic track when keys are pressed/released.
 */
export function usePushToTalk(
  setMicEnabled: (enabled: boolean) => void,
) {
  const { pttKeys, setPttKeys, setPttActive, isMuted } = useCallStore();
  const isMutedRef = useRef(isMuted);

  // Keep ref in sync so the shortcut handler always sees current mute state
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  /** Re-register all PTT shortcuts */
  const registerShortcuts = useCallback(async (keys: string[]) => {
    await unregisterAll();

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

    return () => { unregisterAll(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
