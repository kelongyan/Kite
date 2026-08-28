import type { Tab } from "./useTabs";

export const TERMINAL_DEFAULT_TITLE = "Terminal";
export const TERMINAL_HOME_LABEL = "Home";

export type TabLabelOptions = {
  home?: string | null;
  homeResolved?: boolean;
};

/**
 * The label shown on a tab. Terminal tabs prefer a user-set custom name, then
 * fall back to the last segment of the cwd. While home is still resolving,
 * terminals stay on the neutral default so startup never flashes a real folder
 * name before the workspace is ready.
 */
export function labelFor(t: Tab, options: TabLabelOptions = {}): string {
  if (t.customTitle) return t.customTitle;
  if (!t.cwd || options.homeResolved === false) {
    return terminalFallbackTitle(t.title);
  }
  if (options.home && isSameDisplayPath(t.cwd, options.home)) {
    return TERMINAL_HOME_LABEL;
  }
  const parts = t.cwd.split(/[\\/]/).filter(Boolean);
  const normalized = normalizePathForCompare(t.cwd);
  if (isRootPath(normalized)) return normalized === "/" ? "/" : `${normalized}/`;
  if (parts.length) return parts[parts.length - 1];
  return terminalFallbackTitle(t.title);
}

function terminalFallbackTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed && trimmed.toLowerCase() !== "shell"
    ? trimmed
    : TERMINAL_DEFAULT_TITLE;
}

export function isTerminalLabelResolving(
  t: Tab,
  options: TabLabelOptions = {},
): boolean {
  return t.kind === "terminal" && !t.customTitle && (!t.cwd || options.homeResolved === false);
}

export function isSameDisplayPath(a: string, b: string): boolean {
  const left = normalizePathForCompare(a);
  const right = normalizePathForCompare(b);
  const caseInsensitive = /^[A-Za-z]:/.test(left) || /^[A-Za-z]:/.test(right);
  return caseInsensitive
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function normalizePathForCompare(path: string): string {
  let normalized = path.trim().replace(/\\/g, "/");
  if (/^\/[A-Za-z]:/.test(normalized)) normalized = normalized.slice(1);
  normalized = normalized.replace(/\/+$/, "");
  if (!normalized && path.trim().startsWith("/")) return "/";
  return normalized;
}

function isRootPath(path: string): boolean {
  return path === "/" || /^[A-Za-z]:$/.test(path);
}
