import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcAlias = join(root, "src");

export const DEFAULT_WATCH = [
  "@ai-sdk",
  "ai",
  "streamdown",
  "@codemirror",
  "@uiw",
  "motion",
  "@xterm",
  "xterm",
];

const exts = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs"];
function resolveLocal(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join(srcAlias, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const e of exts) {
    const p = base + e;
    if (e && existsSync(p) && statSync(p).isFile()) return p;
  }
  for (const e of exts.slice(1)) {
    const p = join(base, "index" + e);
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

const STATIC_IMPORT =
  /(?:^|\n)\s*import\s+(?!type[\s{])(?:[^"';]*?from\s*)?["']([^"']+)["']/g;
const STATIC_EXPORT_FROM =
  /(?:^|\n)\s*export\s+(?!type[\s{])[^"';]*?from\s*["']([^"']+)["']/g;

function staticSpecs(code) {
  const specs = new Set();
  for (const re of [STATIC_IMPORT, STATIC_EXPORT_FROM]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code))) specs.add(m[1]);
  }
  return [...specs];
}

function pkgOf(spec, watch) {
  return watch.find((w) => spec === w || spec.startsWith(w + "/"));
}

/** @returns {{ moduleCount: number, hits: Map<string, {spec:string, file:string}> }} */
export function traceEager(entry, watch = DEFAULT_WATCH) {
  const entryFile = resolve(root, entry);
  const seen = new Set();
  const queue = [entryFile];
  const hits = new Map();
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    let code;
    try {
      code = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const spec of staticSpecs(code)) {
      const local = resolveLocal(spec, file);
      if (local) {
        queue.push(local);
        continue;
      }
      const pkg = pkgOf(spec, watch);
      if (pkg && !hits.has(pkg)) {
        hits.set(pkg, { spec, file: file.replace(root + "/", "") });
      }
    }
  }
  return { moduleCount: seen.size, hits };
}
