import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type {
  TerminalCursorAnimation,
  TerminalCursorShape,
  TerminalCursorWidth,
} from "@/modules/terminal/lib/cursorStyle";
import { TerminalCursorPreview } from "@/settings/components/TerminalCursorPreview";
import { type ReactNode, useId } from "react";

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
};

type Props = {
  animation: TerminalCursorAnimation;
  animationOptions: readonly AnimationOption[];
  labels: Labels;
  onAnimationChange: (value: TerminalCursorAnimation) => void;
  onShapeChange: (value: TerminalCursorShape) => void;
  shape: TerminalCursorShape;
  shapeOptions: readonly ShapeOption[];
  width: TerminalCursorWidth;
};

export function TerminalCursorPanel({
  animation,
  animationOptions,
  labels,
  onAnimationChange,
  onShapeChange,
  shape,
  shapeOptions,
  width,
}: Props) {
  const shapeLabelId = useId();
  const animationLabelId = useId();
  const selectedShapeLabel =
    shapeOptions.find((option) => option.value === shape)?.label ?? shape;
  const selectedAnimationLabel =
    animationOptions.find((option) => option.value === animation)?.label ??
    animation;

  return (
    <div className="w-full max-w-[520px]">
      <TerminalCursorPreview
        shape={shape}
        shapeLabel={selectedShapeLabel}
        animation={animation}
        animationLabel={selectedAnimationLabel}
        width={width}
        previewLabel={labels.preview}
        className="mb-2.5"
      />
      <div className="grid grid-cols-[minmax(128px,auto)_minmax(0,1fr)] gap-3 rounded-md bg-muted/20 p-2">
        <CursorControlBlock id={shapeLabelId} label={labels.shape}>
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
        </CursorControlBlock>
        <CursorControlBlock id={animationLabelId} label={labels.animation}>
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
        </CursorControlBlock>
      </div>
    </div>
  );
}

function CursorControlBlock({
  children,
  id,
  label,
}: {
  children: ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <span id={id} className="text-[11px] text-muted-foreground">
        {label}
      </span>
      <div className="mt-1.5 min-w-0">{children}</div>
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
