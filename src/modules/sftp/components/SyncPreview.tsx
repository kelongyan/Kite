import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useMessages } from "@/modules/i18n";
import {
  syncPlanNeedsOverwriteConfirmation,
  type SyncChange,
  type SyncOperation,
  type SyncPlan,
} from "@/modules/sftp/lib/diffEntries";
import { useEffect, useMemo, useState } from "react";

type Props = {
  plan: SyncPlan | null;
  onOpenChange: (open: boolean) => void;
  onApply: (plan: SyncPlan) => void;
};

export function SyncPreview({ plan, onOpenChange, onApply }: Props) {
  const messages = useMessages().workspace.sftp;
  const [confirmedOverwrite, setConfirmedOverwrite] = useState(false);

  useEffect(() => {
    setConfirmedOverwrite(false);
  }, [plan]);

  const counts = useMemo(() => {
    const next: Record<SyncOperation, number> = {
      create: 0,
      overwrite: 0,
      same: 0,
      keepDestination: 0,
      conflict: 0,
    };
    for (const change of plan?.changes ?? []) {
      next[change.operation] += 1;
    }
    return next;
  }, [plan]);

  if (!plan) return null;

  const needsOverwriteConfirmation = syncPlanNeedsOverwriteConfirmation(plan);
  const applyDisabled =
    plan.hasConflicts ||
    plan.applyPaths.length === 0 ||
    (needsOverwriteConfirmation && !confirmedOverwrite);

  return (
    <Dialog open={Boolean(plan)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle>{messages.syncPreviewTitle}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="text-sm text-muted-foreground">
            {messages.syncPreviewDescription(plan.direction)}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {messages.syncCreateCount(counts.create)}
            </Badge>
            <Badge variant="secondary">
              {messages.syncOverwriteCount(counts.overwrite)}
            </Badge>
            <Badge variant="outline">
              {messages.syncUnchangedCount(counts.same)}
            </Badge>
            <Badge variant="outline">
              {messages.syncKeptCount(counts.keepDestination)}
            </Badge>
            {counts.conflict > 0 ? (
              <Badge variant="destructive">
                {messages.syncConflictCount(counts.conflict)}
              </Badge>
            ) : null}
          </div>

          <div className="rounded-md border border-border/60">
            <div className="grid h-8 grid-cols-[minmax(0,1fr)_8rem_8rem] items-center border-b border-border/60 px-3 text-[11px] uppercase tracking-wide text-muted-foreground">
              <div>{messages.tableName}</div>
              <div>{messages.syncOperation}</div>
              <div>{messages.tableKind}</div>
            </div>
            <div className="max-h-72 overflow-auto">
              {plan.changes.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  {messages.syncNoChanges}
                </div>
              ) : (
                plan.changes.map((change) => (
                  <SyncChangeRow
                    key={`${change.operation}:${change.name}`}
                    change={change}
                  />
                ))
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {messages.syncNoDeletes}
          </div>

          {plan.hasConflicts ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {messages.syncBlockedByConflicts}
            </div>
          ) : null}

          {needsOverwriteConfirmation ? (
            <label className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
              <Checkbox
                checked={confirmedOverwrite}
                onCheckedChange={(checked) =>
                  setConfirmedOverwrite(checked === true)
                }
              />
              <span>{messages.syncConfirmOverwrite}</span>
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {messages.cancel}
          </Button>
          <Button disabled={applyDisabled} onClick={() => onApply(plan)}>
            {messages.syncApply(plan.applyPaths.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SyncChangeRow({ change }: { change: SyncChange }) {
  const messages = useMessages().workspace.sftp;
  const operationLabel = operationText(change.operation, messages);
  const kind =
    change.sourceKind ?? change.destinationKind ?? messages.syncUnknownKind;
  return (
    <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_8rem_8rem] items-center border-b border-border/40 px-3 py-2 text-sm last:border-b-0">
      <div className="min-w-0">
        <div className="truncate">{change.name}</div>
        {change.reason === "kindMismatch" ? (
          <div className="truncate text-xs text-destructive">
            {messages.syncKindMismatch}
          </div>
        ) : null}
      </div>
      <div
        className={cn("text-xs font-medium", operationClass(change.operation))}
      >
        {operationLabel}
      </div>
      <div className="truncate text-xs text-muted-foreground">{kind}</div>
    </div>
  );
}

function operationText(
  operation: SyncOperation,
  messages: ReturnType<typeof useMessages>["workspace"]["sftp"],
): string {
  switch (operation) {
    case "create":
      return messages.syncCreate;
    case "overwrite":
      return messages.syncOverwrite;
    case "same":
      return messages.syncSame;
    case "keepDestination":
      return messages.syncKeepDestination;
    case "conflict":
      return messages.syncConflict;
  }
}

function operationClass(operation: SyncOperation): string {
  switch (operation) {
    case "create":
      return "text-primary";
    case "overwrite":
      return "text-amber-600 dark:text-amber-400";
    case "conflict":
      return "text-destructive";
    case "same":
    case "keepDestination":
      return "text-muted-foreground";
  }
}
