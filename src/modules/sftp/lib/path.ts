export type BreadcrumbSegment = {
  label: string;
  path: string;
};

export type NavigationState = {
  current: string;
  back: string[];
};

export function joinRemotePath(parent: string, name: string): string {
  const cleanParent = parent === "/" ? "" : parent.replace(/\/+$/, "");
  const cleanName = name.replace(/^\/+/, "");
  return `${cleanParent}/${cleanName}`;
}

export function joinLocalPath(parent: string, name: string): string {
  const sep = parent.includes("\\") ? "\\" : "/";
  const cleanParent = parent.replace(/[\\/]+$/, "");
  return `${cleanParent}${sep}${name}`;
}

export function splitRemotePath(path: string): BreadcrumbSegment[] {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return [{ label: "/", path: "/" }];
  const parts = normalized.split("/").filter(Boolean);
  const segments: BreadcrumbSegment[] = [{ label: "/", path: "/" }];
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    segments.push({ label: part, path: current });
  }
  return segments;
}

export function splitLocalPath(path: string): BreadcrumbSegment[] {
  const usesBackslash = path.includes("\\");
  const sep = usesBackslash ? "\\" : "/";
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const drive = normalized.match(/^([A-Za-z]:)(?:\/(.*))?$/);
  if (!drive) return splitRemotePath(path);

  const root = `${drive[1]}${sep}`;
  const segments: BreadcrumbSegment[] = [{ label: root, path: root }];
  let current = drive[1];
  for (const part of (drive[2] ?? "").split("/").filter(Boolean)) {
    current = `${current}${sep}${part}`;
    segments.push({ label: part, path: current });
  }
  return segments;
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const trimmed = normalized.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return normalized.startsWith("/") ? "/" : "";
  return trimmed.slice(0, idx);
}

export function createNavigationState(path: string): NavigationState {
  return { current: path, back: [] };
}

export function pushNavigation(
  state: NavigationState,
  nextPath: string,
): NavigationState {
  if (nextPath === state.current) return state;
  return {
    current: nextPath,
    back: [...state.back, state.current],
  };
}

export function replaceNavigation(
  state: NavigationState,
  nextPath: string,
): NavigationState {
  if (nextPath === state.current) return state;
  return createNavigationState(nextPath);
}

export function goBack(state: NavigationState): NavigationState {
  const previous = state.back[state.back.length - 1];
  if (!previous) return state;
  return {
    current: previous,
    back: state.back.slice(0, -1),
  };
}
