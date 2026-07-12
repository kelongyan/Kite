import { IS_WINDOWS } from "@/lib/platform";
import type { IMarker, Terminal } from "@xterm/xterm";

const MAX_OSC52_CLIPBOARD_BYTES = 1024 * 1024;

/**
 * Cross-handler state shared between the OSC 7 cwd handler and the OSC 133
 * prompt-marker handler. Tracks whether we are currently inside a running
 * command (between OSC 133 B and the next OSC 133 D / A), so the cwd handler
 * can ignore OSC 7 updates emitted by *command output* (e.g. a remote SSH
 * server, a `cat` of an attacker-controlled file). Only OSC 7 issued by the
 * local shell — which fires between commands — should be honored.
 */
export type ShellIntegrationState = {
  inCommand: boolean;
};

export function createShellIntegrationState(): ShellIntegrationState {
  return { inCommand: false };
}

export function registerCwdHandler(
  term: Terminal,
  onCwd: (cwd: string) => void,
  state?: ShellIntegrationState,
): () => void {
  const d = term.parser.registerOscHandler(7, (data) => {
    // Reject OSC 7 emitted while a command is running: command stdout/stderr
    // is untrusted (it can come from a remote shell, an SSH session, a `cat`
    // of attacker-controlled bytes). The local shell only emits OSC 7
    // between commands via its precmd/PROMPT_COMMAND hook.
    if (state?.inCommand) return true;
    const cwd = parseOsc7(data);
    if (cwd) onCwd(cwd);
    return true;
  });
  return () => d.dispose();
}

export type PromptTracker = {
  getMarker: () => IMarker | null;
  dispose: () => void;
};

export function registerPromptTracker(
  term: Terminal,
  state?: ShellIntegrationState,
  // Fires on C (process executing) and A/D (back at prompt). Distinct from
  // inCommand, which is already true from B while the user merely types.
  onCommandState?: (running: boolean) => void,
): PromptTracker {
  let marker: IMarker | null = null;
  const d = term.parser.registerOscHandler(133, (data) => {
    // OSC 133 A — start of new prompt (between commands).
    if (data.startsWith("A")) {
      if (state) state.inCommand = false;
      onCommandState?.(false);
      marker?.dispose();
      marker = term.registerMarker(0);
    } else if (data.startsWith("B")) {
      // OSC 133 B — command begins. From here on, treat all output as
      // untrusted until we see D (command exit) or the next A (new prompt).
      if (state) state.inCommand = true;
    } else if (data.startsWith("C")) {
      // OSC 133 C — command pre-execution marker; still inside command.
      if (state) state.inCommand = true;
      onCommandState?.(true);
    } else if (data.startsWith("D")) {
      // OSC 133 D — command ends.
      if (state) state.inCommand = false;
      onCommandState?.(false);
    }
    return true;
  });
  return {
    getMarker: () => (marker && !marker.isDisposed ? marker : null),
    dispose: () => {
      d.dispose();
      marker?.dispose();
      marker = null;
    },
  };
}

export type ClipboardWriter = (text: string) => void | Promise<void>;
export type ThemeColorReader = () => {
  foreground: string;
  background: string;
};

export function registerThemeQueryHandler(
  term: Terminal,
  writeToPty: (data: string) => void,
  readColors: ThemeColorReader,
): () => void {
  const foreground = term.parser.registerOscHandler(10, (data) => {
    if (data.trim() === "?") {
      writeToPty(formatOscColorReply(10, readColors().foreground));
      return true;
    }
    return false;
  });
  const background = term.parser.registerOscHandler(11, (data) => {
    if (data.trim() === "?") {
      writeToPty(formatOscColorReply(11, readColors().background));
      return true;
    }
    return false;
  });
  return () => {
    foreground.dispose();
    background.dispose();
  };
}

export function registerOsc52ClipboardHandler(
  term: Terminal,
  writeClipboard: ClipboardWriter = writeSystemClipboard,
): () => void {
  const d = term.parser.registerOscHandler(52, (data) => {
    const text = parseOsc52Clipboard(data);
    if (text === null) return true;
    queueMicrotask(() => {
      try {
        void Promise.resolve(writeClipboard(text)).catch(() => {});
      } catch {}
    });
    return true;
  });
  return () => d.dispose();
}

function parseOsc7(data: string): string | null {
  const m = data.match(/^file:\/\/[^/]*(\/.*)$/);
  if (!m) return null;
  let path = m[1];
  try {
    path = decodeURIComponent(path);
  } catch {}
  // /C:/Users/foo -> C:/Users/foo so it's a valid Windows path.
  if (/^\/[A-Za-z]:/.test(path)) {
    path = path.slice(1);
  } else if (IS_WINDOWS) {
    // git-bash (MSYS) reports cwd as /c/Users/foo; map it to C:/Users/foo.
    const drive = path.match(/^\/([A-Za-z])(\/.*)?$/);
    if (drive) path = `${drive[1].toUpperCase()}:${drive[2] ?? "/"}`;
  }
  return path;
}

function parseOsc52Clipboard(data: string): string | null {
  const parts = data.split(";");
  if (parts.length < 2) return null;
  const selection = parts[0] || "c";
  if (!selection.includes("c")) return null;
  const encoded = parts.slice(1).join(";");
  if (!encoded || encoded === "?") return null;
  if (encoded.length > Math.ceil((MAX_OSC52_CLIPBOARD_BYTES * 4) / 3) + 4) {
    return null;
  }
  const compact = encoded.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return null;

  try {
    const bytes = Uint8Array.from(atob(compact), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_OSC52_CLIPBOARD_BYTES) return null;
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function formatOscColorReply(code: 10 | 11 | 12, color: string): string {
  const rgb = parseCssRgb(color);
  return `\x1b]${code};rgb:${toHex16(rgb.r)}/${toHex16(rgb.g)}/${toHex16(rgb.b)}\x1b\\`;
}

function parseCssRgb(color: string): { r: number; g: number; b: number } {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) return parseHexColor(hex[1]);

  if (color.trim().startsWith("oklch(")) {
    return parseOklchColor(color);
  }

  const nums = color.match(/[\d.]+%?/g)?.map(parseCssNumber) ?? [];
  return {
    r: clampByte(nums[0] ?? 0),
    g: clampByte(nums[1] ?? 0),
    b: clampByte(nums[2] ?? 0),
  };
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  if (hex.length === 3) {
    return {
      r: Number.parseInt(`${hex[0]}${hex[0]}`, 16),
      g: Number.parseInt(`${hex[1]}${hex[1]}`, 16),
      b: Number.parseInt(`${hex[2]}${hex[2]}`, 16),
    };
  }
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function parseOklchColor(color: string): { r: number; g: number; b: number } {
  const body = color.trim().match(/^oklch\((.*)\)$/i)?.[1] ?? "";
  const [lRaw = "0", cRaw = "0", hRaw = "0"] = body
    .replace(/\s*\/.*$/, "")
    .split(/\s+/);
  const l = lRaw.endsWith("%")
    ? Number.parseFloat(lRaw) / 100
    : Number.parseFloat(lRaw);
  const c = Number.parseFloat(cRaw);
  const h = (Number.parseFloat(hRaw) * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  return {
    r: clampByte(
      toSrgb(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    ),
    g: clampByte(
      toSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    ),
    b: clampByte(
      toSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
    ),
  };
}

function parseCssNumber(value: string): number {
  return value.endsWith("%")
    ? (Number.parseFloat(value) / 100) * 255
    : Number.parseFloat(value);
}

function toSrgb(linear: number): number {
  const value =
    linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return value * 255;
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex16(value: number): string {
  const hex = value.toString(16).padStart(2, "0");
  return `${hex}${hex}`;
}

async function writeSystemClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
