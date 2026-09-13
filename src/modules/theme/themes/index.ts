import { DEFAULT_THEME_ID, type Theme } from "../types";
import { catppuccin } from "./catppuccin";
import { claude } from "./claude";
import { dracula } from "./dracula";
import { everforest } from "./everforest";
import { github } from "./github";
import { gruvbox } from "./gruvbox";
import { kanagawa } from "./kanagawa";
import { kiteDefault } from "./kite-default";
import { monokai } from "./monokai";
import { nightOwl } from "./night-owl";
import { nord } from "./nord";
import { oneDark } from "./one-dark";
import { oneLight } from "./one-light";
import { rosePine } from "./rose-pine";
import { solarized } from "./solarized";
import { tokyoNight } from "./tokyo-night";

const BUILTIN: Theme[] = [
  kiteDefault,
  claude,
  dracula,
  nord,
  catppuccin,
  tokyoNight,
  oneDark,
  oneLight,
  github,
  gruvbox,
  rosePine,
  everforest,
  kanagawa,
  monokai,
  nightOwl,
  solarized,
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
