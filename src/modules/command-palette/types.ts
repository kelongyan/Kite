import type { Messages } from "@/modules/i18n";
import type { ShortcutId } from "@/modules/shortcuts";
import type { TerminalIcon } from "@hugeicons/core-free-icons";

export type PaletteIcon = typeof TerminalIcon;
export type CommandPaletteGroupKey =
  keyof Messages["mainShell"]["commandPalette"]["groups"];

export type PaletteItem = {
  id: string;
  title: string;
  groupKey: CommandPaletteGroupKey;
  group: string;
  keywords?: string[];
  icon?: PaletteIcon;
  iconUrl?: string;
  shortcutId?: ShortcutId;
  trailing?: string;
  disabledReason?: string;
  run: () => void;
};

export type PaletteMode = "commands" | "history" | "content" | "help";
