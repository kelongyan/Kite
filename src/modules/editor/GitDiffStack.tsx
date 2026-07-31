import type { GitDiffTab, Tab } from "@/modules/tabs";
import { GitDiffPane } from "./GitDiffPane";

type Props = {
  tabs: Tab[];
  activeId: number;
};

export function GitDiffStack({ tabs, activeId }: Props) {
  const active = tabs.find(
    (t): t is GitDiffTab => t.kind === "git-diff" && t.id === activeId,
  );
  if (!active) return null;
  return (
    <div className="h-full w-full">
      <GitDiffPane
        key={active.id}
        active
        source={{
          kind: "working",
          repoRoot: active.repoRoot,
          path: active.path,
          mode: active.mode,
          originalPath: active.originalPath,
        }}
      />
    </div>
  );
}
