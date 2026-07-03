import { describe, expect, it } from "vitest";
import { detectMonoFontFamily, resolveFontFamily } from "./fonts";

const FALLBACK =
  '"Sarasa Mono SC", "Sarasa Term SC", "Source Han Mono SC", "Source Han Sans SC", "LXGW WenKai Mono", "Noto Sans Mono CJK SC", "Noto Serif CJK SC", "Microsoft YaHei Mono", "Microsoft YaHei", "Microsoft YaHei UI", "DengXian", "SimHei", "SimSun", "FangSong", "KaiTi", "NSimSun", SFMono-Regular, Menlo, monospace';
const DEFAULT_STACK =
  '"JetBrains Mono", "Sarasa Mono SC", "Sarasa Term SC", "Source Han Mono SC", "Source Han Sans SC", "LXGW WenKai Mono", "Noto Sans Mono CJK SC", "Noto Serif CJK SC", "Microsoft YaHei Mono", "Microsoft YaHei", "Microsoft YaHei UI", "DengXian", "SimHei", "SimSun", "FangSong", "KaiTi", "NSimSun", SFMono-Regular, Menlo, monospace';

describe("resolveFontFamily", () => {
  it("quotes a bare family and appends the mono fallback", () => {
    expect(resolveFontFamily("JetBrainsMono Nerd Font")).toBe(
      `"JetBrainsMono Nerd Font", ${FALLBACK}`,
    );
  });

  it("does not double-quote an already-quoted family", () => {
    expect(resolveFontFamily('"Fira Code"')).toBe(`"Fira Code", ${FALLBACK}`);
  });

  it("passes a comma-separated stack through and still appends fallback", () => {
    expect(resolveFontFamily("Foo, Bar")).toBe(`Foo, Bar, ${FALLBACK}`);
  });

  it("strips stray internal quotes to avoid a malformed token", () => {
    expect(resolveFontFamily('Foo"Bar')).toBe(`"FooBar", ${FALLBACK}`);
  });

  it("trims surrounding whitespace before quoting", () => {
    expect(resolveFontFamily("  Hack Nerd Font  ")).toBe(
      `"Hack Nerd Font", ${FALLBACK}`,
    );
  });

  it("uses the default stack with CJK fallbacks for empty input", () => {
    expect(resolveFontFamily("")).toBe(DEFAULT_STACK);
    expect(resolveFontFamily("   ")).toBe(DEFAULT_STACK);
  });

  it("uses bundled JetBrains Mono as the first default font", () => {
    expect(resolveFontFamily("")).toMatch(/^"JetBrains Mono", /);
    expect(resolveFontFamily("")).not.toContain("Nerd Font");
  });

  it("keeps the legacy default-stack export for editor surfaces", () => {
    expect(detectMonoFontFamily()).toBe(DEFAULT_STACK);
  });
});
