import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { findLeafCwd } from "@/modules/terminal/lib/panes";
import type { Tab } from "./useTabs";
import {
  isSameDisplayPath,
  labelFor,
  TERMINAL_HOME_LABEL,
} from "./tabLabel";

const APP_NAME = "Kite";

function basename(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/");
  if (/^[A-Za-z]:\/?$/.test(normalized)) return `${normalized.replace(/\/+$/, "")}/`;
  const parts = normalized.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "/";
}

/** Label of the focused tab. */
function tabLabel(
  tab: Tab | undefined,
  home?: string | null,
  homeResolved?: boolean,
): string {
  if (!tab) return "";
  if (tab.kind === "terminal")
    return labelFor(
      {
        ...tab,
        cwd: findLeafCwd(tab.paneTree, tab.activeLeafId) ?? tab.cwd,
      },
      { home, homeResolved },
    );
  return tab.title;
}

function projectLabel(
  workspaceRoot: string | null,
  home?: string | null,
  homeResolved?: boolean,
): string {
  if (!workspaceRoot) return "";
  if (homeResolved === false) return "";
  if (home && isSameDisplayPath(workspaceRoot, home)) {
    return TERMINAL_HOME_LABEL;
  }
  return basename(workspaceRoot);
}

export function resolveWindowTitle(
  activeTab: Tab | undefined,
  workspaceRoot: string | null,
  options: { home?: string | null; homeResolved?: boolean } = {},
): string {
  if (options.homeResolved === false) {
    if (activeTab?.kind === "terminal") {
      const custom = activeTab.customTitle?.trim();
      return custom || APP_NAME;
    }
    return activeTab?.title || APP_NAME;
  }

  const project = projectLabel(
    workspaceRoot,
    options.home,
    options.homeResolved,
  );
  const label = tabLabel(activeTab, options.home, options.homeResolved);

  if (project && label && label !== project) return `${project} - ${label}`;
  return project || label || APP_NAME;
}

/**
 * Drives the OS window title from the focused tab + project folder. Without
 * this the window keeps the build-time default ("Tauri App" on Linux).
 *
 * Format: `<project> - <tab>` (e.g. `Kite - src`), collapsing to just the
 * project when the focused terminal sits at the project root. Falls back to the
 * app name when there's nothing to show.
 */
export function useWindowTitle(
  activeTab: Tab | undefined,
  workspaceRoot: string | null,
  home?: string | null,
  homeResolved?: boolean,
): void {
  const title = resolveWindowTitle(activeTab, workspaceRoot, {
    home,
    homeResolved,
  });

  useEffect(() => {
    document.title = title;
    void getCurrentWindow()
      .setTitle(title)
      .catch(() => {});
  }, [title]);
}
