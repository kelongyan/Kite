#!/usr/bin/env node
// Static eager-import tracer. BFS from an entry following only *static* value
// imports (`import ... from "x"`, `export ... from "x"`). `import type` /
// `export type` are erased by the compiler, and `import("x")` /
// `lazy(() => import("x"))` are lazy boundaries, so none of them count toward
// the eager runtime graph. Reports which heavy node_modules packages end up in
// the eager graph and the first local file that pulls each.
//
// CLI:  node scripts/eager-graph.mjs [entry] [comma,separated,watchlist]
import { fileURLToPath } from "node:url";
import { DEFAULT_WATCH, traceEager } from "./eager-graph-core.mjs";

export { DEFAULT_WATCH, traceEager };

const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  const entry = process.argv[2] || "src/main.tsx";
  const watch = process.argv[3] ? process.argv[3].split(",") : DEFAULT_WATCH;
  const { moduleCount, hits } = traceEager(entry, watch);
  console.log(`\nEager graph from ${entry}: ${moduleCount} local modules\n`);
  if (hits.size === 0) {
    console.log("  none of the watched heavy packages are eagerly reachable\n");
  } else {
    console.log("  HEAVY PACKAGES IN EAGER GRAPH:");
    for (const [pkg, info] of hits) {
      console.log(
        `  x ${pkg.padEnd(14)} via ${info.spec}\n       first pulled by: ${info.file}`,
      );
    }
    console.log("");
  }
}
