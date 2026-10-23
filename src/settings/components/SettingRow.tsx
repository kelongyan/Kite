import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  children: React.ReactNode;
  className?: string;
};

/**
 * One row inside a SettingGroup. The group owns border, background, and
 * dividers; this component only lays out the title against the
 * control, so it must not add chrome of its own.
 */
export function SettingRow({ title, children, className }: Props) {
  return (
    <div
      className={cn(
        "flex min-h-12 items-center justify-between gap-5 px-4 py-2.5",
        className,
      )}
    >
      <span className="min-w-0 text-[12.5px] font-medium">{title}</span>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}
