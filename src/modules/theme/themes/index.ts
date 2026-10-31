import { DEFAULT_THEME_ID, type Theme } from "../types";
import { kiteDefault } from "./kite-default";
import { abyss } from "./abyss";
import { alabaster } from "./alabaster";
import { amethyst } from "./amethyst";
import { anthracite } from "./anthracite";
import { arctic } from "./arctic";
import { aurora } from "./aurora";
import { auroraDay } from "./aurora-day";
import { basalt } from "./basalt";
import { birch } from "./birch";
import { canyon } from "./canyon";
import { catppuccin } from "./catppuccin";
import { cavern } from "./cavern";
import { celestial } from "./celestial";
import { cirrus } from "./cirrus";
import { copper } from "./copper";
import { coral } from "./coral";
import { cosmos } from "./cosmos";
import { cyberpunk } from "./cyberpunk";
import { dark } from "./dark";
import { dawn } from "./dawn";
import { dracula } from "./dracula";
import { dunes } from "./dunes";
import { eclipse } from "./eclipse";
import { ember } from "./ember";
import { equinox } from "./equinox";
import { eucalyptus } from "./eucalyptus";
import { forest } from "./forest";
import { frost } from "./frost";
import { github } from "./github";
import { glacier } from "./glacier";
import { graphite } from "./graphite";
import { gruvbox } from "./gruvbox";
import { haze } from "./haze";
import { honeycomb } from "./honeycomb";
import { lagoon } from "./lagoon";
import { lavender } from "./lavender";
import { light } from "./light";
import { limestone } from "./limestone";
import { lunar } from "./lunar";
import { mahogany } from "./mahogany";
import { marble } from "./marble";
import { meadow } from "./meadow";
import { midnight } from "./midnight";
import { mint } from "./mint";
import { monochrome } from "./monochrome";
import { monokai } from "./monokai";
import { nebula } from "./nebula";
import { neonNoir } from "./neon-noir";
import { nord } from "./nord";
import { obsidian } from "./obsidian";
import { ocean } from "./ocean";
import { one } from "./one";
import { onyx } from "./onyx";
import { opal } from "./opal";
import { orchard } from "./orchard";
import { paper } from "./paper";
import { pearl } from "./pearl";
import { poimandres } from "./poimandres";
import { porcelain } from "./porcelain";
import { prism } from "./prism";
import { quartz } from "./quartz";
import { rainforest } from "./rainforest";
import { reef } from "./reef";
import { retro } from "./retro";
import { rosePine } from "./rose-pine";
import { sakura } from "./sakura";
import { sand } from "./sand";
import { sandstone } from "./sandstone";
import { savanna } from "./savanna";
import { slate } from "./slate";
import { solarized } from "./solarized";
import { soleil } from "./soleil";
import { solstice } from "./solstice";
import { starfall } from "./starfall";
import { sunset } from "./sunset";
import { swamp } from "./swamp";
import { synthwave } from "./synthwave";
import { taiga } from "./taiga";
import { terminal } from "./terminal";
import { titanium } from "./titanium";
import { tokyoNight } from "./tokyo-night";
import { tundra } from "./tundra";
import { twilight } from "./twilight";
import { volcanic } from "./volcanic";
import { wetland } from "./wetland";
import { zenith } from "./zenith";

const BUILTIN: Theme[] = [
  kiteDefault,
  abyss,
  alabaster,
  amethyst,
  anthracite,
  arctic,
  aurora,
  auroraDay,
  basalt,
  birch,
  canyon,
  catppuccin,
  cavern,
  celestial,
  cirrus,
  copper,
  coral,
  cosmos,
  cyberpunk,
  dark,
  dawn,
  dracula,
  dunes,
  eclipse,
  ember,
  equinox,
  eucalyptus,
  forest,
  frost,
  github,
  glacier,
  graphite,
  gruvbox,
  haze,
  honeycomb,
  lagoon,
  lavender,
  light,
  limestone,
  lunar,
  mahogany,
  marble,
  meadow,
  midnight,
  mint,
  monochrome,
  monokai,
  nebula,
  neonNoir,
  nord,
  obsidian,
  ocean,
  one,
  onyx,
  opal,
  orchard,
  paper,
  pearl,
  poimandres,
  porcelain,
  prism,
  quartz,
  rainforest,
  reef,
  retro,
  rosePine,
  sakura,
  sand,
  sandstone,
  savanna,
  slate,
  solarized,
  soleil,
  solstice,
  starfall,
  sunset,
  swamp,
  synthwave,
  taiga,
  terminal,
  titanium,
  tokyoNight,
  tundra,
  twilight,
  volcanic,
  wetland,
  zenith,
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
