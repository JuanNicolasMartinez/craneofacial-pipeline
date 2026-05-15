import { useEffect, type MutableRefObject } from "react";
import type { CameraApi } from "./cameraApi";

/**
 * Blender-ish numpad shortcuts mapped to top-row digits so they work on
 * laptops without a numpad. Ignores keypresses while typing in inputs.
 */
export function useCameraShortcuts(
  apiRef: MutableRefObject<CameraApi>,
  onToggleGrid: () => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "1": apiRef.current.setView("front"); break;
        case "3": apiRef.current.setView("right"); break;
        case "7": apiRef.current.setView("top"); break;
        case "r":
        case "f": apiRef.current.reset(); break;
        case "g": onToggleGrid(); break;
        case "+":
        case "=": apiRef.current.zoom(-30); break;
        case "-":
        case "_": apiRef.current.zoom(30); break;
        default: return;
      }
      e.preventDefault();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [apiRef, onToggleGrid]);
}
