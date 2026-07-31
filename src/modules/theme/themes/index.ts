import { DEFAULT_THEME_ID, type Theme } from "../types";
import { catppuccin } from "./catppuccin";
import { claude } from "./claude";
import { dracula } from "./dracula";
import { nord } from "./nord";
import { kiteDefault } from "./kite-default";
import { tokyoNight } from "./tokyo-night";

const BUILTIN: Theme[] = [
  kiteDefault,
  claude,
  dracula,
  nord,
  catppuccin,
  tokyoNight,
];

const BY_ID = new Map<string, Theme>(BUILTIN.map((t) => [t.id, t]));

export function listBuiltinThemes(): Theme[] {
  return BUILTIN;
}

export function getBuiltinTheme(id: string): Theme | undefined {
  return BY_ID.get(id);
}

export function getDefaultTheme(): Theme {
  return BY_ID.get(DEFAULT_THEME_ID) ?? BUILTIN[0];
}
