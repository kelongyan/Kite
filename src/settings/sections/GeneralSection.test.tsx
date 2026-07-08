import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GeneralSection } from "@/settings/sections/GeneralSection";

vi.mock("@/modules/theme", () => ({
  useTheme: () => ({
    mode: "system",
    setMode: vi.fn(),
  }),
}));

describe("GeneralSection", () => {
  it("keeps terminal settings but removes cursor controls", () => {
    const html = renderToStaticMarkup(<GeneralSection />);

    expect(html).toContain("Use WebGL renderer");
    expect(html).not.toContain(">Cursor<");
    expect(html).not.toContain("Cursor preview");
    expect(html).not.toContain("Shape");
    expect(html).not.toContain("Style");
  });
});
