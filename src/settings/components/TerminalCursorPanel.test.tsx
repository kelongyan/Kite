import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TerminalCursorPanel } from "./TerminalCursorPanel";

describe("TerminalCursorPanel", () => {
  it("renders the preview before controls and exposes width as segmented choices", () => {
    const html = renderToStaticMarkup(
      <TerminalCursorPanel
        shape="bar"
        animation="expand"
        width={2}
        labels={{
          animation: "Animation",
          preview: "Cursor preview",
          shape: "Shape",
          width: "Width",
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
        widthOptions={[1, 2, 3, 4]}
        onShapeChange={() => {}}
        onAnimationChange={() => {}}
        onWidthChange={() => {}}
      />,
    );

    expect(html.indexOf("Cursor preview")).toBeLessThan(
      html.indexOf("Shape"),
    );
    expect(html).toContain("aria-label=\"Shape: Bar\"");
    expect(html).toContain("aria-label=\"Width: 2 px\"");
    expect(html).not.toContain("<select");
  });
});
