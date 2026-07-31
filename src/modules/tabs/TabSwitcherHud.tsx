import { cn } from "@/lib/utils";
import { useMemo } from "react";
import {
  isTerminalLabelResolving,
  labelFor,
  TERMINAL_HOME_LABEL,
  type TabLabelOptions,
} from "./lib/tabLabel";
import type { TabSwitcherState } from "./lib/useTabSwitcher";
import type { Tab } from "./lib/useTabs";
import { TabIcon } from "./TabBar";

function subtitleFor(
  tab: Tab,
  options: TabLabelOptions,
  label: string,
): string | null {
  if (tab.kind === "terminal")
    return isTerminalLabelResolving(tab, options) ||
      label === TERMINAL_HOME_LABEL
      ? null
      : tab.cwd
        ? (tab.cwd.split(/[\\/]/).filter(Boolean).slice(-2).join("/") ||
          tab.cwd)
        : null;
  if (tab.kind === "editor" || tab.kind === "markdown")
    return tab.path.split(/[\\/]/).filter(Boolean).slice(-2, -1)[0] ?? null;
  return null;
}

export function TabSwitcherHud({
  tabs,
  state,
  home,
  homeResolved,
}: {
  tabs: Tab[];
  state: TabSwitcherState;
  home?: string | null;
  homeResolved?: boolean;
}) {
  const byId = useMemo(() => new Map(tabs.map((t) => [t.id, t])), [tabs]);
  const options = { home, homeResolved };
  const rows = state.order
    .map((id) => byId.get(id))
    .filter((t): t is Tab => t !== undefined);
  const selectedId = state.order[state.index];

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
    >
      <div className="flex max-h-[60vh] w-72 flex-col gap-0.5 overflow-y-auto rounded-2xl border border-border bg-popover/95 p-1.5 shadow-2xl ring-1 ring-foreground/5 backdrop-blur-md">
        {rows.map((t) => {
          const label = labelFor(t, options);
          const subtitle = subtitleFor(t, options, label);
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs",
                t.id === selectedId
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <TabIcon
                tab={t}
                starting={isTerminalLabelResolving(t, options)}
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {subtitle && (
                <span className="shrink-0 truncate text-[10px] text-muted-foreground/55">
                  {subtitle}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
