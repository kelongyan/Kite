import type { ComponentProps } from "react";
import type { Tab } from "@/modules/tabs";
import { TerminalStack } from "@/modules/terminal";

type TerminalStackProps = ComponentProps<typeof TerminalStack>;

type Props = {
  tabs: Tab[];
  activeId: number;
  registerTerminalHandle: TerminalStackProps["registerHandle"];
  onCwd: TerminalStackProps["onCwd"];
  onExit: TerminalStackProps["onExit"];
  onFocusLeaf: TerminalStackProps["onFocusLeaf"];
  onPaneCommand: TerminalStackProps["onPaneCommand"];
};

/** Mounts the terminal surface; panes keep their state across tab switches. */
export function WorkspaceSurface({
  tabs,
  activeId,
  registerTerminalHandle,
  onCwd,
  onExit,
  onFocusLeaf,
  onPaneCommand,
}: Props) {
  return (
    <div className="absolute inset-0 px-3 pt-2 pb-2">
      <TerminalStack
        tabs={tabs}
        activeId={activeId}
        registerHandle={registerTerminalHandle}
        onCwd={onCwd}
        onExit={onExit}
        onFocusLeaf={onFocusLeaf}
        onPaneCommand={onPaneCommand}
      />
    </div>
  );
}
