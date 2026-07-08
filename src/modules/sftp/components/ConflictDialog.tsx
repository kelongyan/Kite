import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMessages } from "@/modules/i18n";
import type { SelectableEntry } from "@/modules/sftp/lib/selection";
import type { SftpConflictPolicy } from "@/modules/sftp/lib/types";

type Props = {
  open: boolean;
  conflicts: SelectableEntry[];
  onOpenChange: (open: boolean) => void;
  onResolve: (policy: SftpConflictPolicy) => void;
};

export function ConflictDialog({
  open,
  conflicts,
  onOpenChange,
  onResolve,
}: Props) {
  const messages = useMessages().workspace.sftp;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>{messages.conflictTitle}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <div className="text-muted-foreground">
            {messages.conflictDescription(conflicts.length)}
          </div>
          <div className="max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/30">
            {conflicts.slice(0, 8).map((entry) => (
              <div
                key={entry.path}
                className="truncate border-b border-border/40 px-3 py-2 last:border-b-0"
                title={entry.path}
              >
                {entry.name}
              </div>
            ))}
            {conflicts.length > 8 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {messages.moreConflicts(conflicts.length - 8)}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {messages.cancel}
          </Button>
          <Button variant="secondary" onClick={() => onResolve("skip")}>
            {messages.skip}
          </Button>
          <Button variant="secondary" onClick={() => onResolve("rename")}>
            {messages.rename}
          </Button>
          <Button onClick={() => onResolve("overwrite")}>
            {messages.overwrite}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
