import catppuccinIcons from "@iconify-json/catppuccin/icons.json";

type IconifySet = {
  icons: Record<string, { body: string }>;
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
};

const cat = catppuccinIcons as unknown as IconifySet;
const CAT_W = cat.width ?? 16;
const CAT_H = cat.height ?? 16;

const DEFAULT_FILE = "file";
const DEFAULT_FOLDER = "folder";
const DEFAULT_FOLDER_OPEN = "folder-open";

const FILE_ICONS_BY_NAME: Record<string, string> = {
  ".env": "env",
  ".gitignore": "git",
  "cargo.lock": "rust",
  "cargo.toml": "rust",
  "package.json": "nodejs",
  "pnpm-lock.yaml": "pnpm",
  "tauri.conf.json": "tauri",
  "vite.config.ts": "vite",
};

const FILE_ICONS_BY_EXT: Record<string, string> = {
  css: "css",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "javascript-react",
  lock: "lock",
  md: "markdown",
  mjs: "javascript",
  pdf: "pdf",
  png: "image",
  rs: "rust",
  svg: "svg",
  toml: "toml",
  ts: "typescript",
  tsx: "typescript-react",
  txt: "text",
  yaml: "yaml",
  yml: "yaml",
};

const FOLDER_ICONS_BY_NAME: Record<string, string> = {
  ".git": "folder-git",
  ".github": "folder-github",
  "node_modules": "folder-node",
  dist: "folder-dist",
  docs: "folder-docs",
  public: "folder-public",
  scripts: "folder-script",
  src: "folder-src",
  target: "folder-target",
  tests: "folder-test",
};

const dataUrlCache = new Map<string, string>();

function catBody(iconName: string): string | null {
  const direct = cat.icons[iconName];
  if (direct) return direct.body;
  const alias = cat.aliases?.[iconName];
  if (alias) {
    const parent = cat.icons[alias.parent];
    if (parent) return parent.body;
  }
  return null;
}

function buildDataUrl(iconName: string): string | null {
  const cached = dataUrlCache.get(iconName);
  if (cached !== undefined) return cached || null;
  const body = catBody(iconName);
  if (!body) {
    dataUrlCache.set(iconName, "");
    return null;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CAT_W} ${CAT_H}">${body}</svg>`;
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  dataUrlCache.set(iconName, url);
  return url;
}

function extOf(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot <= 0 || dot === lower.length - 1) return "";
  return lower.slice(dot + 1);
}

export function fileIconUrl(name: string): string {
  const lower = name.toLowerCase();
  const byName = FILE_ICONS_BY_NAME[lower];
  if (byName) {
    const url = buildDataUrl(byName);
    if (url) return url;
  }

  const byExt = FILE_ICONS_BY_EXT[extOf(lower)];
  if (byExt) {
    const url = buildDataUrl(byExt);
    if (url) return url;
  }

  return buildDataUrl(DEFAULT_FILE) ?? "";
}

export function folderIconUrl(name: string, expanded: boolean): string {
  const lower = name.toLowerCase();
  const mapped = FOLDER_ICONS_BY_NAME[lower];
  if (mapped) {
    const target = expanded ? `${mapped}-open` : mapped;
    const url = buildDataUrl(target);
    if (url) return url;
  }

  return buildDataUrl(expanded ? DEFAULT_FOLDER_OPEN : DEFAULT_FOLDER) ?? "";
}
