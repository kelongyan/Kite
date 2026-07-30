import type { Messages } from "@/modules/i18n";
import type { ShortcutId } from "@/modules/shortcuts";
import type { TerminalIcon } from "@hugeicons/core-free-icons";

type PaletteIcon = typeof TerminalIcon;
type CommandPaletteGroupKey =
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
