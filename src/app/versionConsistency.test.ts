import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

function readCargoVersion(): string {
  const cargo = readFileSync(path.join(root, "src-tauri/Cargo.toml"), "utf8");
  const match = cargo.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) throw new Error("src-tauri/Cargo.toml is missing package version");
  return match[1];
}

describe("release version metadata", () => {
  it("keeps app package versions in sync", () => {
    const packageJson = readJson<{ version: string }>("package.json");
    const tauriConfig = readJson<{ version: string }>("src-tauri/tauri.conf.json");

    expect({
      cargo: readCargoVersion(),
      package: packageJson.version,
      tauri: tauriConfig.version,
    }).toEqual({
      cargo: packageJson.version,
      package: packageJson.version,
      tauri: packageJson.version,
    });
  });
});
