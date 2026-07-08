export type BreadcrumbSegment = {
  label: string;
  path: string;
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
