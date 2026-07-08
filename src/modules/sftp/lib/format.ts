export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return value === 0 ? "0 B" : "--";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${i === 0 ? n.toFixed(0) : n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(mtime: number): string {
  if (!mtime) return "--";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(mtime));
}

export function formatKind(kind: string): string {
  if (kind === "dir") return "folder";
  if (kind === "symlink") return "link";
  if (kind === "other") return "other";
  return "file";
}
