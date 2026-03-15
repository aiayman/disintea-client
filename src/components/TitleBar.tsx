import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../lib/tauri-compat";

export function TitleBar() {
  useEffect(() => {
    if (!isTauri()) return;
    // Give the webview OS focus immediately on open. Without this, on Windows
    // with decorations:false the first click focuses the window instead of
    // triggering the handler, making everything appear dead on first launch.
    getCurrentWindow().setFocus().catch(() => {});
  }, []);

  if (!isTauri()) return null;

  const win = getCurrentWindow();

  // Use onPointerDown (not onClick) for chrome buttons. On Windows, if the
  // window somehow lacks OS focus the browser never fires 'click' after a
  // pointerdown, but 'pointerdown' itself still fires — so actions work even
  // on that first interaction.
  const makeHandler = (action: () => void) => (e: React.PointerEvent) => {
    e.stopPropagation();
    action();
  };

  return (
    <div className="flex h-8 w-full shrink-0 items-center bg-gray-900 border-b border-gray-800 select-none">
      {/*
        data-tauri-drag-region is placed ONLY on this left container.
        ALL children have pointer-events:none so the div itself is always
        the event target — Tauri's walk finds data-tauri-drag-region
        immediately and initiates the OS-level drag synchronously.
        The buttons div is a SIBLING (not a descendant) so Tauri's upward
        DOM walk from a button click never reaches this element.
      */}
      <div
        className="flex flex-1 h-full items-center gap-2 px-3 cursor-default"
        data-tauri-drag-region
      >
        <img
          src="/disintea-darkicon.svg"
          alt=""
          className="h-3.5 w-3.5 opacity-70"
          draggable={false}
          style={{ pointerEvents: "none" }}
        />
        <span
          className="text-xs font-semibold tracking-wide text-gray-500"
          style={{ pointerEvents: "none" }}
        >
          Disintea
        </span>
      </div>

      {/* Buttons are siblings, NOT inside the drag region */}
      <div className="flex h-full">
        <button
          onPointerDown={makeHandler(() => win.minimize())}
          className="flex h-full w-11 items-center justify-center text-gray-500 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          title="Minimize"
          tabIndex={-1}
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor" style={{ pointerEvents: "none" }}>
            <rect width="10" height="1" />
          </svg>
        </button>

        <button
          onPointerDown={makeHandler(() => win.toggleMaximize())}
          className="flex h-full w-11 items-center justify-center text-gray-500 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          title="Maximize"
          tabIndex={-1}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" style={{ pointerEvents: "none" }}>
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>

        <button
          onPointerDown={makeHandler(() => win.close())}
          className="flex h-full w-11 items-center justify-center text-gray-500 hover:bg-red-600 hover:text-white transition-colors"
          title="Close"
          tabIndex={-1}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" style={{ pointerEvents: "none" }}>
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
