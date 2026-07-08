import { cn } from "@/lib/utils";
import type {
  TerminalCursorAnimation,
  TerminalCursorShape,
  TerminalCursorWidth,
} from "@/modules/terminal/lib/cursorStyle";

type Props = {
  animation: TerminalCursorAnimation;
  animationLabel: string;
  previewLabel: string;
  shape: TerminalCursorShape;
  shapeLabel: string;
  width: TerminalCursorWidth;
};

export function TerminalCursorPreview({
  animation,
  animationLabel,
  previewLabel,
  shape,
  shapeLabel,
  width,
}: Props) {
  return (
    <div
      className="flex h-12 w-full items-center rounded-md border border-border/60 bg-background px-3 font-mono text-[12px] text-foreground shadow-inner"
      role="img"
      aria-label={`${previewLabel}: ${shapeLabel}, ${animationLabel}`}
    >
      <span className="text-muted-foreground">~/Kite</span>
      <span className="mx-2 text-muted-foreground/60">pnpm dev</span>
      <span
        className={cn(
          "inline-block bg-foreground align-middle",
          shape === "bar" && "h-5",
          shape === "block" && "h-5 w-2.5 opacity-70",
          shape === "underline" && "h-0.5 w-2.5 translate-y-2",
          animation === "blink" && "kite-terminal-cursor-preview-blink",
          animation === "smooth" && "kite-terminal-cursor-preview-smooth",
          animation === "expand" && "kite-terminal-cursor-preview-expand",
        )}
        style={shape === "bar" ? { width: `${width}px` } : undefined}
        aria-hidden="true"
      />
    </div>
  );
}
