import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TerminalCursorPanel } from "@/settings/components/TerminalCursorPanel";

describe("TerminalCursorPanel", () => {
  it("renders only shape and animation controls in a side-by-side layout", () => {
    const html = renderToStaticMarkup(
      <TerminalCursorPanel
        shape="bar"
        animation="expand"
        width={2}
        labels={{
          animation: "Animation",
          preview: "Cursor preview",
          shape: "Shape",
        }}
        shapeOptions={[
          { value: "bar", label: "Bar", ariaLabel: "Shape: Bar" },
          { value: "block", label: "Block", ariaLabel: "Shape: Block" },
          {
            value: "underline",
            label: "Underline",
            ariaLabel: "Shape: Underline",
          },
        ]}
        animationOptions={[
          {
            value: "steady",
            label: "Steady",
            ariaLabel: "Steady. No cursor animation.",
          },
          {
            value: "blink",
            label: "Blink",
            ariaLabel: "Blink. Alternates between visible and dim.",
          },
          {
            value: "smooth",
            label: "Smooth",
            ariaLabel: "Smooth. Fades in and out continuously.",
          },
          {
            value: "expand",
            label: "Expand",
            ariaLabel: "Expand. Expands vertically from the center.",
          },
        ]}
        onShapeChange={() => {}}
        onAnimationChange={() => {}}
      />,
    );

    expect(html.indexOf("Cursor preview")).toBeLessThan(
      html.indexOf("Shape"),
    );
    expect(html).toContain("aria-label=\"Shape: Bar\"");
    expect(html).toContain("grid-cols-[minmax(128px,auto)_minmax(0,1fr)]");
    expect(html).not.toContain("Width");
    expect(html).not.toContain("Width: 2 px");
    expect(html).not.toContain("<select");
  });
});
