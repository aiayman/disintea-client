import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../lib/tauri-compat";

export function TitleBar() {
  // Ensure the webview has focus the moment the window opens.
  // Without this, the first click on a borderless window may be swallowed
  // to give focus, making buttons appear unresponsive on first launch.
  useEffect(() => {
    if (!isTauri()) return;
    getCurrentWindow().setFocus().catch(() => {});
  }, []);

  if (!isTauri()) return null;

  const win = getCurrentWindow();

  // Explicit drag via startDragging() — more reliable than data-tauri-drag-region
  // because that attribute makes Tauri walk the DOM tree and can intercept clicks
  // on SVG children of buttons (SVG elements aren't in Tauri's interactive-element
  // exclusion list, so they trigger a drag instead of the button click).
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Don't start drag when the click targets a button or any of its children
    if ((e.target as HTMLElement).closest("button")) return;
    void win.startDragging();
  };

  // Double-click the bar to maximize / restore
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    void win.toggleMaximize();
  };

  return (
    <div
      className="flex h-8 w-full shrink-0 items-center bg-gray-900 border-b border-gray-800 select-none"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* App identity — drag area */}
      <div className="flex flex-1 items-center gap-2 px-3">
        <img src="/disintea-darkicon.svg" alt="" className="h-3.5 w-3.5 opacity-70 pointer-events-none" />
        <span className="text-xs font-semibold tracking-wide text-gray-500 pointer-events-none">
          Disintea
        </span>
      </div>

      {/* Window chrome buttons */}
      <div className="flex h-full">
        {/* Minimize */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => win.minimize()}
          className="flex h-full w-11 items-center justify-center text-gray-500 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor" style={{ pointerEvents: "none" }}>
            <rect width="10" height="1" />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => win.toggleMaximize()}
          className="flex h-full w-11 items-center justify-center text-gray-500 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          title="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" style={{ pointerEvents: "none" }}>
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>

        {/* Close */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => win.close()}
          className="flex h-full w-11 items-center justify-center text-gray-500 hover:bg-red-600 hover:text-white transition-colors"
          title="Close"
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
