import { resolveFontFamily } from "@/lib/fonts";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { buildTerminalTheme } from "@/styles/terminalTheme";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { SerializeAddon } from "@xterm/addon-serialize";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { type FontWeight, type ITheme, Terminal } from "@xterm/xterm";
import { shouldCursorBlink } from "./cursorBlink";
import {
  computeTerminalCursorOverlayBox,
  getTerminalCursorRenderStrategy,
  resolveTerminalNativeCursorShape,
  resolveTerminalNativeCursorWidth,
  shouldInterceptTerminalCursorColor,
  shouldInterceptTerminalCursorStyle,
  shouldShowTerminalCursorOverlay,
  shouldSuppressNativeCursor,
  terminalCursorMaskColor,
  type TerminalCursorAnimation,
  type TerminalCursorShape,
  type TerminalCursorWidth,
} from "./cursorStyle";
import { findVisibleCursorCell, syncTerminalImeAnchor } from "./imeAnchor";
import {
  terminalDeleteSequence,
  terminalLineNavigationSequence,
  terminalWordNavigationSequence,
} from "./keymap";
import { formatOscColorReply } from "./osc-handlers";
import {
  isNoopSynchronizedOutputFrame,
  shouldDropNoopSynchronizedOutput,
} from "./synchronizedOutput";
import {
  readTerminalClipboard,
  writeTerminalClipboard,
} from "./terminalClipboard";

export const POOL_MAX_SIZE = 5;
const FIT_DEBOUNCE_MS = 8;
const PTY_RESIZE_DEBOUNCE_MS = 256;
const SNAPSHOT_SCROLLBACK_CAP = 5_000;

export type SlotAdapter = {
  resolveLeaf(leafId: number): LeafBridge | null;
  evictLeaf(leafId: number): void;
  isLeafFocused(leafId: number): boolean;
  isLeafBlocks(leafId: number): boolean;
  isLeafBusy(leafId: number): boolean;
  isLeafVisible(leafId: number): boolean;
  storeSnapshot(leafId: number, out: SerializeOutput): void;
};

export type LeafBridge = {
  writeToPty(data: string): void;
  resizePty(cols: number, rows: number): void;
  // Force a SIGWINCH on the underlying PTY at the given dims. Implemented
  // as a +1 row / restore bump because the Linux kernel suppresses winsize
  // ioctls that don't actually change the size. Used to make alt-screen
  // TUIs repaint from scratch after they were dormant.
  kickPty(cols: number, rows: number): void;
};

export type Slot = {
  readonly id: number;
  readonly term: Terminal;
  readonly fitAddon: FitAddon;
  readonly searchAddon: SearchAddon;
  readonly serializeAddon: SerializeAddon;
  readonly host: HTMLDivElement;
  webglAddon: WebglAddon | null;
  webglCanvases: HTMLCanvasElement[];
  currentLeafId: number | null;
  pendingTerminalWrites: number;
  // A write callback can leave the VT parser mid-sequence. A parsed no-op
  // frame establishes a safe boundary before later identical frames are dropped.
  noopSynchronizedOutputPrimed: boolean;
  // Leaf whose buffer this slot still holds intact after release; serialized
  // only if another leaf steals the slot.
  retainedLeafId: number | null;
  parked: boolean;
  oscDisposers: (() => void)[];
  observer: ResizeObserver | null;
  fitTimer: ReturnType<typeof setTimeout> | null;
  ptyTimer: ReturnType<typeof setTimeout> | null;
  webglReapTimer: ReturnType<typeof setTimeout> | null;
  slotReapTimer: ReturnType<typeof setTimeout> | null;
  unhideRaf: number | null;
  imeRaf: number | null;
  imeTimer: ReturnType<typeof setTimeout> | null;
  imeDisposers: (() => void)[];
  cursorOverlay: HTMLDivElement | null;
  cursorOverlayMask: HTMLDivElement | null;
  cursorOverlayRaf: number | null;
  cursorDisposers: (() => void)[];
  cursorNativeSuppressed: boolean;
  lastCols: number;
  lastRows: number;
  lastW: number;
  lastH: number;
  lastUsedAt: number;
};

const slots: Slot[] = [];
let recyclerEl: HTMLDivElement | null = null;
let adapter: SlotAdapter | null = null;

let windowActive =
  typeof document === "undefined" || (!document.hidden && document.hasFocus());
let windowActivityBound = false;
const initialPreferences = usePreferencesStore.getState();
let cursorShape: TerminalCursorShape = initialPreferences.terminalCursorShape;
let cursorAnimation: TerminalCursorAnimation =
  initialPreferences.terminalCursorAnimation;
let cursorWidth: TerminalCursorWidth = initialPreferences.terminalCursorWidth;

function bindWindowActivityListeners(): void {
  if (windowActivityBound || typeof window === "undefined") return;
  windowActivityBound = true;
  const sync = () => setWindowActive(!document.hidden && document.hasFocus());
  window.addEventListener("focus", sync);
  window.addEventListener("blur", sync);
  document.addEventListener("visibilitychange", sync);
}

function setWindowActive(active: boolean): void {
  if (windowActive === active) return;
  windowActive = active;
  for (const slot of slots) {
    if (slot.currentLeafId === null) continue;
    applyCursorRenderingOnSlot(
      slot,
      adapter?.isLeafFocused(slot.currentLeafId) ?? false,
    );
  }
}

export function configureRendererPool(a: SlotAdapter): void {
  adapter = a;
  bindWindowActivityListeners();
}

export function forEachSlot(fn: (slot: Slot) => void): void {
  for (const s of slots) fn(s);
}

export function poolSize(): number {
  return slots.length;
}

export type PoolSlotStat = {
  id: number;
  leafId: number | null;
  retainedLeafId: number | null;
  parked: boolean;
  cols: number;
  rows: number;
  bufferLines: number;
  webgl: boolean;
  canvases: number;
};

export function poolSlotStats(): PoolSlotStat[] {
  return slots.map((s) => ({
    id: s.id,
    leafId: s.currentLeafId,
    retainedLeafId: s.retainedLeafId,
    parked: s.parked,
    cols: s.term.cols,
    rows: s.term.rows,
    bufferLines: s.term.buffer.active.length,
    webgl: !!s.webglAddon,
    canvases: s.webglCanvases.length,
  }));
}

// Bracketed paste via xterm, so an app that enabled it (Claude Code) treats a
// dropped path as a real paste while a plain shell gets the literal text.
export function pasteIntoLeaf(leafId: number, text: string): boolean {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  if (!slot) return false;
  slot.term.paste(text);
  return true;
}

export function writeToSlot(slot: Slot, data: string | Uint8Array): void {
  const alternateScreen = isAltScreen(slot);
  const synchronizedOutputActive = slot.term.modes.synchronizedOutputMode;
  const noopSynchronizedOutput =
    alternateScreen &&
    !synchronizedOutputActive &&
    isNoopSynchronizedOutputFrame(data);
  if (
    shouldDropNoopSynchronizedOutput(data, {
      alternateScreen,
      synchronizedOutputActive,
      pendingTerminalWrites: slot.pendingTerminalWrites,
      noopSynchronizedOutputPrimed: slot.noopSynchronizedOutputPrimed,
    })
  ) {
    return;
  }
  slot.noopSynchronizedOutputPrimed = false;
  let settled = false;
  const settleWrite = (parsed: boolean) => {
    if (settled) return;
    settled = true;
    slot.pendingTerminalWrites -= 1;
    if (
      parsed &&
      noopSynchronizedOutput &&
      slot.pendingTerminalWrites === 0 &&
      isAltScreen(slot) &&
      !slot.term.modes.synchronizedOutputMode
    ) {
      slot.noopSynchronizedOutputPrimed = true;
    }
  };
  slot.pendingTerminalWrites += 1;
  try {
    slot.term.write(data, () => settleWrite(true));
  } catch (error) {
    settleWrite(false);
    throw error;
  }
}

function getRecycler(): HTMLDivElement {
  if (recyclerEl?.isConnected) return recyclerEl;
  const el = document.createElement("div");
  el.setAttribute("data-terax-recycler", "");
  el.style.cssText =
    "position:fixed;left:-99999px;top:-99999px;width:1024px;height:768px;overflow:hidden;pointer-events:none;contain:strict;";
  document.body.appendChild(el);
  recyclerEl = el;
  return el;
}

const MCR_BG_ACTIVE = 4.5;
const MCR_BG_INACTIVE = 1;

function bgActive(
  prefs: ReturnType<typeof usePreferencesStore.getState>,
): boolean {
  return prefs.backgroundKind === "image" && !!prefs.backgroundImageId;
}

function termOptions() {
  const prefs = usePreferencesStore.getState();
  return {
    fontFamily: resolveFontFamily(prefs.terminalFontFamily),
    fontWeight: prefs.terminalFontWeight as FontWeight,
    letterSpacing: prefs.terminalLetterSpacing,
    fontSize: Math.max(4, Math.round(prefs.terminalFontSize * prefs.zoomLevel)),
    theme: terminalThemeForCursorAnimation(prefs.terminalCursorAnimation),
    cursorBlink: false,
    cursorStyle: resolveTerminalNativeCursorShape(
      prefs.terminalCursorAnimation,
      prefs.terminalCursorShape,
    ),
    cursorWidth: resolveTerminalNativeCursorWidth(
      prefs.terminalCursorAnimation,
      prefs.terminalCursorWidth,
    ),
    cursorInactiveStyle:
      getTerminalCursorRenderStrategy(prefs.terminalCursorAnimation) ===
      "overlay"
        ? ("none" as const)
        : ("outline" as const),
    scrollback: prefs.terminalScrollback,
    allowProposedApi: true,
    minimumContrastRatio: bgActive(prefs) ? MCR_BG_ACTIVE : MCR_BG_INACTIVE,
  };
}

function terminalThemeForCursorAnimation(
  animation: TerminalCursorAnimation,
): ITheme {
  const theme = buildTerminalTheme();
  if (!shouldSuppressNativeCursor(animation)) return theme;
  const suppressedCursorColor = theme.background ?? "rgb(0, 0, 0)";
  return {
    ...theme,
    cursor: suppressedCursorColor,
    cursorAccent: suppressedCursorColor,
  };
}

export function applyBackgroundActive(active: boolean): void {
  const value = active ? MCR_BG_ACTIVE : MCR_BG_INACTIVE;
  for (const slot of slots) {
    if (slot.term.options.minimumContrastRatio === value) continue;
    slot.term.options.minimumContrastRatio = value;
  }
}

function createSlot(): Slot {
  const term = new Terminal(termOptions());
  const fitAddon = new FitAddon();
  const searchAddon = new SearchAddon();
  const serializeAddon = new SerializeAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(searchAddon);
  term.loadAddon(serializeAddon);
  term.loadAddon(
    new WebLinksAddon((_e, uri) => openUrl(uri).catch(console.error)),
  );

  const host = document.createElement("div");
  host.style.cssText = "position:relative;width:100%;height:100%;";
  host.setAttribute("data-terax-slot", String(slots.length));
  getRecycler().appendChild(host);
  term.open(host);

  const slot: Slot = {
    id: slots.length,
    term,
    fitAddon,
    searchAddon,
    serializeAddon,
    host,
    webglAddon: null,
    webglCanvases: [],
    currentLeafId: null,
    pendingTerminalWrites: 0,
    noopSynchronizedOutputPrimed: false,
    retainedLeafId: null,
    parked: false,
    oscDisposers: [],
    observer: null,
    fitTimer: null,
    ptyTimer: null,
    webglReapTimer: null,
    slotReapTimer: null,
    unhideRaf: null,
    imeRaf: null,
    imeTimer: null,
    imeDisposers: [],
    cursorOverlay: null,
    cursorOverlayMask: null,
    cursorOverlayRaf: null,
    cursorDisposers: [],
    cursorNativeSuppressed: false,
    lastCols: term.cols,
    lastRows: term.rows,
    lastW: 0,
    lastH: 0,
    lastUsedAt: 0,
  };

  term.attachCustomKeyEventHandler((event) => {
    // During IME composition the browser is assembling a multi-keystroke
    // character (Chinese pinyin → hanzi, Korean jamo → syllable, etc.).
    // Raw keydown events — including the Enter that commits a candidate —
    // must NOT be forwarded to the PTY; xterm will receive the final
    // composed string through its own compositionend handler instead.
    // keyCode 229 ("Process") is what Chromium reports for every key
    // pressed inside an active IME session when isComposing is not yet set.
    if (event.isComposing || event.keyCode === 229) return false;

    const leafId = slot.currentLeafId;
    if (leafId === null) return false;
    const bridge = adapter?.resolveLeaf(leafId);
    if (!bridge) return true;
    const lineNavigation = terminalLineNavigationSequence(event, {
      isMac: IS_MAC,
    });
    if (lineNavigation) {
      event.preventDefault();
      if (event.type === "keydown") bridge.writeToPty(lineNavigation);
      return false;
    }
    const wordNavigation = terminalWordNavigationSequence(event);
    if (wordNavigation) {
      event.preventDefault();
      if (event.type === "keydown") bridge.writeToPty(wordNavigation);
      return false;
    }
    const deleteSeq = terminalDeleteSequence(event, { isMac: IS_MAC });
    if (deleteSeq) {
      event.preventDefault();
      if (event.type === "keydown") bridge.writeToPty(deleteSeq);
      return false;
    }
    if (isShiftEnter(event)) {
      event.preventDefault();
      if (event.type === "keydown") bridge.writeToPty("\x1b\r");
      return false;
    }
    if (isTerminalCopy(event)) {
      if (event.type === "keydown" && slot.term.hasSelection()) {
        const sel = slot.term.getSelection();
        if (sel) void writeTerminalClipboard(sel);
      }
      event.preventDefault();
      return false;
    }
    if (isTerminalPaste(event)) {
      if (event.type === "keydown") {
        const targetLeafId = slot.currentLeafId;
        void readTerminalClipboard().then((text) => {
          if (text && slot.currentLeafId === targetLeafId)
            slot.term.paste(text);
        });
      }
      event.preventDefault();
      return false;
    }
    return true;
  });

  term.onData((data) => {
    const leafId = slot.currentLeafId;
    if (leafId === null) return;
    adapter?.resolveLeaf(leafId)?.writeToPty(data);
  });

  bindSlotImeAnchorSync(slot);
  bindSlotCursorControlInterceptors(slot);
  bindSlotCursorOverlaySync(slot);
  slots.push(slot);
  return slot;
}

type PickResult = { slot: Slot; previousLeafId: number | null };

function isAltScreen(s: Slot): boolean {
  try {
    return s.term.buffer.active.type === "alternate";
  } catch {
    return false;
  }
}

function evictionScore(s: Slot): number {
  const leafId = s.currentLeafId;
  const visible = leafId !== null && (adapter?.isLeafVisible(leafId) ?? false);
  const busy = leafId !== null && (adapter?.isLeafBusy(leafId) ?? false);
  const blocks = leafId !== null && (adapter?.isLeafBlocks(leafId) ?? false);
  const focused = leafId !== null && (adapter?.isLeafFocused(leafId) ?? false);
  return (
    (visible ? 1000 : 0) +
    (isAltScreen(s) ? 100 : 0) +
    (busy ? 80 : 0) +
    (blocks ? 50 : 0) +
    (focused ? 10 : 0) +
    s.lastUsedAt / 1e12
  );
}

function pickSlotFor(leafId: number): PickResult {
  const retainedOwn = slots.find(
    (s) => s.currentLeafId === null && s.retainedLeafId === leafId,
  );
  if (retainedOwn) return { slot: retainedOwn, previousLeafId: null };

  const clean = slots.find(
    (s) => s.currentLeafId === null && s.retainedLeafId === null,
  );
  if (clean) return { slot: clean, previousLeafId: null };
  if (slots.length < POOL_MAX_SIZE)
    return { slot: createSlot(), previousLeafId: null };

  // Retained buffers are cheaper to lose than bound ones: serialize, no evict.
  let retained: Slot | null = null;
  for (const s of slots) {
    if (s.currentLeafId !== null) continue;
    if (!retained || s.lastUsedAt < retained.lastUsedAt) retained = s;
  }
  if (retained) return { slot: retained, previousLeafId: null };

  let best: Slot | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const s of slots) {
    if (s.currentLeafId === leafId) return { slot: s, previousLeafId: null };
    const score = evictionScore(s);
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (!best) throw new Error("No renderer slot available");
  const chosen = best;
  return { slot: chosen, previousLeafId: chosen.currentLeafId };
}

export type AcquireParams = {
  leafId: number;
  container: HTMLDivElement;
  snapshot: string | null;
  // True if the slot was in alt-screen mode (TUI like vim, htop, dofek)
  // at the time it was released. When set, bindSlot skips ring replay
  // and kicks SIGWINCH so the TUI repaints from scratch.
  altScreen: boolean;
  drainRing: (write: (bytes: Uint8Array) => void) => void;
  shellExited: boolean;
  searchQuery: string | null;
  cols: number;
  rows: number;
  registerOsc: (term: Terminal) => (() => void)[];
  onSearchReady: (addon: SearchAddon) => void;
};

export function acquireSlot(params: AcquireParams): Slot {
  const existing = slots.find((s) => s.currentLeafId === params.leafId);
  if (existing) {
    rewireSlot(existing, params);
    return existing;
  }

  const pick = pickSlotFor(params.leafId);
  if (pick.previousLeafId !== null) {
    adapter?.evictLeaf(pick.previousLeafId);
  }
  if (
    pick.slot.currentLeafId !== null &&
    pick.slot.currentLeafId !== params.leafId
  ) {
    detachSlotFromLeaf(pick.slot, false);
  }
  if (
    pick.slot.retainedLeafId !== null &&
    pick.slot.retainedLeafId !== params.leafId
  ) {
    adapter?.storeSnapshot(pick.slot.retainedLeafId, serializeSlot(pick.slot));
    discardRetention(pick.slot);
  }
  bindSlot(pick.slot, params);
  return pick.slot;
}

function discardRetention(slot: Slot): void {
  slot.retainedLeafId = null;
  for (const d of slot.oscDisposers) {
    try {
      d();
    } catch {}
  }
  slot.oscDisposers = [];
}

function bindSlot(slot: Slot, p: AcquireParams): void {
  const fast = slot.retainedLeafId === p.leafId;
  const stale =
    !slot.webglAddon ||
    slot.parked ||
    performance.now() - slot.lastUsedAt > SLOT_STALE_MS;
  const hadWebgl = !!slot.webglAddon;
  slot.retainedLeafId = null;
  slot.currentLeafId = p.leafId;
  slot.lastUsedAt = performance.now();

  cancelPendingUnhide(slot);
  cancelWebglReap(slot);
  cancelSlotReap(slot);
  unparkSlotHost(slot);
  if (!fast) {
    slot.host.style.visibility = "hidden";
    if (hadWebgl) disposeSlotWebgl(slot);
  }

  if (slot.host.parentNode !== p.container) {
    p.container.appendChild(slot.host);
  }

  slot.term.options.disableStdin = p.shellExited;

  if (!fast) {
    slot.term.clear();
    slot.term.reset();
    slot.noopSynchronizedOutputPrimed = false;
    resetSlotCursorVisibility(slot);

    if (
      p.cols > 0 &&
      p.rows > 0 &&
      (slot.term.cols !== p.cols || slot.term.rows !== p.rows)
    ) {
      slot.term.resize(p.cols, p.rows);
    }

    if (p.snapshot) {
      try {
        writeToSlot(slot, p.snapshot);
      } catch (e) {
        console.warn("[kite] snapshot replay failed:", e);
      }
    }
    if (p.altScreen) {
      // TUI output is incremental cursor-positioned updates that can't be
      // replayed on top of a stale snapshot; the SIGWINCH kick below makes
      // the TUI redraw from scratch instead.
      p.drainRing(() => {});
    } else {
      p.drainRing((bytes) => writeToSlot(slot, bytes));
    }
    try {
      writeToSlot(slot, "\x1b[?25h");
    } catch {}

    for (const d of slot.oscDisposers) {
      try {
        d();
      } catch {}
    }
    slot.oscDisposers = p.registerOsc(slot.term);
  } else {
    p.drainRing((bytes) => writeToSlot(slot, bytes));
  }

  setupResizeObserver(slot, p);
  slot.fitAddon.fit();
  syncSlotImeAnchor(slot);
  slot.lastCols = slot.term.cols;
  slot.lastRows = slot.term.rows;
  slot.lastW = p.container.clientWidth;
  slot.lastH = p.container.clientHeight;
  if (slot.lastCols !== p.cols || slot.lastRows !== p.rows) {
    // resizePty updates session.cols/rows + pty backend; no separate scope call.
    adapter?.resolveLeaf(p.leafId)?.resizePty(slot.lastCols, slot.lastRows);
  }

  if (!fast && p.searchQuery) {
    try {
      slot.searchAddon.findNext(p.searchQuery);
    } catch {}
  }

  applyCursorRenderingOnSlot(slot, adapter?.isLeafFocused(p.leafId) ?? false);

  if (!fast && p.altScreen && !p.shellExited) {
    adapter?.resolveLeaf(p.leafId)?.kickPty(slot.term.cols, slot.term.rows);
  }

  if (fast) {
    if (stale) {
      if (!slot.webglAddon) attachWebgl(slot);
      try {
        slot.term.refresh(0, slot.term.rows - 1);
      } catch {}
      scheduleSlotImeAnchorSync(slot);
      scheduleSlotCursorOverlaySync(slot);
    }
    if (adapter?.isLeafFocused(p.leafId)) slot.term.focus();
  } else {
    scheduleUnhide(slot, stale || hadWebgl);
  }

  p.onSearchReady(slot.searchAddon);
}

function scheduleUnhide(slot: Slot, stale: boolean): void {
  slot.unhideRaf = requestAnimationFrame(() => {
    slot.unhideRaf = requestAnimationFrame(() => {
      slot.unhideRaf = null;
      slot.host.style.visibility = "";
      if (stale) {
        if (!slot.webglAddon) attachWebgl(slot);
        try {
          slot.term.refresh(0, slot.term.rows - 1);
        } catch {}
      }
      scheduleSlotImeAnchorSync(slot);
      scheduleSlotCursorOverlaySync(slot);
      const leafId = slot.currentLeafId;
      if (leafId !== null && adapter?.isLeafFocused(leafId)) {
        slot.term.focus();
      }
    });
  });
}

function cancelPendingUnhide(slot: Slot): void {
  if (slot.unhideRaf !== null) {
    cancelAnimationFrame(slot.unhideRaf);
    slot.unhideRaf = null;
  }
}

function bindSlotImeAnchorSync(slot: Slot): void {
  const textarea = slot.term.textarea;
  if (!textarea) return;

  const syncNow = () => syncSlotImeAnchor(slot);
  const syncAfterXterm = () => {
    syncSlotImeAnchor(slot);
    scheduleSlotImeAnchorPostTick(slot);
    scheduleSlotImeAnchorSync(slot);
  };
  const syncOnImeKey = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229) syncAfterXterm();
  };
  const syncSoon = () => scheduleSlotImeAnchorSync(slot);
  textarea.addEventListener("compositionstart", syncNow, true);
  textarea.addEventListener("compositionstart", syncAfterXterm);
  textarea.addEventListener("compositionupdate", syncNow, true);
  textarea.addEventListener("compositionupdate", syncAfterXterm);
  textarea.addEventListener("focus", syncNow);
  textarea.addEventListener("keydown", syncOnImeKey, true);
  const cursorMoveDisposable = slot.term.onCursorMove(syncSoon);
  const writeParsedDisposable = slot.term.onWriteParsed(syncSoon);

  slot.imeDisposers.push(
    () => textarea.removeEventListener("compositionstart", syncNow, true),
    () => textarea.removeEventListener("compositionstart", syncAfterXterm),
    () => textarea.removeEventListener("compositionupdate", syncNow, true),
    () => textarea.removeEventListener("compositionupdate", syncAfterXterm),
    () => textarea.removeEventListener("focus", syncNow),
    () => textarea.removeEventListener("keydown", syncOnImeKey, true),
    () => cursorMoveDisposable.dispose(),
    () => writeParsedDisposable.dispose(),
  );
}

function syncSlotImeAnchor(slot: Slot): void {
  if (slot.currentLeafId === null || slot.parked) return;
  syncTerminalImeAnchor(slot.term);
}

function scheduleSlotImeAnchorSync(slot: Slot): void {
  if (slot.imeRaf !== null || slot.currentLeafId === null || slot.parked)
    return;
  if (typeof requestAnimationFrame !== "function") {
    syncSlotImeAnchor(slot);
    return;
  }
  slot.imeRaf = requestAnimationFrame(() => {
    slot.imeRaf = null;
    syncSlotImeAnchor(slot);
  });
}

function scheduleSlotImeAnchorPostTick(slot: Slot): void {
  if (slot.currentLeafId === null || slot.parked) return;
  if (slot.imeTimer !== null) clearTimeout(slot.imeTimer);
  slot.imeTimer = setTimeout(() => {
    slot.imeTimer = null;
    syncSlotImeAnchor(slot);
    scheduleSlotImeAnchorSync(slot);
  }, 0);
}

function cancelSlotImeAnchorSync(slot: Slot): void {
  if (slot.imeRaf !== null) {
    cancelAnimationFrame(slot.imeRaf);
    slot.imeRaf = null;
  }
  if (slot.imeTimer !== null) {
    clearTimeout(slot.imeTimer);
    slot.imeTimer = null;
  }
}

function bindSlotCursorControlInterceptors(slot: Slot): void {
  const colorDisposable = slot.term.parser.registerOscHandler(12, (data) => {
    if (data.trim() === "?" && shouldSuppressNativeCursor(cursorAnimation)) {
      const leafId = slot.currentLeafId ?? slot.retainedLeafId;
      const bridge = leafId === null ? null : adapter?.resolveLeaf(leafId);
      if (!bridge) return false;
      const theme = buildTerminalTheme();
      bridge.writeToPty(
        formatOscColorReply(
          12,
          theme.cursor ?? theme.foreground ?? "rgb(255, 255, 255)",
        ),
      );
      return true;
    }
    return shouldInterceptTerminalCursorColor(cursorAnimation, data);
  });
  const styleDisposable = slot.term.parser.registerCsiHandler(
    { intermediates: " ", final: "q" },
    () => shouldInterceptTerminalCursorStyle(cursorAnimation),
  );
  slot.cursorDisposers.push(
    () => colorDisposable.dispose(),
    () => styleDisposable.dispose(),
  );
}

function bindSlotCursorOverlaySync(slot: Slot): void {
  const syncSoon = () => scheduleSlotCursorOverlaySync(slot);
  const renderDisposable = slot.term.onRender(syncSoon);
  const writeParsedDisposable = slot.term.onWriteParsed(syncSoon);
  slot.cursorDisposers.push(
    () => renderDisposable.dispose(),
    () => writeParsedDisposable.dispose(),
  );
}

function syncSlotCursorOverlay(slot: Slot): void {
  const strategy = getTerminalCursorRenderStrategy(cursorAnimation);
  const overlayStrategy = strategy === "overlay";
  const hasOwner = slot.currentLeafId !== null || slot.retainedLeafId !== null;
  setSlotNativeCursorSuppressed(slot, overlayStrategy && hasOwner);

  if (!overlayStrategy || !hasOwner) {
    hideSlotCursorOverlay(slot);
    return;
  }

  const leafId = slot.currentLeafId;
  const focused = leafId !== null && (adapter?.isLeafFocused(leafId) ?? false);
  if (
    !shouldShowTerminalCursorOverlay({
      strategy,
      hasOwner,
      hasLiveLeaf: leafId !== null,
      parked: slot.parked,
      focused,
      windowActive,
      cursorVisible: true,
      hostVisible: slot.host.style.visibility !== "hidden",
    })
  ) {
    hideSlotCursorOverlay(slot);
    return;
  }

  const visualCursor = resolveSlotVisualCursor(slot);
  if (!visualCursor) {
    hideSlotCursorOverlay(slot);
    return;
  }

  const screen = slot.term.element?.querySelector<HTMLElement>(".xterm-screen");
  if (!screen?.isConnected) {
    hideSlotCursorOverlay(slot);
    return;
  }

  const screenWidth = dimensionFromStyleOrRect(screen, "width");
  const screenHeight = dimensionFromStyleOrRect(screen, "height");
  const box = computeTerminalCursorOverlayBox({
    shape: cursorShape,
    cursorWidth,
    cols: slot.term.cols,
    rows: slot.term.rows,
    cursorX: visualCursor.cursorX,
    cursorY: visualCursor.cursorY,
    screenWidth,
    screenHeight,
  });
  if (!box) {
    hideSlotCursorOverlay(slot);
    return;
  }

  syncSlotCursorOverlayMask(
    slot,
    screen,
    visualCursor.maskColor
      ? computeTerminalCursorOverlayBox({
          shape: "block",
          cursorWidth,
          cols: slot.term.cols,
          rows: slot.term.rows,
          cursorX: visualCursor.cursorX,
          cursorY: visualCursor.cursorY,
          screenWidth,
          screenHeight,
        })
      : null,
    visualCursor.maskColor,
  );
  const overlay = ensureSlotCursorOverlay(slot, screen);
  const className = [
    "kite-terminal-cursor-overlay",
    `kite-terminal-cursor-overlay-${cursorAnimation}`,
    `kite-terminal-cursor-overlay-${cursorShape}`,
  ].join(" ");
  if (overlay.className !== className) overlay.className = className;
  setOverlayStyle(overlay.style, "display", "block");
  setOverlayStyle(overlay.style, "left", `${box.left}px`);
  setOverlayStyle(overlay.style, "top", `${box.top}px`);
  setOverlayStyle(overlay.style, "width", `${box.width}px`);
  setOverlayStyle(overlay.style, "height", `${box.height}px`);
}

type SlotVisualCursor = {
  cursorX: number;
  cursorY: number;
  maskColor: string | null;
};

function resolveSlotVisualCursor(slot: Slot): SlotVisualCursor | null {
  const buffer = slot.term.buffer.active;
  if (!isXtermCursorHidden(slot.term)) {
    return slotVisualCursor(slot, buffer.cursorX, buffer.cursorY);
  }
  if (buffer.type !== "normal") return null;

  const visibleCursor = findVisibleCursorCell({
    buffer,
    cols: slot.term.cols,
    rows: slot.term.rows,
    requireInverse: true,
  });
  if (!visibleCursor?.inverse) return null;
  return slotVisualCursor(slot, visibleCursor.cursorX, visibleCursor.cursorY);
}

function slotVisualCursor(
  slot: Slot,
  cursorX: number,
  cursorY: number,
): SlotVisualCursor {
  const x = Math.max(0, Math.min(slot.term.cols - 1, Math.trunc(cursorX)));
  const y = Math.max(0, Math.min(slot.term.rows - 1, Math.trunc(cursorY)));
  const buffer = slot.term.buffer.active;
  const cell = buffer.getLine(buffer.viewportY + y)?.getCell(x);
  return {
    cursorX: x,
    cursorY: y,
    maskColor: terminalCursorMaskColor(cell, (index) =>
      xtermPaletteColor(slot.term, index),
    ),
  };
}

function setOverlayStyle(
  style: CSSStyleDeclaration,
  property: "background" | "display" | "left" | "top" | "width" | "height",
  value: string,
): void {
  if (style[property] !== value) style[property] = value;
}

function scheduleSlotCursorOverlaySync(slot: Slot): void {
  if (slot.cursorOverlayRaf !== null) return;
  if (typeof requestAnimationFrame !== "function") {
    syncSlotCursorOverlay(slot);
    return;
  }
  slot.cursorOverlayRaf = requestAnimationFrame(() => {
    slot.cursorOverlayRaf = null;
    syncSlotCursorOverlay(slot);
  });
}

function cancelSlotCursorOverlaySync(slot: Slot): void {
  if (slot.cursorOverlayRaf === null) return;
  cancelAnimationFrame(slot.cursorOverlayRaf);
  slot.cursorOverlayRaf = null;
}

function ensureSlotCursorOverlay(
  slot: Slot,
  screen: HTMLElement,
): HTMLDivElement {
  let overlay = slot.cursorOverlay;
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    slot.cursorOverlay = overlay;
  }
  if (overlay.parentElement !== screen) screen.appendChild(overlay);
  return overlay;
}

function syncSlotCursorOverlayMask(
  slot: Slot,
  screen: HTMLElement,
  box: ReturnType<typeof computeTerminalCursorOverlayBox>,
  color: string | null,
): void {
  if (!box || !color) {
    hideSlotCursorOverlayMask(slot);
    return;
  }
  let mask = slot.cursorOverlayMask;
  if (!mask) {
    mask = document.createElement("div");
    mask.className = "kite-terminal-cursor-overlay-mask";
    mask.setAttribute("aria-hidden", "true");
    slot.cursorOverlayMask = mask;
  }
  if (mask.parentElement !== screen) screen.appendChild(mask);
  setOverlayStyle(mask.style, "background", color);
  setOverlayStyle(mask.style, "display", "block");
  setOverlayStyle(mask.style, "left", `${box.left}px`);
  setOverlayStyle(mask.style, "top", `${box.top}px`);
  setOverlayStyle(mask.style, "width", `${box.width}px`);
  setOverlayStyle(mask.style, "height", `${box.height}px`);
}

function hideSlotCursorOverlayMask(slot: Slot): void {
  if (slot.cursorOverlayMask) slot.cursorOverlayMask.style.display = "none";
}

function hideSlotCursorOverlay(slot: Slot): void {
  if (slot.cursorOverlay) slot.cursorOverlay.style.display = "none";
  hideSlotCursorOverlayMask(slot);
}

function disposeSlotCursorOverlay(slot: Slot): void {
  cancelSlotCursorOverlaySync(slot);
  slot.cursorOverlay?.remove();
  slot.cursorOverlay = null;
  slot.cursorOverlayMask?.remove();
  slot.cursorOverlayMask = null;
  slot.host.classList.remove("kite-terminal-overlay-cursor-active");
}

export function resetSlotCursorVisibility(slot: Slot): void {
  scheduleSlotCursorOverlaySync(slot);
}

function setSlotNativeCursorSuppressed(slot: Slot, suppressed: boolean): void {
  slot.host.classList.toggle("kite-terminal-overlay-cursor-active", suppressed);

  if (suppressed) {
    slot.cursorNativeSuppressed = true;
    return;
  }

  if (!slot.cursorNativeSuppressed) return;
  slot.cursorNativeSuppressed = false;
}

type TerminalCursorInternals = Terminal & {
  _core?: {
    coreService?: {
      decPrivateModes?: {
        cursorBlink?: boolean;
        cursorStyle?: "bar" | "block" | "underline";
      };
      isCursorHidden?: boolean;
    };
    _themeService?: {
      colors?: {
        ansi?: { css?: string }[];
      };
    };
  };
};

function isXtermCursorHidden(term: Terminal): boolean {
  return (
    (term as TerminalCursorInternals)._core?.coreService?.isCursorHidden ===
    true
  );
}

export function clearXtermCursorStyleOverride(term: Terminal): void {
  const modes = (term as TerminalCursorInternals)._core?.coreService
    ?.decPrivateModes;
  if (!modes) return;
  modes.cursorStyle = undefined;
  modes.cursorBlink = undefined;
}

function xtermPaletteColor(term: Terminal, index: number): string | null {
  return (
    (term as TerminalCursorInternals)._core?._themeService?.colors?.ansi?.[
      index
    ]?.css ?? null
  );
}

function dimensionFromStyleOrRect(
  element: HTMLElement,
  property: "width" | "height",
): number {
  const styled = Number.parseFloat(element.style[property]);
  if (Number.isFinite(styled) && styled > 0) return styled;
  const rect = element.getBoundingClientRect();
  return property === "width" ? rect.width : rect.height;
}

function rewireSlot(slot: Slot, p: AcquireParams): void {
  slot.lastUsedAt = performance.now();
  unparkSlotHost(slot);
  if (slot.host.parentNode !== p.container) {
    p.container.appendChild(slot.host);
  }
  setupResizeObserver(slot, p);
  slot.fitAddon.fit();
  syncSlotImeAnchor(slot);
  applyCursorRenderingOnSlot(slot, adapter?.isLeafFocused(p.leafId) ?? false);
  slot.lastW = p.container.clientWidth;
  slot.lastH = p.container.clientHeight;
  if (slot.term.cols !== p.cols || slot.term.rows !== p.rows) {
    adapter?.resolveLeaf(p.leafId)?.resizePty(slot.term.cols, slot.term.rows);
  }
  slot.lastCols = slot.term.cols;
  slot.lastRows = slot.term.rows;
  p.onSearchReady(slot.searchAddon);
}

function setupResizeObserver(slot: Slot, p: AcquireParams): void {
  slot.observer?.disconnect();
  if (slot.fitTimer) clearTimeout(slot.fitTimer);
  if (slot.ptyTimer) clearTimeout(slot.ptyTimer);
  slot.fitTimer = null;
  slot.ptyTimer = null;

  const container = p.container;
  const flushPty = () => {
    slot.ptyTimer = null;
    if (slot.currentLeafId !== p.leafId) return;
    if (slot.term.cols === slot.lastCols && slot.term.rows === slot.lastRows)
      return;
    slot.lastCols = slot.term.cols;
    slot.lastRows = slot.term.rows;
    adapter?.resolveLeaf(p.leafId)?.resizePty(slot.lastCols, slot.lastRows);
  };

  slot.observer = new ResizeObserver(() => {
    if (slot.parked) return;
    if (slot.fitTimer) clearTimeout(slot.fitTimer);
    slot.fitTimer = setTimeout(() => {
      slot.fitTimer = null;
      if (slot.currentLeafId !== p.leafId || slot.parked) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === slot.lastW && h === slot.lastH) return;
      slot.lastW = w;
      slot.lastH = h;
      slot.fitAddon.fit();
      syncSlotImeAnchor(slot);
      scheduleSlotCursorOverlaySync(slot);
      if (slot.ptyTimer) clearTimeout(slot.ptyTimer);
      slot.ptyTimer = setTimeout(flushPty, PTY_RESIZE_DEBOUNCE_MS);
    }, FIT_DEBOUNCE_MS);
  });
  slot.observer.observe(container);
}

export type SerializeOutput = {
  snapshot: string | null;
  cols: number;
  rows: number;
  altScreen: boolean;
};

export type ReleaseOutput = { cols: number; rows: number };

export function releaseSlot(leafId: number): ReleaseOutput | null {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  if (!slot) return null;
  detachSlotFromLeaf(slot, true);
  return { cols: slot.term.cols, rows: slot.term.rows };
}

function serializeSlot(slot: Slot): SerializeOutput {
  let snapshot: string | null = null;
  try {
    const cap = Math.min(
      SNAPSHOT_SCROLLBACK_CAP,
      usePreferencesStore.getState().terminalScrollback,
    );
    snapshot = slot.serializeAddon.serialize({ scrollback: cap });
  } catch (e) {
    console.warn("[kite] serialize failed:", e);
  }
  return {
    snapshot,
    cols: slot.term.cols,
    rows: slot.term.rows,
    altScreen: isAltScreen(slot),
  };
}

function detachSlotFromLeaf(slot: Slot, retain: boolean): void {
  if (retain && slot.currentLeafId !== null) {
    slot.retainedLeafId = slot.currentLeafId;
    parkSlotHost(slot);
  } else {
    discardRetention(slot);
    unparkSlotHost(slot);
    if (slot.host.parentNode !== getRecycler()) {
      getRecycler().appendChild(slot.host);
    }
  }

  slot.observer?.disconnect();
  slot.observer = null;
  if (slot.fitTimer) clearTimeout(slot.fitTimer);
  if (slot.ptyTimer) clearTimeout(slot.ptyTimer);
  slot.fitTimer = null;
  slot.ptyTimer = null;

  cancelPendingUnhide(slot);
  cancelSlotImeAnchorSync(slot);
  cancelSlotCursorOverlaySync(slot);
  disposeSlotCursorOverlay(slot);
  slot.host.style.visibility = "";

  slot.currentLeafId = null;
  syncSlotCursorOverlay(slot);
  slot.lastUsedAt = performance.now();
  scheduleWebglReap(slot);
  scheduleSlotReap(slot);
}

// display:none makes xterm's IntersectionObserver pause rendering while the
// buffer keeps parsing writes; visibility:hidden would not (geometry remains).
function parkSlotHost(slot: Slot): void {
  if (slot.parked) return;
  slot.parked = true;
  applyCursorRenderingOnSlot(slot, false);
  hideSlotCursorOverlay(slot);
  slot.host.style.display = "none";
}

function unparkSlotHost(slot: Slot): void {
  if (!slot.parked) return;
  slot.parked = false;
  slot.host.style.display = "";
  scheduleSlotCursorOverlaySync(slot);
}

function scheduleWebglReap(slot: Slot): void {
  cancelWebglReap(slot);
  if (!slot.webglAddon) return;
  slot.webglReapTimer = setTimeout(() => {
    slot.webglReapTimer = null;
    if (slot.currentLeafId === null || slot.parked) disposeSlotWebgl(slot);
  }, WEBGL_REAP_GRACE_MS);
}

function cancelWebglReap(slot: Slot): void {
  if (slot.webglReapTimer !== null) {
    clearTimeout(slot.webglReapTimer);
    slot.webglReapTimer = null;
  }
}

function scheduleSlotReap(slot: Slot): void {
  cancelSlotReap(slot);
  slot.slotReapTimer = setTimeout(() => {
    slot.slotReapTimer = null;
    reapIdleSlot(slot);
  }, SLOT_REAP_GRACE_MS);
}

function cancelSlotReap(slot: Slot): void {
  if (slot.slotReapTimer !== null) {
    clearTimeout(slot.slotReapTimer);
    slot.slotReapTimer = null;
  }
}

function reapIdleSlot(slot: Slot): void {
  if (slot.currentLeafId !== null) return;
  const idle = slots.filter((s) => s.currentLeafId === null);
  if (idle.length <= IDLE_SLOTS_KEEP_WARM) return;
  idle.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  const surplus = idle.slice(0, idle.length - IDLE_SLOTS_KEEP_WARM);
  if (!surplus.includes(slot)) return;
  if (slot.retainedLeafId !== null) {
    adapter?.storeSnapshot(slot.retainedLeafId, serializeSlot(slot));
  }
  disposeSlot(slot);
}

function disposeSlot(slot: Slot): void {
  cancelSlotReap(slot);
  cancelWebglReap(slot);
  cancelPendingUnhide(slot);
  cancelSlotImeAnchorSync(slot);
  cancelSlotCursorOverlaySync(slot);
  if (slot.fitTimer) clearTimeout(slot.fitTimer);
  if (slot.ptyTimer) clearTimeout(slot.ptyTimer);
  slot.fitTimer = null;
  slot.ptyTimer = null;
  slot.observer?.disconnect();
  slot.observer = null;
  for (const d of slot.oscDisposers) {
    try {
      d();
    } catch {}
  }
  slot.oscDisposers = [];
  for (const d of slot.imeDisposers) {
    try {
      d();
    } catch {}
  }
  slot.imeDisposers = [];
  for (const d of slot.cursorDisposers) {
    try {
      d();
    } catch {}
  }
  slot.cursorDisposers = [];
  setSlotNativeCursorSuppressed(slot, false);
  disposeSlotCursorOverlay(slot);
  disposeSlotWebgl(slot);
  try {
    slot.term.dispose();
  } catch (e) {
    console.warn("[kite] slot dispose failed:", e);
  }
  slot.host.remove();
  const i = slots.indexOf(slot);
  if (i >= 0) slots.splice(i, 1);
}

const WEBGL_RECOVERY_DELAY_MS = 250;
// Below this a re-shown slot is fresh enough to trust; above it, repaint on
// unhide to defeat silent GPU/context staleness.
const SLOT_STALE_MS = 10_000;
const WEBGL_REAP_GRACE_MS = 30_000;
const SLOT_REAP_GRACE_MS = 45_000;
const IDLE_SLOTS_KEEP_WARM = 1;

function attachWebgl(slot: Slot): void {
  if (slot.webglAddon || !slot.term.element) return;
  if (!usePreferencesStore.getState().terminalWebglEnabled) return;
  const elem = slot.term.element;
  const before = new Set<HTMLCanvasElement>(
    elem.querySelectorAll<HTMLCanvasElement>("canvas"),
  );
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => {
      const cur = slot.webglAddon;
      if (cur === webgl) {
        slot.webglAddon = null;
        slot.webglCanvases = [];
      }
      try {
        webgl.dispose();
      } catch {}
      // Recovery: WebKit may transiently lose contexts on sleep/wake or GPU
      // reset; without re-attach the slot would silently fall back to DOM
      // forever. Defer past WebKit's reset window before retrying.
      setTimeout(() => {
        if (slot.webglAddon || slot.currentLeafId === null || slot.parked)
          return;
        if (!usePreferencesStore.getState().terminalWebglEnabled) return;
        attachWebgl(slot);
        if (slot.webglAddon) {
          try {
            slot.term.refresh(0, slot.term.rows - 1);
          } catch {}
        }
      }, WEBGL_RECOVERY_DELAY_MS);
    });
    slot.term.loadAddon(webgl);
    const after = elem.querySelectorAll<HTMLCanvasElement>("canvas");
    const added: HTMLCanvasElement[] = [];
    for (const c of after) if (!before.has(c)) added.push(c);
    slot.webglAddon = webgl;
    slot.webglCanvases = added;
  } catch (e) {
    console.warn("[kite-webgl] unavailable:", e);
  }
}

function disposeSlotWebgl(slot: Slot): void {
  if (!slot.webglAddon) return;
  const addon = slot.webglAddon;
  for (const canvas of slot.webglCanvases) releaseCanvasContext(canvas);
  slot.webglCanvases = [];
  try {
    addon.dispose();
  } catch (e) {
    console.warn("[kite-webgl] dispose failed:", e);
  }
  try {
    const r = (
      addon as unknown as { _renderer?: Record<string, unknown> | null }
    )._renderer;
    if (r) {
      r._canvas = null;
      r._gl = null;
      r._charAtlas = null;
      r._atlas = null;
    }
    (
      addon as unknown as { _renderer?: unknown; _renderService?: unknown }
    )._renderer = null;
    (
      addon as unknown as { _renderer?: unknown; _renderService?: unknown }
    )._renderService = null;
  } catch {}
  slot.webglAddon = null;
}

function releaseCanvasContext(canvas: HTMLCanvasElement): void {
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
  } catch {}
  if (!gl) {
    try {
      gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    } catch {}
  }
  if (gl) {
    try {
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext && !gl.isContextLost()) ext.loseContext();
    } catch {}
  }
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {}
}

export function applyWebglPreference(enabled: boolean): void {
  for (const slot of slots) {
    if (enabled) {
      if (slot.currentLeafId !== null && !slot.parked && !slot.webglAddon) {
        attachWebgl(slot);
        if (slot.webglAddon) {
          try {
            slot.term.refresh(0, slot.term.rows - 1);
          } catch {}
        }
      }
      scheduleSlotCursorOverlaySync(slot);
    } else if (slot.webglAddon) {
      cancelWebglReap(slot);
      disposeSlotWebgl(slot);
      scheduleSlotCursorOverlaySync(slot);
    }
  }
}

// Parked and retained slots can't be measured (display:none); poison lastW
// so the refit happens on unpark/rebind instead.
function refitSlot(slot: Slot): void {
  if (slot.parked || slot.currentLeafId === null) {
    slot.lastW = -1;
    return;
  }
  slot.fitAddon.fit();
  syncSlotImeAnchor(slot);
  scheduleSlotCursorOverlaySync(slot);
  slot.lastCols = slot.term.cols;
  slot.lastRows = slot.term.rows;
  adapter
    ?.resolveLeaf(slot.currentLeafId)
    ?.resizePty(slot.term.cols, slot.term.rows);
}

export function applyFontSize(size: number): void {
  for (const slot of slots) {
    if (slot.term.options.fontSize === size) continue;
    slot.term.options.fontSize = size;
    refitSlot(slot);
  }
}

export function applyLetterSpacing(spacing: number): void {
  for (const slot of slots) {
    if (slot.term.options.letterSpacing === spacing) continue;
    slot.term.options.letterSpacing = spacing;
    refitSlot(slot);
  }
}

export function applyFontFamily(family: string): void {
  const resolved = resolveFontFamily(family);
  for (const slot of slots) {
    if (slot.term.options.fontFamily === resolved) continue;
    slot.term.options.fontFamily = resolved;
    refitSlot(slot);
  }
}

export function applyFontWeight(weight: string): void {
  for (const slot of slots) {
    if (slot.term.options.fontWeight === weight) continue;
    slot.term.options.fontWeight = weight as FontWeight;
    scheduleSlotImeAnchorSync(slot);
    scheduleSlotCursorOverlaySync(slot);
  }
}

export function applyScrollback(value: number): void {
  for (const slot of slots) {
    if (slot.term.options.scrollback === value) continue;
    slot.term.options.scrollback = value;
  }
}

export function applyTheme(): void {
  const theme = terminalThemeForCursorAnimation(cursorAnimation);
  for (const slot of slots) {
    slot.term.options.theme = theme;
    scheduleSlotImeAnchorSync(slot);
    scheduleSlotCursorOverlaySync(slot);
  }
}

export function focusSlot(leafId: number): void {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  if (!slot) return;
  syncSlotImeAnchor(slot);
  scheduleSlotCursorOverlaySync(slot);
  slot.term.focus();
}

export function setSlotFocused(leafId: number, focused: boolean): void {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  if (!slot) return;
  applyCursorRenderingOnSlot(slot, focused);
}

export function applyCursorPreferences(
  shape: TerminalCursorShape,
  animation: TerminalCursorAnimation,
  width: TerminalCursorWidth,
): void {
  const previousStrategy = getTerminalCursorRenderStrategy(cursorAnimation);
  const nextStrategy = getTerminalCursorRenderStrategy(animation);
  const enteringOverlay =
    previousStrategy !== nextStrategy && nextStrategy === "overlay";
  const theme =
    previousStrategy === nextStrategy
      ? null
      : terminalThemeForCursorAnimation(animation);
  const nativeShape = resolveTerminalNativeCursorShape(animation, shape);
  const nativeWidth = resolveTerminalNativeCursorWidth(animation, width);
  cursorShape = shape;
  cursorAnimation = animation;
  cursorWidth = width;
  for (const slot of slots) {
    if (enteringOverlay) {
      clearXtermCursorStyleOverride(slot.term);
      slot.term.options.cursorBlink = true;
    }
    if (theme) {
      slot.term.options.theme = theme;
    }
    if (slot.term.options.cursorStyle !== nativeShape) {
      slot.term.options.cursorStyle = nativeShape;
    }
    if (slot.term.options.cursorWidth !== nativeWidth) {
      slot.term.options.cursorWidth = nativeWidth;
    }
    applyCursorRenderingOnSlot(
      slot,
      slot.currentLeafId !== null
        ? (adapter?.isLeafFocused(slot.currentLeafId) ?? false)
        : false,
    );
  }
}

export function applyCursorBlink(enabled: boolean): void {
  applyCursorPreferences(
    cursorShape,
    enabled ? "blink" : "steady",
    cursorWidth,
  );
}

function applyCursorRenderingOnSlot(slot: Slot, focused: boolean): void {
  const overlayStrategy =
    getTerminalCursorRenderStrategy(cursorAnimation) === "overlay";
  const desiredBlink =
    !overlayStrategy &&
    shouldCursorBlink(cursorAnimation, windowActive, focused);
  if (slot.term.options.cursorBlink !== desiredBlink) {
    slot.term.options.cursorBlink = desiredBlink;
  }
  const inactiveStyle = overlayStrategy ? "none" : "outline";
  if (slot.term.options.cursorInactiveStyle !== inactiveStyle) {
    slot.term.options.cursorInactiveStyle = inactiveStyle;
  }
  syncSlotCursorOverlay(slot);
}

export function getSlotForLeaf(leafId: number): Slot | null {
  return slots.find((s) => s.currentLeafId === leafId) ?? null;
}

export function isLeafAltScreen(leafId: number): boolean {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  return slot ? isAltScreen(slot) : false;
}

export function parkLeafSlot(leafId: number): void {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  if (!slot) return;
  parkSlotHost(slot);
  scheduleWebglReap(slot);
}

export function refreshLeafSlot(leafId: number): void {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  if (!slot) return;
  cancelWebglReap(slot);
  unparkSlotHost(slot);
  if (usePreferencesStore.getState().terminalWebglEnabled && !slot.webglAddon) {
    attachWebgl(slot);
  }
  // The observer skips parked slots; catch up on container resizes here.
  const container = slot.host.parentElement;
  if (
    container &&
    (container.clientWidth !== slot.lastW ||
      container.clientHeight !== slot.lastH)
  ) {
    slot.lastW = container.clientWidth;
    slot.lastH = container.clientHeight;
    slot.fitAddon.fit();
    if (slot.term.cols !== slot.lastCols || slot.term.rows !== slot.lastRows) {
      slot.lastCols = slot.term.cols;
      slot.lastRows = slot.term.rows;
      adapter?.resolveLeaf(leafId)?.resizePty(slot.lastCols, slot.lastRows);
    }
  }
  try {
    slot.term.refresh(0, slot.term.rows - 1);
  } catch {}
  scheduleSlotImeAnchorSync(slot);
  scheduleSlotCursorOverlaySync(slot);
}

export function disposeLeafSlot(leafId: number): void {
  const slot = slots.find(
    (s) => s.currentLeafId === leafId || s.retainedLeafId === leafId,
  );
  if (slot) disposeSlot(slot);
}

export function discardRetainedSlot(leafId: number): void {
  const slot = slots.find(
    (s) => s.currentLeafId === null && s.retainedLeafId === leafId,
  );
  if (!slot) return;
  discardRetention(slot);
  slot.term.clear();
  slot.term.reset();
  slot.noopSynchronizedOutputPrimed = false;
  resetSlotCursorVisibility(slot);
}

export function getLiveSlotForLeaf(leafId: number): Slot | null {
  return (
    slots.find(
      (s) => s.currentLeafId === leafId || s.retainedLeafId === leafId,
    ) ?? null
  );
}

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

function isTerminalCopy(e: KeyboardEvent): boolean {
  return (
    !IS_MAC &&
    e.ctrlKey &&
    e.shiftKey &&
    !e.altKey &&
    !e.metaKey &&
    (e.code === "KeyC" || e.key === "c" || e.key === "C")
  );
}

function isTerminalPaste(e: KeyboardEvent): boolean {
  return (
    !IS_MAC &&
    e.ctrlKey &&
    e.shiftKey &&
    !e.altKey &&
    !e.metaKey &&
    (e.code === "KeyV" || e.key === "v" || e.key === "V")
  );
}

function isShiftEnter(e: KeyboardEvent): boolean {
  return (
    e.key === "Enter" && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey
  );
}
