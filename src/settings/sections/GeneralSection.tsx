import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useFontCatalog, fontSuggestions } from "@/lib/fontCatalog";
import {
  findUnavailableFonts,
  measureCjkAlignment,
  suggestAlignedCjkFont,
} from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { useMessages } from "@/modules/i18n";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { ThemePref } from "@/modules/settings/store";
import {
  setRestoreWindowState,
  setTerminalCjkFontFamily,
  setTerminalFontFamily,
  setTerminalFontSize,
  setTerminalFontWeight,
  setTerminalLetterSpacing,
  setTerminalScrollback,
  setTerminalShell,
  setTerminalWebglEnabled,
  setZoomLevel,
  TERMINAL_FONT_SIZES,
  TERMINAL_SCROLLBACK_PRESETS,
} from "@/modules/settings/store";
import { useTheme } from "@/modules/theme";
import {
  ComputerIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import type { ReactNode } from "react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { SettingGroup, SettingGroupTitle } from "../components/SettingGroup";
import { SectionHeader } from "../components/SectionHeader";
import { SettingRow } from "../components/SettingRow";

const APPEARANCE: {
  id: ThemePref;
  icon: typeof ComputerIcon;
}[] = [
  { id: "system", icon: ComputerIcon },
  { id: "light", icon: Sun03Icon },
  { id: "dark", icon: Moon02Icon },
];

const TERMINAL_FONT_WEIGHTS = [
  { value: "normal", labelKey: "normal" },
  { value: "500", labelKey: "medium" },
  { value: "600", labelKey: "semiBold" },
  { value: "bold", labelKey: "bold" },
] as const;

const LETTER_SPACINGS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;

type ShellInfo = { name: string; path: string };
const SHELL_AUTO = "auto";
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.05;

export function GeneralSection() {
  const messages = useMessages();
  const g = messages.settings.general;
  const { mode, setMode } = useTheme();

  const restoreWindowState = usePreferencesStore((s) => s.restoreWindowState);
  const terminalWebglEnabled = usePreferencesStore(
    (s) => s.terminalWebglEnabled,
  );
  const terminalFontFamily = usePreferencesStore((s) => s.terminalFontFamily);
  const terminalCjkFontFamily = usePreferencesStore(
    (s) => s.terminalCjkFontFamily,
  );
  const terminalFontWeight = usePreferencesStore((s) => s.terminalFontWeight);
  const terminalShell = usePreferencesStore((s) => s.terminalShell);
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const terminalLetterSpacing = usePreferencesStore(
    (s) => s.terminalLetterSpacing,
  );
  const terminalFontSize = usePreferencesStore((s) => s.terminalFontSize);
  const terminalScrollback = usePreferencesStore((s) => s.terminalScrollback);
  const zoomLevel = usePreferencesStore((s) => s.zoomLevel);

  useEffect(() => {
    void invoke<ShellInfo[]>("pty_list_shells")
      .then(setShells)
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title={g.title} />

      <div className="flex flex-col gap-2">
        <SettingGroupTitle>{g.appearance.title}</SettingGroupTitle>
        <div className="grid grid-cols-3 gap-2.5">
          {APPEARANCE.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={mode === o.id}
              onClick={() => setMode(o.id)}
              className={cn(
                "group flex h-16 flex-col items-center justify-center gap-1 rounded-lg border bg-card transition-[border-color,box-shadow,background-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-soft)] active:scale-[var(--motion-scale-press)]",
                mode === o.id
                  ? "border-foreground/60 ring-1 ring-foreground/20"
                  : "border-border/60 hover:border-border",
              )}
            >
              <HugeiconsIcon icon={o.icon} size={16} strokeWidth={1.5} />
              <span className="text-[11px]">{g.appearance[o.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <SettingGroup title={g.zoom.title}>
        <SettingRow title={g.zoom.uiZoomLevel}>
          <div className="flex w-56 items-center gap-3">
            <Slider
              value={[zoomLevel]}
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              onValueChange={(v) => void setZoomLevel(v[0] ?? 1)}
              className="flex-1"
            />
            <span className="w-10 text-right tabular-nums text-[11px] text-muted-foreground">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={g.terminal.title}>
        <FontFamilyInput
          codeValue={terminalFontFamily}
          cjkValue={terminalCjkFontFamily}
          onCodeCommit={(v) => void setTerminalFontFamily(v)}
          onCjkCommit={(v) => void setTerminalCjkFontFamily(v)}
        />
        <SettingRow title={g.terminal.fontSize}>
          <Select
            value={String(terminalFontSize)}
            onValueChange={(v) => void setTerminalFontSize(Number(v))}
          >
            <SelectTrigger size="sm" className="h-7 w-36 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {TERMINAL_FONT_SIZES.map((size) => (
                <SelectItem
                  key={size}
                  value={String(size)}
                  className="text-[12px]"
                >
                  {size} px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow title={g.terminal.fontWeight}>
          <Select
            value={terminalFontWeight}
            onValueChange={(v) => void setTerminalFontWeight(v)}
          >
            <SelectTrigger size="sm" className="h-7 w-36 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {TERMINAL_FONT_WEIGHTS.map((w) => (
                <SelectItem
                  key={w.value}
                  value={w.value}
                  className="text-[12px]"
                >
                  {g.terminal.fontWeights[w.labelKey]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow title={g.terminal.letterSpacing}>
          <Select
            value={String(terminalLetterSpacing)}
            onValueChange={(v) => void setTerminalLetterSpacing(Number(v))}
          >
            <SelectTrigger size="sm" className="h-7 w-36 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {LETTER_SPACINGS.map((v) => (
                <SelectItem key={v} value={String(v)} className="text-[12px]">
                  {v > 0 ? `+${v}` : v} px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow title={g.terminal.shell}>
          <Select
            value={terminalShell || SHELL_AUTO}
            onValueChange={(v) =>
              void setTerminalShell(v === SHELL_AUTO ? "" : v)
            }
          >
            <SelectTrigger size="sm" className="h-7 w-36 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={SHELL_AUTO} className="text-[12px]">
                {g.terminal.autoShell}
              </SelectItem>
              {shells.map((s) => (
                <SelectItem key={s.path} value={s.path} className="text-[12px]">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow title={g.terminal.useWebgl}>
          <Switch
            aria-label={g.terminal.useWebgl}
            checked={terminalWebglEnabled}
            onCheckedChange={(v) => void setTerminalWebglEnabled(v)}
          />
        </SettingRow>
        <SettingRow title={g.terminal.scrollback}>
          <Select
            value={String(terminalScrollback)}
            onValueChange={(v) => void setTerminalScrollback(Number(v))}
          >
            <SelectTrigger size="sm" className="h-7 w-36 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {TERMINAL_SCROLLBACK_PRESETS.map((lines) => (
                <SelectItem
                  key={lines}
                  value={String(lines)}
                  className="text-[12px]"
                >
                  {g.terminal.scrollbackLines(lines)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={g.startup.title}>
        <SettingRow title={g.startup.restoreWindow}>
          <Switch
            aria-label={g.startup.restoreWindow}
            checked={restoreWindowState}
            onCheckedChange={(v) => void setRestoreWindowState(v)}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

// Font family names are free-form: VS Code-style, the user types whatever the
// OS has installed. Nothing is enumerated, so the field never implies a font is
// missing just because it was not on a curated list.
function FontFamilyInput({
  codeValue,
  cjkValue,
  onCodeCommit,
  onCjkCommit,
}: {
  codeValue: string;
  cjkValue: string;
  onCodeCommit: (value: string) => void;
  onCjkCommit: (value: string) => void;
}) {
  const messages = useMessages();
  const terminalMessages = messages.settings.general.terminal;
  const catalog = useFontCatalog();

  // Describes the committed pair, not in-progress text: like the unmatched
  // probe, it must not nag on every keystroke. xterm lays CJK on two latin
  // cells and cannot rescale fallback glyphs, so a non 2:1 pair renders
  // uneven ideographs; the hint names the problem and offers the installed
  // 2:1 face, if any.
  const alignment = useMemo(
    () => measureCjkAlignment(codeValue, cjkValue),
    [codeValue, cjkValue],
  );
  const alignedSuggestion = useMemo(
    () => (alignment && !alignment.ok ? suggestAlignedCjkFont() : null),
    [alignment],
  );

  return (
    <SettingRow title={terminalMessages.fontFamily}>
      <div className="grid w-75 grid-cols-2 gap-3">
        <FontFamilyField
          label={terminalMessages.codeFontFamily}
          value={codeValue}
          placeholder={terminalMessages.codeFontFamilyPlaceholder}
          unmatchedHint={terminalMessages.fontFamilyUnmatched}
          suggestions={fontSuggestions(catalog, "code")}
          onCommit={onCodeCommit}
        />
        <FontFamilyField
          label={terminalMessages.cjkFontFamily}
          value={cjkValue}
          placeholder={terminalMessages.cjkFontFamilyPlaceholder}
          unmatchedHint={terminalMessages.fontFamilyUnmatched}
          suggestions={fontSuggestions(catalog, "cjk")}
          onCommit={onCjkCommit}
          extraHint={
            alignment && !alignment.ok ? (
              <p
                role="status"
                className="flex flex-wrap items-center gap-x-1.5 text-[10.5px] leading-tight text-destructive"
              >
                {terminalMessages.cjkMisaligned}
                {alignedSuggestion && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-4.5 rounded-md px-1.5 text-[10.5px]"
                    onClick={() => onCjkCommit(alignedSuggestion)}
                  >
                    {terminalMessages.cjkMisalignedFix(alignedSuggestion)}
                  </Button>
                )}
              </p>
            ) : null
          }
        />
      </div>
    </SettingRow>
  );
}

// Local while typing, committed on blur or Enter so we do not rewrite the
// preference (and re-layout every terminal) on each keystroke.
function FontFamilyField({
  label,
  value,
  placeholder,
  unmatchedHint,
  suggestions,
  onCommit,
  extraHint = null,
}: {
  label: string;
  value: string;
  placeholder: string;
  unmatchedHint: string;
  suggestions: string[];
  onCommit: (value: string) => void;
  extraHint?: ReactNode;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  // Set by Escape so the blur it triggers reverts instead of committing. A ref
  // rather than state: onBlur runs before React re-renders, so a state update
  // would still be stale when the commit reads it.
  const reverted = useRef(false);

  // A change from another window (settings is shared) must win over stale
  // local text, but not mid-edit.
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Probe the value the terminal is actually using, not the in-progress text,
  // so the warning describes the real render and does not nag per keystroke.
  const unmatched = useMemo(() => findUnavailableFonts(value), [value]);

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [panelRect, setPanelRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const filtered = useMemo(() => {
    if (!editing) return suggestions;
    const q = draft.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(q));
  }, [suggestions, editing, draft]);
  // Keep the highlight reachable when the filtered set shrinks.
  const items = filtered.slice(0, 60);

  // The panel is portaled to the body: SettingGroup's overflow-hidden would
  // clip an absolutely positioned child, and the rounded border would cut the
  // popover mid-list. Position it from the input's live rect while open.
  useLayoutEffect(() => {
    if (!open) {
      setPanelRect(null);
      return;
    }
    const measure = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPanelRect({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    measure();
    // Scrolling the settings surface would detach the panel from the input;
    // closing keeps the interaction honest instead of letting it float. The
    // panel's own list scroll must stay open: scroll events do not bubble, so
    // the capture listener on window sees them too and has to filter them out.
    const closeOnScroll = (e: Event) => {
      const target = e.target;
      if (
        listRef.current &&
        target instanceof Node &&
        listRef.current.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [open]);

  // Keep keyboard-driven highlights inside the panel viewport so arrow keys
  // can walk past the visible rows.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${id}-opt-${highlight}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, id]);

  const pick = (family: string) => {
    setDraft(family);
    onCommit(family);
    setOpen(false);
  };

  return (
    <div className="relative flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[10.5px] text-muted-foreground">
        {label}
      </label>
      <Input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? `${id}-listbox` : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          open && items[highlight] ? `${id}-opt-${highlight}` : undefined
        }
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className={cn(
          "h-7 rounded-lg text-[12px]",
          unmatched.length > 0 && "border-destructive/60",
        )}
        onChange={(e) => {
          setDraft(e.target.value);
          setHighlight(0);
        }}
        onFocus={() => {
          setEditing(true);
          setHighlight(0);
          setOpen(true);
        }}
        onBlur={() => {
          setEditing(false);
          setOpen(false);
          if (reverted.current) {
            reverted.current = false;
            setDraft(value);
          } else if (draft !== value) {
            onCommit(draft);
          }
        }}
        onKeyDown={(e) => {
          if (open && items.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => (h + 1) % items.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => (h - 1 + items.length) % items.length);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              pick(items[highlight]);
              e.currentTarget.blur();
              return;
            }
          }
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            if (open) {
              setOpen(false);
            } else {
              reverted.current = true;
              e.currentTarget.blur();
            }
          }
        }}
      />
      <div
        className="kite-reveal"
        data-state={
          unmatched.length > 0 || extraHint !== null ? "open" : "closed"
        }
      >
        <div>
          {unmatched.length > 0 ? (
            <p
              role="status"
              className="text-[10.5px] leading-tight text-destructive"
            >
              {unmatched.join(", ")}: {unmatchedHint}
            </p>
          ) : (
            extraHint
          )}
        </div>
      </div>
      {open &&
        items.length > 0 &&
        panelRect &&
        createPortal(
          <div
            ref={listRef}
            id={`${id}-listbox`}
            role="listbox"
            aria-label={label}
            className="kite-popover-motion fixed z-50 max-h-56 overscroll-contain overflow-y-auto rounded-lg border border-border/70 bg-popover py-1 shadow-lg"
            data-state="open"
            data-side="bottom"
            style={{
              top: panelRect.top,
              left: panelRect.left,
              width: panelRect.width,
            }}
          >
            {items.map((family, i) => (
              <button
                type="button"
                key={family}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === highlight}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-2.5 py-1 text-left text-[12px] outline-none",
                  i === highlight && "bg-accent text-accent-foreground",
                )}
                style={{ fontFamily: `"${family}", monospace` }}
                // mousedown so the pick lands before the input's blur commit.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(family);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="min-w-0 flex-1 truncate">{family}</span>
                {family === value && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    ●
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
