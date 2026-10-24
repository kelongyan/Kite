// Selections come back from xterm with "\n" separators. When trimming is on,
// each line keeps its leading indentation and loses only trailing blanks, the
// way Windows Terminal's "trim trailing whitespace" copy option behaves.
export function trimSelectionForCopy(
  selection: string,
  trimEnabled: boolean,
): string {
  if (!trimEnabled) return selection;
  return selection
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");
}

export type PasteConfirmReason = "multiline" | "large";

export type PasteConfirmCheck = {
  /** Any paste containing a newline is confirmed. */
  multiline: true;
  /** Single-line pastes beyond this many characters are confirmed. */
  maxChars: number;
};

export function shouldConfirmPaste(
  text: string,
  check: PasteConfirmCheck,
): PasteConfirmReason | null {
  if (text.includes("\n")) return "multiline";
  if (text.length > check.maxChars) return "large";
  return null;
}

export function countPasteLines(text: string): number {
  return text.split("\n").length;
}

export function pastePreview(text: string, maxChars = 120): string {
  const firstLine = text.split("\n", 1)[0] ?? "";
  return firstLine.length > maxChars
    ? `${firstLine.slice(0, maxChars)}…`
    : firstLine;
}
