import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GeneralSection } from "@/settings/sections/GeneralSection";

vi.mock("@/modules/theme", () => ({
  useTheme: () => ({
    mode: "system",
    setMode: vi.fn(),
  }),
}));

vi.mock("@/settings/SettingsNavigationContext", () => ({
  useSettingsNavigation: () => ({
    setActiveTab: vi.fn(),
  }),
}));

describe("GeneralSection", () => {
  it("keeps terminal settings but removes cursor controls", () => {
    const html = renderToStaticMarkup(<GeneralSection />);

    expect(html).toContain("使用 WebGL 渲染器");
    expect(html).toContain("代码字体");
    expect(html).toContain("中文字体");
    expect(html.match(/data-slot="combobox-trigger"/g)).toHaveLength(2);
    expect(html).toContain("JetBrains Mono");
    expect(html).toContain("自动");
    expect(html).not.toContain("Aa 中文 123");
    expect(html).not.toContain("<datalist");
    expect(html).not.toContain(">Cursor<");
    expect(html).not.toContain("Cursor preview");
    expect(html).not.toContain("Shape");
    expect(html).not.toContain("Style");
  });
});
