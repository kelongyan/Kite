import { useCallback, useEffect, useRef } from "react";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { ZOOM_MAX, ZOOM_MIN, setZoomLevel } from "@/modules/settings/store";

const ZOOM_STEP = 0.1;
const CSS_VAR = "--app-zoom";

function clampZoom(z: number): number {
  const rounded = Math.round(z * 100) / 100;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rounded));
}

function applyToDom(z: number): void {
  document.documentElement.style.setProperty(CSS_VAR, String(z));
}

export function useZoom() {
  const zoomLevel = usePreferencesStore((s) => s.zoomLevel);
  const hydrated = usePreferencesStore((s) => s.hydrated);
  const lastAppliedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (lastAppliedRef.current === zoomLevel) return;
    lastAppliedRef.current = zoomLevel;
    applyToDom(zoomLevel);
  }, [hydrated, zoomLevel]);

  const zoomIn = useCallback(() => {
    const current = usePreferencesStore.getState().zoomLevel;
    const next = clampZoom(current + ZOOM_STEP);
    if (next !== current) void setZoomLevel(next);
  }, []);

  const zoomOut = useCallback(() => {
    const current = usePreferencesStore.getState().zoomLevel;
    const next = clampZoom(current - ZOOM_STEP);
    if (next !== current) void setZoomLevel(next);
  }, []);

  const zoomReset = useCallback(() => {
    if (usePreferencesStore.getState().zoomLevel !== 1.0) {
      void setZoomLevel(1.0);
    }
  }, []);

  return { zoomIn, zoomOut, zoomReset };
}
