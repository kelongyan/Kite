import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type {
  TerminalCursorAnimation,
  TerminalCursorShape,
  TerminalCursorWidth,
} from "@/modules/terminal/lib/cursorStyle";
import { type ReactNode, useId } from "react";
import { TerminalCursorPreview } from "./TerminalCursorPreview";

type ShapeOption = {
  value: TerminalCursorShape;
  label: string;
  ariaLabel: string;
};

type AnimationOption = {
  value: TerminalCursorAnimation;
  label: string;
  ariaLabel: string;
};

type Labels = {
  animation: string;
  preview: string;
  shape: string;
  width: string;
};

type Props = {
  animation: TerminalCursorAnimation;
  animationOptions: readonly AnimationOption[];
  labels: Labels;
  onAnimationChange: (value: TerminalCursorAnimation) => void;
  onShapeChange: (value: TerminalCursorShape) => void;
  onWidthChange: (value: TerminalCursorWidth) => void;
  shape: TerminalCursorShape;
  shapeOptions: readonly ShapeOption[];
  width: TerminalCursorWidth;
  widthOptions: readonly TerminalCursorWidth[];
};

export function TerminalCursorPanel({
  animation,
  animationOptions,
  labels,
  onAnimationChange,
  onShapeChange,
  onWidthChange,
  shape,
  shapeOptions,
  width,
  widthOptions,
}: Props) {
  const shapeLabelId = useId();
  const animationLabelId = useId();
  const widthLabelId = useId();
  const selectedShapeLabel =
    shapeOptions.find((option) => option.value === shape)?.label ?? shape;
  const selectedAnimationLabel =
    animationOptions.find((option) => option.value === animation)?.label ??
    animation;

  return (
    <div className="w-full max-w-[460px] rounded-lg border border-border/50 bg-background/35 p-2.5 shadow-inner">
      <TerminalCursorPreview
        shape={shape}
        shapeLabel={selectedShapeLabel}
        animation={animation}
        animationLabel={selectedAnimationLabel}
        width={width}
        previewLabel={labels.preview}
        className="mb-2.5"
      />
      <div className="grid gap-2">
        <CursorControlRow id={shapeLabelId} label={labels.shape}>
          <CursorToggleGroup
            value={shape}
            ariaLabelledBy={shapeLabelId}
            onChange={(value) => onShapeChange(value as TerminalCursorShape)}
          >
            {shapeOptions.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                size="sm"
                className="h-7 w-10 px-0"
                aria-label={option.ariaLabel}
                title={option.label}
              >
                <CursorShapeGlyph shape={option.value} />
              </ToggleGroupItem>
            ))}
          </CursorToggleGroup>
        </CursorControlRow>
        <CursorControlRow id={animationLabelId} label={labels.animation}>
          <CursorToggleGroup
            value={animation}
            ariaLabelledBy={animationLabelId}
            onChange={(value) =>
              onAnimationChange(value as TerminalCursorAnimation)
            }
          >
            {animationOptions.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                aria-label={option.ariaLabel}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </CursorToggleGroup>
        </CursorControlRow>
        {shape === "bar" ? (
          <CursorControlRow id={widthLabelId} label={labels.width}>
            <CursorToggleGroup
              value={String(width)}
              ariaLabelledBy={widthLabelId}
              onChange={(value) =>
                onWidthChange(Number(value) as TerminalCursorWidth)
              }
            >
              {widthOptions.map((option) => (
                <ToggleGroupItem
                  key={option}
                  value={String(option)}
                  size="sm"
                  className="h-7 w-9 px-0 text-[11px] tabular-nums"
                  aria-label={`${labels.width}: ${option} px`}
                >
                  {option}
                </ToggleGroupItem>
              ))}
            </CursorToggleGroup>
          </CursorControlRow>
        ) : null}
      </div>
    </div>
  );
}

function CursorControlRow({
  children,
  id,
  label,
}: {
  children: ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
      <span id={id} className="text-[11px] text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CursorToggleGroup({
  value,
  ariaLabelledBy,
  onChange,
  children,
}: {
  value: string;
  ariaLabelledBy: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      variant="outline"
      size="sm"
      spacing={0}
      aria-labelledby={ariaLabelledBy}
      className="rounded-md [&_[data-slot=toggle-group-item]:first-child]:rounded-l-md [&_[data-slot=toggle-group-item]:last-child]:rounded-r-md"
    >
      {children}
    </ToggleGroup>
  );
}

function CursorShapeGlyph({ shape }: { shape: TerminalCursorShape }) {
  return (
    <span
      className="flex h-4 w-5 items-center justify-center"
      aria-hidden="true"
    >
      <span
        className={cn(
          "block bg-current",
          shape === "bar" && "h-4 w-px",
          shape === "block" && "h-4 w-3 opacity-80",
          shape === "underline" && "h-0.5 w-3 translate-y-1.5",
        )}
      />
    </span>
  );
}
