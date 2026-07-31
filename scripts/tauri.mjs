import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cli = require("@tauri-apps/cli");
const args = process.argv.slice(2);

if (args[0] === "dev") {
  const separator = args.indexOf("--");
  const insertAt = separator === -1 ? args.length : separator;
  args.splice(
    insertAt,
    0,
    "--config",
    JSON.stringify({
      productName: "Kite Dev",
      identifier: "app.kelongyan.kite.dev",
    }),
  );
}

try {
  await cli.run(args, "pnpm tauri");
} catch (error) {
  cli.logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
