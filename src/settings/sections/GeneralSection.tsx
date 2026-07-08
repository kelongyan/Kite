import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  APP_LANGUAGES,
  LANGUAGE_LABELS,
  useMessages,
  type AppLanguage,
} from "@/modules/i18n";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { ThemePref } from "@/modules/settings/store";
import {
  setAgentNotifications,
  setAppLanguage,
  setAutostart,
  setDefaultWorkspaceEnv,
  setEditorAutoSave,
  setEditorAutoSaveDelay,
  setEditorWordWrap,
  setExplorerGitDecorations,
  setRestoreWindowState,
  setShowHidden,
  setTerminalCursorAnimation,
  setTerminalCursorShape,
  setTerminalCursorWidth,
  setTerminalFontFamily,
  setTerminalFontSize,
  setTerminalFontWeight,
  setTerminalLetterSpacing,
  setTerminalScrollback,
  setTerminalShell,
  setTerminalWebglEnabled,
  setVimMode,
  setZoomLevel,
  TERMINAL_FONT_SIZES,
  TERMINAL_SCROLLBACK_PRESETS,
} from "@/modules/settings/store";
import {
  TERMINAL_CURSOR_ANIMATIONS,
  TERMINAL_CURSOR_SHAPES,
  TERMINAL_CURSOR_WIDTHS,
  type TerminalCursorAnimation,
  type TerminalCursorShape,
  type TerminalCursorWidth,
} from "@/modules/terminal/lib/cursorStyle";
import { useTheme } from "@/modules/theme";
import {
  ComputerIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useEffect, useId, useState } from "react";
import { SectionHeader } from "../components/SectionHeader";
import { SettingRow } from "../components/SettingRow";
import { TerminalCursorPreview } from "../components/TerminalCursorPreview";

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

const TERMINAL_CURSOR_SHAPE_LABEL_KEYS = {
  bar: "bar",
  block: "block",
  underline: "underline",
} as const satisfies Record<TerminalCursorShape, keyof CursorShapeLabels>;

const TERMINAL_CURSOR_ANIMATION_LABEL_KEYS = {
  steady: "steady",
  blink: "blink",
  smooth: "smooth",
  expand: "expand",
} as const satisfies Record<
  TerminalCursorAnimation,
  keyof CursorAnimationLabels
>;

type CursorShapeLabels = {
  bar: string;
  block: string;
  underline: string;
};

type CursorAnimationLabels = {
  steady: string;
  blink: string;
  smooth: string;
  expand: string;
};

const LETTER_SPACINGS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;

type ShellInfo = { name: string; path: string; integrated: boolean };
const SHELL_AUTO = "auto";
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.05;
const AUTO_SAVE_STEP = 100;
const AUTO_SAVE_MIN = 100;
const AUTO_SAVE_MAX = 60000;

export function GeneralSection() {
  const messages = useMessages();
  const g = messages.settings.general;
  const { mode, setMode } = useTheme();
  const cursorShapeLabelId = useId();
  const cursorAnimationLabelId = useId();
  const cursorAnimationDescriptionId = useId();
  const cursorWidthLabelId = useId();

  const appLanguage = usePreferencesStore((s) => s.appLanguage);
  const autostart = usePreferencesStore((s) => s.autostart);
  const restoreWindowState = usePreferencesStore((s) => s.restoreWindowState);
  const vimMode = usePreferencesStore((s) => s.vimMode);
  const editorWordWrap = usePreferencesStore((s) => s.editorWordWrap);
  const editorAutoSave = usePreferencesStore((s) => s.editorAutoSave);
  const editorAutoSaveDelay = usePreferencesStore((s) => s.editorAutoSaveDelay);
  const showHidden = usePreferencesStore((s) => s.showHidden);
  const explorerGitDecorations = usePreferencesStore(
    (s) => s.explorerGitDecorations,
  );
  const terminalWebglEnabled = usePreferencesStore(
    (s) => s.terminalWebglEnabled,
  );
  const terminalCursorShape = usePreferencesStore((s) => s.terminalCursorShape);
  const terminalCursorAnimation = usePreferencesStore(
    (s) => s.terminalCursorAnimation,
  );
  const terminalCursorWidth = usePreferencesStore((s) => s.terminalCursorWidth);
  const terminalFontFamily = usePreferencesStore((s) => s.terminalFontFamily);
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
  const agentNotifications = usePreferencesStore((s) => s.agentNotifications);
  const cursorShapeLabel = (shape: TerminalCursorShape) =>
    g.terminal.cursor.shapes[TERMINAL_CURSOR_SHAPE_LABEL_KEYS[shape]];
  const cursorAnimationLabel = (animation: TerminalCursorAnimation) =>
    g.terminal.cursor.animations[
      TERMINAL_CURSOR_ANIMATION_LABEL_KEYS[animation]
    ];
  const cursorAnimationDescription =
    g.terminal.cursor.animationDescriptions[
      TERMINAL_CURSOR_ANIMATION_LABEL_KEYS[terminalCursorAnimation]
    ];

  useEffect(() => {
    let alive = true;
    void isEnabled()
      .then((on) => {
        if (!alive) return;
        if (on !== usePreferencesStore.getState().autostart) {
          void setAutostart(on);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    void invoke<ShellInfo[]>("pty_list_shells")
      .then(setShells)
      .catch(() => {});
    void invoke<{ name: string }[]>("wsl_list_distros")
      .then(setWslDistros)
      .catch(() => {});
  }, []);

  const onToggleAutostart = async (next: boolean) => {
    try {
      if (next) await enable();
      else await disable();
      await setAutostart(next);
    } catch (e) {
      console.error("autostart toggle failed", e);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title={g.title} description={g.description} />

      <div className="flex flex-col gap-2">
        <Label>{g.appearance.title}</Label>
        <div className="grid grid-cols-3 gap-2">
          {APPEARANCE.map((o) => (
            <button
              key={o.id}
              type="button"
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
          <strong className="font-medium text-foreground">
            {g.appearance.themesTab}
          </strong>{" "}
          {g.appearance.themesHintSuffix}
        </p>
      </div>

      <SettingRow title={g.language.title} description={g.language.description}>
        <Select
          value={appLanguage}
          onValueChange={(v) => void setAppLanguage(v as AppLanguage)}
        >
          <SelectTrigger value={appLanguage} className="h-8 w-36 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APP_LANGUAGES.map((language) => (
              <SelectItem
                key={language}
                value={language}
                className="text-[12px]"
              >
                {LANGUAGE_LABELS[language]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <div className="flex flex-col gap-2">
        <Label>{g.zoom.title}</Label>
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-muted-foreground">
              {g.zoom.uiZoomLevel}
            </span>
            <span className="tabular-nums text-[11px] text-muted-foreground">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>
          <Slider
            value={[zoomLevel]}
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={ZOOM_STEP}
            onValueChange={(v) => void setZoomLevel(v[0] ?? 1)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{g.editor.title}</Label>
        <SettingRow
          title={g.editor.vimMode}
          description={g.editor.vimModeDescription}
        >
          <Switch
            checked={vimMode}
            onCheckedChange={(v) => void setVimMode(v)}
          />
        </SettingRow>
        <SettingRow
          title={g.editor.wordWrap}
          description={g.editor.wordWrapDescription}
        >
          <Switch
            checked={editorWordWrap}
            onCheckedChange={(v) => void setEditorWordWrap(v)}
          />
        </SettingRow>
        <SettingRow
          title={g.editor.autoSave}
          description={g.editor.autoSaveDescription}
        >
          <Switch
            checked={editorAutoSave}
            onCheckedChange={(v) => void setEditorAutoSave(v)}
          />
        </SettingRow>
        {editorAutoSave && (
          <AutoSaveDelayInput
            value={editorAutoSaveDelay}
            onChange={(v) => void setEditorAutoSaveDelay(v)}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{g.explorer.title}</Label>
        <SettingRow
          title={g.explorer.showHiddenFiles}
          description={g.explorer.showHiddenFilesDescription}
        >
          <Switch
            checked={showHidden}
            onCheckedChange={(v) => void setShowHidden(v)}
          />
        </SettingRow>
        <SettingRow
          title={g.explorer.gitDecorations}
          description={g.explorer.gitDecorationsDescription}
        >
          <Switch
            checked={explorerGitDecorations}
            onCheckedChange={(v) => void setExplorerGitDecorations(v)}
          />
        </SettingRow>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{g.terminal.title}</Label>
        <SettingRow
          title={
            <span className="inline-flex items-center gap-1.5">
              {g.terminal.useWebgl}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="cursor-help bg-transparent p-0 text-[11px] text-muted-foreground/70 leading-none"
                      aria-label={g.terminal.webglAria}
                    >
                      ⓘ
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
          title={g.terminal.cursor.title}
          description={g.terminal.cursor.description}
          className="items-stretch"
        >
          <div className="flex w-[360px] max-w-full flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                id={cursorShapeLabelId}
                className="text-[11px] text-muted-foreground"
              >
                {g.terminal.cursor.shape}
              </span>
              <CursorToggleGroup
                value={terminalCursorShape}
                ariaLabelledBy={cursorShapeLabelId}
                onChange={(value) =>
                  void setTerminalCursorShape(value as TerminalCursorShape)
                }
              >
                {TERMINAL_CURSOR_SHAPES.map((shape) => (
                  <ToggleGroupItem
                    key={shape}
                    value={shape}
                    size="sm"
                    className="h-7 px-2.5 text-[11px]"
                    aria-label={`${g.terminal.cursor.shape}: ${cursorShapeLabel(
                      shape,
                    )}`}
                  >
                    {cursorShapeLabel(shape)}
                  </ToggleGroupItem>
                ))}
              </CursorToggleGroup>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                id={cursorAnimationLabelId}
                className="text-[11px] text-muted-foreground"
              >
                {g.terminal.cursor.animation}
              </span>
              <CursorToggleGroup
                value={terminalCursorAnimation}
                ariaLabelledBy={cursorAnimationLabelId}
                ariaDescribedBy={cursorAnimationDescriptionId}
                onChange={(value) =>
                  void setTerminalCursorAnimation(
                    value as TerminalCursorAnimation,
                  )
                }
              >
                {TERMINAL_CURSOR_ANIMATIONS.map((animation) => (
                  <ToggleGroupItem
                    key={animation}
                    value={animation}
                    size="sm"
                    className="h-7 px-2.5 text-[11px]"
                    aria-label={`${cursorAnimationLabel(animation)}. ${
                      g.terminal.cursor.animationDescriptions[
                        TERMINAL_CURSOR_ANIMATION_LABEL_KEYS[animation]
                      ]
                    }`}
                  >
                    {cursorAnimationLabel(animation)}
                  </ToggleGroupItem>
                ))}
              </CursorToggleGroup>
              <span id={cursorAnimationDescriptionId} className="sr-only">
                {cursorAnimationDescription}
              </span>
            </div>
            {terminalCursorShape === "bar" && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  id={cursorWidthLabelId}
                  className="text-[11px] text-muted-foreground"
                >
                  {g.terminal.cursor.width}
                </span>
                <Select
                  value={String(terminalCursorWidth)}
                  onValueChange={(v) =>
                    void setTerminalCursorWidth(
                      Number(v) as TerminalCursorWidth,
                    )
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="h-7 w-24 text-[11px]"
                    aria-labelledby={cursorWidthLabelId}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMINAL_CURSOR_WIDTHS.map((width) => (
                      <SelectItem
                        key={width}
                        value={String(width)}
                        className="text-[12px]"
                      >
                        {width} px
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <TerminalCursorPreview
              shape={terminalCursorShape}
              shapeLabel={cursorShapeLabel(terminalCursorShape)}
              animation={terminalCursorAnimation}
              animationLabel={cursorAnimationLabel(terminalCursorAnimation)}
              width={terminalCursorWidth}
              previewLabel={g.terminal.cursor.preview}
            />
          </div>
        </SettingRow>
        <FontFamilyInput
          value={terminalFontFamily}
          onCommit={(v) => void setTerminalFontFamily(v)}
        />
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
                  Windows
                </SelectItem>
                {wslDistros.map((d) => (
                  <SelectItem
                    key={d.name}
                    value={`wsl:${d.name}`}
                    className="text-[12px]"
                  >
                    WSL: {d.name}
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
                  {g.terminal.scrollbackLines(lines.toLocaleString())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{g.agents.title}</Label>
        <SettingRow
          title={g.agents.notifications}
          description={g.agents.notificationsDescription}
        >
          <Switch
            checked={agentNotifications}
            onCheckedChange={(v) => void setAgentNotifications(v)}
          />
        </SettingRow>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{g.startup.title}</Label>
        <div className="flex flex-col gap-2">
          <SettingRow
            title={g.startup.launchAtLogin}
            description={g.startup.launchAtLoginDescription}
          >
            <Switch
              checked={autostart}
              onCheckedChange={(v) => void onToggleAutostart(v)}
            />
          </SettingRow>
          <SettingRow
            title={g.startup.restoreWindow}
            description={g.startup.restoreWindowDescription}
          >
            <Switch
              checked={restoreWindowState}
              onCheckedChange={(v) => void setRestoreWindowState(v)}
            />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium tracking-tight text-muted-foreground">
      {children}
    </span>
  );
}

function CursorToggleGroup({
  value,
  ariaDescribedBy,
  ariaLabelledBy,
  onChange,
  children,
}: {
  value: string;
  ariaDescribedBy?: string;
  ariaLabelledBy: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      variant="outline"
      size="sm"
      spacing={0}
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      className="rounded-md [&_[data-slot=toggle-group-item]:first-child]:rounded-l-md [&_[data-slot=toggle-group-item]:last-child]:rounded-r-md"
    >
      {children}
    </ToggleGroup>
  );
}

function FontFamilyInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const messages = useMessages();
  const terminalMessages = messages.settings.general.terminal;
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const next = draft.trim();
    if (next !== draft) setDraft(next);
    if (next !== value) onCommit(next);
  };

  return (
    <SettingRow title={terminalMessages.fontFamily}>
      <div className="flex flex-col gap-1.5">
        <input
          type="text"
          value={draft}
          placeholder={terminalMessages.fontFamilyPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-8 w-[360px] rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-foreground/40"
        />
      </div>
    </SettingRow>
  );
}

function AutoSaveDelayInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const messages = useMessages();
  const editorMessages = messages.settings.general.editor;
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(
      AUTO_SAVE_MAX,
      Math.max(AUTO_SAVE_MIN, Math.round(n)),
    );
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <SettingRow
      title={editorMessages.autoSaveDelay}
      description={editorMessages.autoSaveDelayDescription}
    >
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={AUTO_SAVE_MIN}
          max={AUTO_SAVE_MAX}
          step={AUTO_SAVE_STEP}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="h-8 w-20 rounded-md border border-border bg-background px-2.5 text-right text-[12px] md:text-[12px] tabular-nums outline-none focus:border-foreground/40 focus-visible:ring-0 focus-visible:border-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-[11px] text-muted-foreground">ms</span>
      </div>
    </SettingRow>
  );
}
