import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../lib/tauri-compat";

export function TitleBar() {
  if (!isTauri()) return null;

  const win = getCurrentWindow();

  return (
    <div
      className="flex h-8 w-full shrink-0 items-center bg-gray-900 border-b border-gray-800 select-none"
      data-tauri-drag-region
    >
      {/* App identity — non-interactive drag region */}
      <div className="flex items-center gap-2 px-3" data-tauri-drag-region>
        <img src="/disintea-darkicon.svg" alt="" className="h-3.5 w-3.5 opacity-70" data-tauri-drag-region />
        <span className="text-xs font-semibold tracking-wide text-gray-500" data-tauri-drag-region>
          Disintea
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" data-tauri-drag-region />

      {/* Window chrome buttons */}
      <div className="flex h-full">
        {/* Minimize */}
        <button
          onClick={() => win.minimize()}
          className="flex h-full w-11 items-center justify-center text-gray-500 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={() => win.toggleMaximize()}
          className="flex h-full w-11 items-center justify-center text-gray-500 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          title="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>

        {/* Close */}
        <button
          onClick={() => win.close()}
          className="flex h-full w-11 items-center justify-center text-gray-500 hover:bg-red-600 hover:text-white transition-colors"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
