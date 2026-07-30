import { useBlockController } from "@/modules/terminal/lib/blockController";
import { useTheme } from "@/modules/theme";
import { lazy, Suspense } from "react";

const ShellInput = lazy(() => import("@/modules/terminal/block/ShellInput"));

type Props = {
  isBlockTab: boolean;
  activeLeafId: number | null;
};

export function WorkspaceInputBar({ isBlockTab, activeLeafId }: Props) {
  const { resolvedMode, themeId, customThemes } = useTheme();
  const themeKey = `${resolvedMode}:${themeId}:${customThemes.length}`;
  const controller = useBlockController(isBlockTab ? activeLeafId : null);
  const blockMode = controller?.blockMode ?? "prompt";

  if (!isBlockTab || !controller || activeLeafId == null) return null;

  return (
    <div data-state="open" className="terax-reveal">
      <div className="shrink-0 border-t border-border/60 bg-card/40 px-3 py-2">
        <Suspense fallback={null}>
          <ShellInput
            leafId={activeLeafId}
            mode={blockMode}
            focused
            themeKey={themeKey}
            onSubmit={controller.submitCommand}
            onInterrupt={controller.interrupt}
            getCwd={controller.getCwd}
          />
        </Suspense>
      </div>
    </div>
  );
}
