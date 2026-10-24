import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Quake-style global toggle. The hotkey is registered system-wide (Win+`),
 * so it must keep working while the window is hidden — the handler runs in
 * this webview, which stays alive when hidden.
 *
 * Window-level slide animation: a native window has no CSS surface, so the
 * y position interpolates over frames (the transform/opacity-only Motion rule
 * is about DOM content; moving the OS window is the closest equivalent).
 */
const SLIDE_MS = 180;
const TICK_MS = 16;
const HOTKEY = "Super+Backquote";

let enabled = false;
let registered = false;
let animating = false;
let blurHooked = false;

export async function applyQuakePreference(enable: boolean): Promise<void> {
  if (enable === enabled) return;
  enabled = enable;
  try {
    const { register, unregister, isRegistered } = await import(
      "@tauri-apps/plugin-global-shortcut"
    );
    if (enable) {
      if (registered || (await isRegistered(HOTKEY))) {
        registered = true;
        // The OS registration survives a webview reload, but the focus hook
        // does not: re-arm it so blur still retracts the window.
        hookBlurOnce();
        return;
      }
      await register(HOTKEY, toggleQuakeWindow);
      registered = true;
      hookBlurOnce();
    } else if (registered) {
      await unregister(HOTKEY);
      registered = false;
    }
  } catch (e) {
    // Re-registering after a webview reload can hit "already registered":
    // the shortcut still works, so downgrade to a warning.
    console.warn("[kite] quake hotkey setup failed:", e);
  }
}

function hookBlurOnce(): void {
  if (blurHooked) return;
  blurHooked = true;
  // Quake convention: clicking away retracts the console. Only while the
  // preference is on, and never mid-slide.
  getCurrentWindow().onFocusChanged((focused) => {
    if (!focused && enabled && !animating) void retractQuakeWindow();
  });
}

type QuakeGeometry = {
  win: ReturnType<typeof getCurrentWindow>;
  x: number;
  topY: number;
  height: number;
};

async function quakeGeometry(): Promise<QuakeGeometry | null> {
  const win = getCurrentWindow();
  const [size, pos, monitor] = await Promise.all([
    win.outerSize().catch(() => null),
    win.outerPosition().catch(() => null),
    currentMonitor().catch(() => null),
  ]);
  if (!size || !pos || !monitor) return null;
  return { win, x: pos.x, topY: monitor.position.y, height: size.height };
}

async function toggleQuakeWindow(): Promise<void> {
  if (animating) return;
  const win = getCurrentWindow();
  const visible = await win.isVisible().catch(() => true);
  if (visible) {
    await retractQuakeWindow();
  } else {
    await revealQuakeWindow();
  }
}

async function revealQuakeWindow(): Promise<void> {
  const geo = await quakeGeometry();
  if (!geo) return;
  const { win, x, topY, height } = geo;
  animating = true;
  try {
    // Start fully off-screen, then slide down into place.
    await win.setPosition(new PhysicalPosition(x, topY - height));
    await win.show();
    await slide(x, topY - height, topY);
    await win.setFocus();
  } finally {
    animating = false;
  }
}

async function retractQuakeWindow(): Promise<void> {
  const geo = await quakeGeometry();
  if (!geo) return;
  const { win, x, topY, height } = geo;
  animating = true;
  try {
    await slide(x, topY, topY - height);
    await win.hide();
    // Park off-screen so the next reveal starts from the top.
    await win.setPosition(new PhysicalPosition(x, topY - height));
  } finally {
    animating = false;
  }
}

async function slide(
  x: number,
  fromY: number,
  toY: number,
): Promise<void> {
  const win = getCurrentWindow();
  const steps = Math.max(1, Math.round(SLIDE_MS / TICK_MS));
  for (let i = 1; i <= steps; i++) {
    // easeOutCubic keeps the pull-down snappy with a soft landing.
    const t = i / steps;
    const eased = 1 - (1 - t) ** 3;
    await win.setPosition(
      new PhysicalPosition(x, Math.round(fromY + (toY - fromY) * eased)),
    );
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}
