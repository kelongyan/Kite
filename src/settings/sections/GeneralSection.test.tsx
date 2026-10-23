import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeneralSection } from "@/settings/sections/GeneralSection";

vi.mock("@/modules/theme", () => ({
  useTheme: () => ({
    mode: "system",
    setMode: vi.fn(),
  }),
}));

vi.mock("@/lib/fonts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fonts")>();
  return { ...actual, findUnavailableFonts: vi.fn(() => []) };
});

const findUnavailableFonts = vi.mocked(
  (await import("@/lib/fonts")).findUnavailableFonts,
);

describe("GeneralSection", () => {
  beforeEach(() => {
    findUnavailableFonts.mockImplementation(() => []);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps terminal settings but removes cursor controls", () => {
    const html = renderToStaticMarkup(<GeneralSection />);

    expect(html).toContain("使用 WebGL 渲染器");
    expect(html).toContain("代码字体");
    expect(html).toContain("中文字体");
    // Free-form text fields, not pickers: one input per font family.
    expect(html.match(/data-slot="input"/g)).toHaveLength(2);
    expect(html).not.toContain('data-slot="combobox-trigger"');
    expect(html).toContain('placeholder="JetBrains Mono"');
    expect(html).toContain('placeholder="Noto Sans SC"');
    expect(html).not.toContain("Aa 中文 123");
    expect(html).not.toContain("<datalist");
    expect(html).not.toContain(">Cursor<");
    expect(html).not.toContain("Cursor preview");
    expect(html).not.toContain("Shape");
    expect(html).not.toContain("Style");
  });

  it("warns when the committed font family does not resolve", () => {
    // jsdom has no 2D canvas context, so the real probe reports every family
    // as available; mock the finder to exercise the warning surface.
    findUnavailableFonts.mockImplementation((value: string) =>
      value === "JetBrains Mono" ? ["JetBrains Mono"] : [],
    );

    const html = renderToStaticMarkup(<GeneralSection />);

    expect(html).toContain("未匹配到字体名");
    expect(html).toContain("JetBrains Mono: 未匹配到字体名");
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('data-state="open"');
  });

  it("stays quiet when every committed family resolves", () => {
    findUnavailableFonts.mockReturnValue([]);

    const html = renderToStaticMarkup(<GeneralSection />);

    expect(html).not.toContain("未匹配到字体名");
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('data-state="open"');
    expect(html).toContain('data-state="closed"');
  });
});
