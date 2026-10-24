import { describe, expect, it } from "vitest";
import {
  countPasteLines,
  pastePreview,
  shouldConfirmPaste,
  trimSelectionForCopy,
} from "./clipboardPolicy";

describe("trimSelectionForCopy", () => {
  it("keeps the selection unchanged when trimming is off", () => {
    expect(trimSelectionForCopy("ab  \ncd\t", false)).toBe("ab  \ncd\t");
  });

  it("strips trailing spaces and tabs per line, keeping indentation", () => {
    expect(trimSelectionForCopy("  ab  \n\tcd\t\nef", true)).toBe(
      "  ab\n\tcd\nef",
    );
  });

  it("does not touch interior whitespace", () => {
    expect(trimSelectionForCopy("a b   c   ", true)).toBe("a b   c");
  });
});

describe("shouldConfirmPaste", () => {
  const check = { multiline: true, maxChars: 2048 } as const;

  it("confirms any paste containing a newline", () => {
    expect(shouldConfirmPaste("a\nb", check)).toBe("multiline");
    expect(shouldConfirmPaste("a\r\nb", check)).toBe("multiline");
    expect(shouldConfirmPaste("\n", check)).toBe("multiline");
  });

  it("confirms a single line beyond the character cap", () => {
    expect(shouldConfirmPaste("x".repeat(2048), check)).toBeNull();
    expect(shouldConfirmPaste("x".repeat(2049), check)).toBe("large");
  });

  it("lets ordinary single-line pastes through", () => {
    expect(shouldConfirmPaste("pnpm install", check)).toBeNull();
    expect(shouldConfirmPaste("", check)).toBeNull();
  });
});

describe("countPasteLines", () => {
  it("counts newline-separated lines", () => {
    expect(countPasteLines("one")).toBe(1);
    expect(countPasteLines("one\ntwo\nthree")).toBe(3);
    expect(countPasteLines("one\n\nthree")).toBe(3);
  });
});

describe("pastePreview", () => {
  it("shows the first line", () => {
    expect(pastePreview("first\nsecond")).toBe("first");
  });

  it("truncates long lines with an ellipsis", () => {
    const preview = pastePreview("x".repeat(200), 120);
    expect(preview).toHaveLength(121);
    expect(preview.endsWith("…")).toBe(true);
  });
});
