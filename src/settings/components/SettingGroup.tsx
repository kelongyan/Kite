import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type GroupProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

/**
 * Titled group container for SettingRow rows. The container owns the border,
 * background, and dividers so SettingRow stays chrome-free and rows look the
 * same on every settings page.
 */
export function SettingGroup({ title, children, className }: GroupProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <SettingGroupTitle>{title}</SettingGroupTitle>
      <div className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-lg border border-border/60 bg-card/40">
        {children}
      </div>
    </div>
  );
}

export function SettingGroupTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </h2>
  );
}
