import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { findUnavailableFonts } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { useMessages } from "@/modules/i18n";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { ThemePref } from "@/modules/settings/store";
import {
  setDefaultWorkspaceEnv,
  setRestoreWindowState,
  setShowHidden,
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
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SettingGroup, SettingGroupTitle } from "../components/SettingGroup";
import { SectionHeader } from "../components/SectionHeader";
import { SettingRow } from "../components/SettingRow";
import { useSettingsNavigation } from "../SettingsNavigationContext";

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

type ShellInfo = { name: string; path: string; integrated: boolean };
const SHELL_AUTO = "auto";
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.05;

export function GeneralSection() {
  const messages = useMessages();
  const g = messages.settings.general;
  const { setActiveTab } = useSettingsNavigation();
  const { mode, setMode } = useTheme();

  const restoreWindowState = usePreferencesStore((s) => s.restoreWindowState);
  const showHidden = usePreferencesStore((s) => s.showHidden);
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
  const [wslDistros, setWslDistros] = useState<{ name: string }[]>([]);
  const defaultWorkspaceEnv = usePreferencesStore((s) => s.defaultWorkspaceEnv);
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
    void invoke<{ name: string }[]>("wsl_list_distros")
      .then(setWslDistros)
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title={g.title} description={g.description} />

      <div className="flex flex-col gap-2">
        <SettingGroupTitle>{g.appearance.title}</SettingGroupTitle>
        <div className="grid grid-cols-3 gap-2">
          {APPEARANCE.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={mode === o.id}
              onClick={() => setMode(o.id)}
              className={cn(
                "group flex h-20 flex-col items-center justify-center gap-1.5 rounded-lg border bg-card transition-all",
                mode === o.id
                  ? "border-foreground/60 ring-1 ring-foreground/20"
                  : "border-border/60 hover:border-border",
              )}
            >
              <HugeiconsIcon icon={o.icon} size={18} strokeWidth={1.5} />
              <span className="text-[11.5px]">{g.appearance[o.id]}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {g.appearance.themesHint}{" "}
          <button
            type="button"
            onClick={() => setActiveTab("themes")}
            className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground/60"
          >
            {g.appearance.themesTab}
          </button>{" "}
          {g.appearance.themesHintSuffix}
        </p>
      </div>

      <SettingGroup title={g.zoom.title}>
        <SettingRow title={g.zoom.uiZoomLevel}>
          <div className="flex w-60 items-center gap-3">
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

      <SettingGroup title={g.pathNav.title}>
        <SettingRow
          title={g.pathNav.showHiddenDirs}
          description={g.pathNav.showHiddenDirsDescription}
        >
          <Switch
            checked={showHidden}
            onCheckedChange={(v) => void setShowHidden(v)}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={g.terminal.title}>
        <FontFamilyInput
          codeValue={terminalFontFamily}
          cjkValue={terminalCjkFontFamily}
          onCodeCommit={(v) => void setTerminalFontFamily(v)}
          onCjkCommit={(v) => void setTerminalCjkFontFamily(v)}
        />
        <SettingRow
          title={g.terminal.fontSize}
          description={g.terminal.fontSizeDescription}
        >
          <Select
            value={String(terminalFontSize)}
            onValueChange={(v) => void setTerminalFontSize(Number(v))}
          >
            <SelectTrigger size="sm" className="h-8 w-28 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
        <SettingRow
          title={g.terminal.fontWeight}
          description={g.terminal.fontWeightDescription}
        >
          <Select
            value={terminalFontWeight}
            onValueChange={(v) => void setTerminalFontWeight(v)}
          >
            <SelectTrigger
              value={terminalFontWeight}
              className="h-8 w-28 text-[12px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
        <SettingRow
          title={g.terminal.letterSpacing}
          description={g.terminal.letterSpacingDescription}
        >
          <Select
            value={String(terminalLetterSpacing)}
            onValueChange={(v) => void setTerminalLetterSpacing(Number(v))}
          >
            <SelectTrigger size="sm" className="h-8 w-28 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LETTER_SPACINGS.map((v) => (
                <SelectItem key={v} value={String(v)} className="text-[12px]">
                  {v > 0 ? `+${v}` : v} px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          title={g.terminal.shell}
          description={
            shells.find((s) => s.path === terminalShell)?.integrated === false
              ? g.terminal.shellUnavailableDescription
              : wslDistros.length > 0
                ? g.terminal.shellWithWslDescription
                : g.terminal.shellDescription
          }
        >
          <Select
            value={terminalShell || SHELL_AUTO}
            onValueChange={(v) =>
              void setTerminalShell(v === SHELL_AUTO ? "" : v)
            }
          >
            <SelectTrigger
              value={terminalShell || SHELL_AUTO}
              className="h-8 w-40 text-[12px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
        {(wslDistros.length > 0 || defaultWorkspaceEnv !== "local") && (
          <SettingRow
            title={g.terminal.workspaceEnvironment}
            description={g.terminal.workspaceEnvironmentDescription}
          >
            <Select
              value={defaultWorkspaceEnv}
              onValueChange={(v) => void setDefaultWorkspaceEnv(v)}
            >
              <SelectTrigger
                value={defaultWorkspaceEnv}
                className="h-8 w-40 text-[12px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local" className="text-[12px]">
                  {g.terminal.workspaceEnvWindows}
                </SelectItem>
                {wslDistros.map((d) => (
                  <SelectItem
                    key={d.name}
                    value={`wsl:${d.name}`}
                    className="text-[12px]"
                  >
                    {g.terminal.workspaceEnvWsl}: {d.name}
                  </SelectItem>
                ))}
                {defaultWorkspaceEnv.startsWith("wsl:") &&
                  !wslDistros.some(
                    (d) => `wsl:${d.name}` === defaultWorkspaceEnv,
                  ) && (
                    <SelectItem
                      value={defaultWorkspaceEnv}
                      className="text-[12px]"
                    >
                      {defaultWorkspaceEnv.slice("wsl:".length)} (
                      {g.terminal.unavailable})
                    </SelectItem>
                  )}
              </SelectContent>
            </Select>
          </SettingRow>
        )}
        <SettingRow
          title={
            <span className="inline-flex items-center gap-1.5">
              {g.terminal.useWebgl}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="cursor-help bg-transparent p-0 text-muted-foreground/70"
                      aria-label={g.terminal.webglAria}
                    >
                      <HugeiconsIcon
                        icon={InformationCircleIcon}
                        size={13}
                        strokeWidth={1.5}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-65 text-[11px]">
                    {g.terminal.webglTooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          }
          description={g.terminal.webglDescription}
        >
          <Switch
            checked={terminalWebglEnabled}
            onCheckedChange={(v) => void setTerminalWebglEnabled(v)}
          />
        </SettingRow>
        <SettingRow
          title={g.terminal.scrollback}
          description={g.terminal.scrollbackDescription}
        >
          <Select
            value={String(terminalScrollback)}
            onValueChange={(v) => void setTerminalScrollback(Number(v))}
          >
            <SelectTrigger size="sm" className="h-8 w-36 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
        <SettingRow
          title={g.startup.restoreWindow}
          description={g.startup.restoreWindowDescription}
        >
          <Switch
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

  return (
    <SettingRow
      title={terminalMessages.fontFamily}
      description={terminalMessages.fontFamilyHint}
    >
      <div className="grid w-[360px] grid-cols-2 gap-2">
        <FontFamilyField
          label={terminalMessages.codeFontFamily}
          value={codeValue}
          placeholder={terminalMessages.codeFontFamilyPlaceholder}
          unmatchedHint={terminalMessages.fontFamilyUnmatched}
          onCommit={onCodeCommit}
        />
        <FontFamilyField
          label={terminalMessages.cjkFontFamily}
          value={cjkValue}
          placeholder={terminalMessages.cjkFontFamilyPlaceholder}
          unmatchedHint={terminalMessages.fontFamilyUnmatched}
          onCommit={onCjkCommit}
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
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  unmatchedHint: string;
  onCommit: (value: string) => void;
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

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[10.5px] text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className={cn(
          "h-8 rounded-3xl text-[12px]",
          unmatched.length > 0 && "border-destructive/60",
        )}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          if (reverted.current) {
            reverted.current = false;
            setDraft(value);
          } else if (draft !== value) {
            onCommit(draft);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            reverted.current = true;
            e.currentTarget.blur();
          }
        }}
      />
      {unmatched.length > 0 && (
        <p role="status" className="text-[10.5px] leading-tight text-destructive">
          {unmatched.join(", ")}: {unmatchedHint}
        </p>
      )}
    </div>
  );
}
