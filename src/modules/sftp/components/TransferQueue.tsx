import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Messages } from "@/modules/i18n";
import { formatBytes } from "@/modules/sftp/lib/format";
import { basename } from "@/modules/sftp/lib/path";
import { sftpApi } from "@/modules/sftp/lib/api";
import type { SftpTransfer } from "@/modules/sftp/lib/types";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Download01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

type Props = {
  transfers: SftpTransfer[];
  messages: Messages["workspace"]["sftp"];
  onClearCompleted: () => void;
};

export function TransferQueue({
  transfers,
  messages,
  onClearCompleted,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const running = transfers.filter((item) => item.status === "running").length;
  const failed = transfers.filter((item) => item.status === "failed").length;
  const done = transfers.filter((item) => item.status === "done").length;

  return (
    <section
      className={`shrink-0 border-t border-border/60 bg-card/60 ${expanded ? "h-36" : "h-9"}`}
    >
      <div className="flex h-9 items-center justify-between border-b border-border/60 px-3 text-sm">
        <div className="font-medium">{messages.transferQueue}</div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{messages.runningCount(running)}</span>
          <span>{messages.doneCount(done)}</span>
          <span>{messages.failedCount(failed)}</span>
          <Button size="sm" variant="ghost" onClick={onClearCompleted}>
            {messages.clear}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? messages.collapse : messages.expand}
            title={expanded ? messages.collapse : messages.expand}
          >
            <HugeiconsIcon
              icon={expanded ? ArrowDown01Icon : ArrowUp01Icon}
              size={13}
              strokeWidth={2}
            />
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="h-[calc(100%-2.25rem)] overflow-auto">
          {transfers.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              {messages.noTransfers}
            </div>
          ) : (
            transfers.map((item) => {
              const pct =
                item.bytesTotal > 0
                  ? Math.min(100, (item.bytesDone / item.bytesTotal) * 100)
                  : item.status === "done"
                    ? 100
                    : 0;
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.2rem_minmax(0,1fr)_9rem_5rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm"
                >
                  <HugeiconsIcon
                    icon={
                      item.direction === "upload"
                        ? Upload01Icon
                        : Download01Icon
                    }
                    size={14}
                    strokeWidth={2}
                    className="text-muted-foreground"
                  />
                  <div className="min-w-0">
                    <div className="truncate">{basename(item.source)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {item.direction === "upload" ? item.target : item.source}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Progress value={pct} className="h-1.5" />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatBytes(item.bytesDone)} /{" "}
                      {formatBytes(item.bytesTotal)}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      {messages.status[item.status]}
                    </span>
                    {(item.status === "queued" ||
                      item.status === "running") && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => void sftpApi.cancelTransfer(item.id)}
                        aria-label={messages.cancelTransfer}
                        title={messages.cancel}
                      >
                        <HugeiconsIcon
                          icon={Cancel01Icon}
                          size={13}
                          strokeWidth={2}
                        />
                      </Button>
                    )}
                  </div>
                  {item.error ? (
                    <div className="col-span-4 text-xs text-destructive">
                      {item.error}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}
