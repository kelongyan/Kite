import { usePreferencesStore } from "@/modules/settings/preferences";
import { toast } from "sonner";

export type TerminalNotificationKind = "bell" | "commandFinished";

export type TerminalNotificationContext = {
  /** document.hasFocus() at the moment the event arrived. */
  windowFocused: boolean;
  /** True when the leaf's tab is the active tab. */
  tabActive: boolean;
};

export type TerminalNotificationTexts = {
  appTitle: string;
  bellFallback: string;
  commandFinished: string;
};

/**
 * Notifications only fire when the user is not already looking at the pane:
 * focused window + active tab means the bell/finish is visible on screen.
 */
export function shouldDeliverTerminalNotification(
  ctx: TerminalNotificationContext,
): boolean {
  return !ctx.windowFocused || !ctx.tabActive;
}

/**
 * Deliver a terminal notification per the user's preferences. Focused window
 * → in-app toast (visible without stealing focus); unfocused → system toast
 * so it surfaces even when Kite is minimized.
 */
export function deliverTerminalNotification(
  kind: TerminalNotificationKind,
  ctx: TerminalNotificationContext,
  texts: TerminalNotificationTexts,
  message?: string,
): void {
  const prefs = usePreferencesStore.getState();
  if (kind === "bell" && !prefs.terminalBellNotify) return;
  if (kind === "commandFinished" && !prefs.terminalCommandNotify) return;
  if (!shouldDeliverTerminalNotification(ctx)) return;
  const body =
    kind === "commandFinished"
      ? texts.commandFinished
      : message?.trim() || texts.bellFallback;
  const title = texts.appTitle;
  if (ctx.windowFocused) {
    toast(title, { description: body });
    return;
  }
  void sendSystemNotification({ title, body });
}

async function sendSystemNotification(text: { title: string; body: string }) {
  try {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification");
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }
    if (!granted) {
      toast(text.title, { description: text.body });
      return;
    }
    sendNotification({ title: text.title, body: text.body });
  } catch (e) {
    console.warn("[kite] system notification failed:", e);
    toast(text.title, { description: text.body });
  }
}
