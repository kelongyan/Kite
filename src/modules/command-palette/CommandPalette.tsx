import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessages } from "@/modules/i18n";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  getBindingTokens,
  SHORTCUTS,
  type KeyBinding,
  type ShortcutId,
} from "@/modules/shortcuts";
import type { ShellChoice } from "@/modules/terminal/lib/shells";
import { listBuiltinThemes, useTheme } from "@/modules/theme";
import {
  AlertCircleIcon,
  ArrowTurnBackwardIcon,
  CommandIcon,
  ComputerTerminal02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { COMMAND_GROUPS } from "./commands";
import { mruRank, mruSnapshot, recordUse } from "./lib/mru";
import { fuzzyBest } from "./lib/fuzzy";
import type { PaletteItem } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandItems: PaletteItem[];
  /** Enumerated shells for the "new terminal" sub-page. */
  shellChoices: ShellChoice[];
  onNewTerminalWithShell: (shell: ShellChoice) => void;
};

const SHORTCUTS_BY_ID = new Map(SHORTCUTS.map((s) => [s.id, s]));
const THEME_PREVIEW_DELAY_MS = 140;

export function CommandPalette({
  open,
  onOpenChange,
  commandItems,
  shellChoices,
  onNewTerminalWithShell,
}: Props) {
  const messages = useMessages().mainShell.commandPalette;
  const [query, setQuery] = useState("");
  const [value, setValue] = useState("");
  const [page, setPage] = useState<"root" | "themes" | "shells">("root");
  const userShortcuts = usePreferencesStore((s) => s.shortcuts);
  const { themeId, customThemes, setThemeId, previewThemeId } = useTheme();

  const inThemes = page === "themes";
  const inShells = page === "shells";
  const themeFilter = inThemes ? query.trim() : "";
  const shellFilter = inShells ? query.trim() : "";

  const mru = useMemo(() => (open ? mruSnapshot() : {}), [open]);

  const rankedCommands = useMemo(() => {
    if (inThemes || inShells) return [];
    return rankCommands(commandItems, query.trim(), mru);
  }, [commandItems, query, inThemes, inShells, mru]);

  const themes = useMemo(() => {
    if (!inThemes) return [];
    const all = [...listBuiltinThemes(), ...customThemes];
    const q = themeFilter.toLowerCase();
    if (!q) return all;
    return all
      .map((t) => ({ t, s: fuzzyBest(q, [t.name, t.id]) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => (b.s ?? 0) - (a.s ?? 0))
      .map((x) => x.t);
  }, [inThemes, themeFilter, customThemes]);

  const shells = useMemo(() => {
    if (!inShells) return [];
    const q = shellFilter.toLowerCase();
    if (!q) return shellChoices;
    return shellChoices
      .map((t) => ({ t, s: fuzzyBest(q, [t.name, t.path]) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => (b.s ?? 0) - (a.s ?? 0))
      .map((x) => x.t);
  }, [inShells, shellFilter, shellChoices]);

  const resetPalette = useCallback(() => {
    setQuery("");
    setValue("");
    setPage("root");
    previewThemeId(null);
  }, [previewThemeId]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLInputElement>('[data-slot="command-input"]')
        ?.focus();
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPage("root");
    focusInput();
  }, [open, focusInput]);

  useEffect(() => {
    if (!inThemes || !value.startsWith("theme:")) return;
    const id = value.slice("theme:".length);
    if (id === "back") return;
    const handle = window.setTimeout(
      () => previewThemeId(id),
      THEME_PREVIEW_DELAY_MS,
    );
    return () => window.clearTimeout(handle);
  }, [value, inThemes, previewThemeId]);

  const runAfterClose = useCallback(
    (fn: () => void) => {
      handleOpenChange(false);
      window.setTimeout(fn, 0);
    },
    [handleOpenChange],
  );

  const enterThemes = useCallback(() => {
    setPage("themes");
    setQuery("");
    setValue("");
    focusInput();
  }, [focusInput]);

  const enterShells = useCallback(() => {
    setPage("shells");
    setQuery("");
    setValue("");
    focusInput();
  }, [focusInput]);

  const exitSubPage = useCallback(() => {
    previewThemeId(null);
    setPage("root");
    setQuery("");
    setValue("");
    focusInput();
  }, [previewThemeId, focusInput]);

  const runCommand = useCallback(
    (item: PaletteItem) => {
      if (item.disabledReason) return;
      if (item.id === "theme.pick") return enterThemes();
      if (item.id === "tab.newWithShell") return enterShells();
      recordUse(item.id);
      runAfterClose(item.run);
    },
    [enterThemes, enterShells, runAfterClose],
  );

  const commitTheme = useCallback(
    (id: string) => {
      setThemeId(id);
      handleOpenChange(false);
    },
    [setThemeId, handleOpenChange],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!inThemes && !inShells) return;
      if (e.key === "Backspace" && query.length === 0) {
        e.preventDefault();
        e.stopPropagation();
        exitSubPage();
      }
    },
    [inThemes, inShells, query, exitSubPage],
  );

  const onEscapeKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!inThemes && !inShells) return;
      event.preventDefault();
      exitSubPage();
    },
    [inThemes, inShells, exitSubPage],
  );

  const placeholder = inThemes
    ? messages.placeholders.themes
    : inShells
      ? messages.placeholders.shells
      : messages.placeholders.commands;

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      onCloseAutoFocus={resetPalette}
      onEscapeKeyDown={onEscapeKeyDown}
      title={messages.title}
      description={messages.description}
      className="top-1/2 w-[min(500px,calc(100vw-32px))] max-w-none -translate-y-1/2 sm:max-w-none"
    >
      <Command
        shouldFilter={false}
        loop
        value={value}
        onValueChange={setValue}
        onKeyDown={onKeyDown}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={placeholder}
          autoFocus
        />
        <ScrollArea className="max-h-[420px]">
          <CommandList
            key={page}
            className="kite-command-page-in max-h-none overflow-visible pr-3"
          >
            {inShells ? (
              <CommandGroup heading={messages.headings.shells}>
                <CommandItem
                  value="shell:back"
                  onSelect={exitSubPage}
                  className="text-[12.5px]"
                >
                  <HugeiconsIcon
                    icon={ArrowTurnBackwardIcon}
                    size={14}
                    strokeWidth={1.75}
                  />
                  <span>{messages.back}</span>
                </CommandItem>
                {shells.map((shell) => (
                  <CommandItem
                    key={shell.path}
                    value={`shell:${shell.path}`}
                    onSelect={() =>
                      runAfterClose(() => onNewTerminalWithShell(shell))
                    }
                    className="text-[12.5px]"
                  >
                    <HugeiconsIcon
                      icon={ComputerTerminal02Icon}
                      size={14}
                      strokeWidth={1.75}
                      className="text-muted-foreground"
                    />
                    <span className="truncate">{shell.name}</span>
                  </CommandItem>
                ))}
                {shells.length === 0 ? (
                  <StatusItem label={messages.status.noShells} />
                ) : null}
              </CommandGroup>
            ) : inThemes ? (
              <CommandGroup heading={messages.headings.themes}>
                <CommandItem
                  value="theme:back"
                  onSelect={exitSubPage}
                  className="text-[12.5px]"
                >
                  <HugeiconsIcon
                    icon={ArrowTurnBackwardIcon}
                    size={14}
                    strokeWidth={1.75}
                  />
                  <span>{messages.back}</span>
                </CommandItem>
                {themes.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`theme:${t.id}`}
                    onSelect={() => commitTheme(t.id)}
                    className="text-[12.5px]"
                  >
                    <span className="truncate">{t.name}</span>
                    {t.id === themeId ? (
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        size={14}
                        strokeWidth={2}
                        className="ml-auto text-muted-foreground"
                      />
                    ) : null}
                  </CommandItem>
                ))}
                {themes.length === 0 ? (
                  <StatusItem label={messages.status.noThemes} />
                ) : null}
              </CommandGroup>
            ) : rankedCommands.length === 0 ? (
              <EmptyHint />
            ) : (
              COMMAND_GROUPS.map((group) => {
                const rows = rankedCommands.filter((a) => a.groupKey === group);
                if (rows.length === 0) return null;
                return (
                  <CommandGroup key={group} heading={messages.groups[group]}>
                    {rows.map((item) => (
                      <ActionItem
                        key={item.id}
                        item={item}
                        shortcutLabel={formatShortcut(
                          item.shortcutId,
                          userShortcuts,
                        )}
                        onRun={() => runCommand(item)}
                      />
                    ))}
                  </CommandGroup>
                );
              })
            )}
          </CommandList>
        </ScrollArea>
      </Command>
    </CommandDialog>
  );
}

function rankCommands(
  items: PaletteItem[],
  term: string,
  mru: Record<string, number>,
): PaletteItem[] {
  if (!term) {
    return [...items].sort((a, b) => mruRank(mru, b.id) - mruRank(mru, a.id));
  }
  const scored: { item: PaletteItem; s: number }[] = [];
  for (const item of items) {
    const s = fuzzyBest(term, [
      item.title,
      item.group,
      ...(item.keywords ?? []),
    ]);
    if (s !== null) scored.push({ item, s });
  }
  scored.sort(
    (a, b) => b.s - a.s || mruRank(mru, b.item.id) - mruRank(mru, a.item.id),
  );
  return scored.map((x) => x.item);
}

function ActionItem({
  item,
  shortcutLabel,
  onRun,
}: {
  item: PaletteItem;
  shortcutLabel: string | null;
  onRun: () => void;
}) {
  const rightLabel = item.disabledReason ?? shortcutLabel;
  return (
    <CommandItem
      value={`cmd:${item.id}`}
      disabled={!!item.disabledReason}
      onSelect={onRun}
      className="text-[12.5px]"
    >
      {item.icon ? (
        <HugeiconsIcon
          icon={item.icon}
          size={14}
          strokeWidth={1.75}
          className="text-muted-foreground"
        />
      ) : null}
      <span className="truncate">{item.title}</span>
      {rightLabel ? (
        <CommandShortcut
          className={item.disabledReason ? "normal-case tracking-normal" : ""}
        >
          {rightLabel}
        </CommandShortcut>
      ) : null}
    </CommandItem>
  );
}

function StatusItem({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "error";
}) {
  return (
    <CommandItem
      value={`status:${label}`}
      disabled
      className="text-[12.5px] font-normal"
    >
      {tone === "error" ? (
        <HugeiconsIcon
          icon={AlertCircleIcon}
          size={14}
          strokeWidth={1.75}
          className="text-destructive"
        />
      ) : null}
      <span
        className={tone === "error" ? "text-destructive" : "text-muted-foreground"}
      >
        {label}
      </span>
    </CommandItem>
  );
}

function EmptyHint() {
  const messages = useMessages().mainShell.commandPalette.status;
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
      <HugeiconsIcon icon={CommandIcon} size={18} strokeWidth={1.5} />
      <span>{messages.noCommandsFound}</span>
    </div>
  );
}

function formatShortcut(
  shortcutId: ShortcutId | undefined,
  userShortcuts: Record<ShortcutId, KeyBinding[]>,
): string | null {
  if (!shortcutId) return null;
  const shortcut = SHORTCUTS_BY_ID.get(shortcutId);
  const bindings = userShortcuts[shortcutId] ?? shortcut?.defaultBindings;
  const tokens = getBindingTokens(bindings?.[0]);
  return tokens.length ? tokens.join(" ") : null;
}
