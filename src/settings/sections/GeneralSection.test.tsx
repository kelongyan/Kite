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
  return {
    ...actual,
    findUnavailableFonts: vi.fn(() => []),
    measureCjkAlignment: vi.fn(() => null),
    suggestAlignedCjkFont: vi.fn(() => null),
  };
});

const findUnavailableFonts = vi.mocked(
  (await import("@/lib/fonts")).findUnavailableFonts,
);
const measureCjkAlignment = vi.mocked(
  (await import("@/lib/fonts")).measureCjkAlignment,
);
const suggestAlignedCjkFont = vi.mocked(
  (await import("@/lib/fonts")).suggestAlignedCjkFont,
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
    expect(html).toContain('placeholder="Kite Mono"');
    expect(html).toContain('placeholder="Kite Sans SC"');
    expect(html).not.toContain("Aa 中文 123");
    // The custom suggestion popover only renders while a field is focused, so
    // a static render has no listbox and the input stays free-form.
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain(">Cursor<");
    expect(html).not.toContain("Cursor preview");
    expect(html).not.toContain("Shape");
    expect(html).not.toContain("Style");
  });

  it("warns when the committed font family does not resolve", () => {
    // jsdom has no 2D canvas context, so the real probe reports every family
    // as available; mock the finder to exercise the warning surface.
    findUnavailableFonts.mockImplementation((value: string) =>
      value === "Kite Mono" ? ["Kite Mono"] : [],
    );

    const html = renderToStaticMarkup(<GeneralSection />);

    expect(html).toContain("未匹配到字体名");
    expect(html).toContain("Kite Mono: 未匹配到字体名");
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('data-state="open"');
  });

  it("stays quiet when every committed family resolves", () => {
    findUnavailableFonts.mockReturnValue([]);

    const html = renderToStaticMarkup(<GeneralSection />);

    expect(html).not.toContain("未匹配到字体名");
    expect(html).not.toContain("role=\"status\"");
    expect(html).not.toContain('data-state="open"');
    expect(html).toContain('data-state="closed"');
  });

  it("hints when the code and CJK pair is not 2:1 aligned", () => {
    measureCjkAlignment.mockImplementation(() => ({
      ok: false,
      codeAdvance: 8,
      cjkAdvance: 15,
      cell: 8,
    }));
    suggestAlignedCjkFont.mockReturnValue("Sarasa Mono SC");

    const html = renderToStaticMarkup(<GeneralSection />);

    expect(html).toContain("中文字体与代码字体未对齐");
    expect(html).toContain("改用 Sarasa Mono SC");
    expect(html).toContain('data-state="open"');
  });

  it("shows no alignment hint when the pair measures aligned", () => {
    measureCjkAlignment.mockImplementation(() => ({
      ok: true,
      codeAdvance: 8,
      cjkAdvance: 16,
      cell: 8,
    }));

    const html = renderToStaticMarkup(<GeneralSection />);

    expect(html).not.toContain("中文字体与代码字体未对齐");
    expect(html).toContain('data-state="closed"');
  });
});
