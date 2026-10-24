import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMessages } from "@/modules/i18n";
import { usePasteGuardStore } from "./lib/pasteGuardStore";
import { pasteIntoLeaf } from "./lib/rendererPool";

/**
 * Confirmation for multiline or oversized pastes. The dialog hands the text
 * back to the renderer pool's bracketed-paste path, so a confirmed paste
 * behaves exactly like an unguarded one.
 */
export function PasteGuardDialog() {
  const messages = useMessages();
  const t = messages.mainShell.pasteGuard;
  const pending = usePasteGuardStore((s) => s.pending);
  const clear = usePasteGuardStore((s) => s.clear);

  const confirmPaste = () => {
    if (!pending) return;
    const { leafId, text } = pending;
    clear();
    pasteIntoLeaf(leafId, text);
  };

  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && clear()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pending?.reason === "large" ? t.largeTitle : t.multiLineTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending
              ? pending.reason === "large"
                ? t.largeDescription(pending.chars)
                : t.multiLineDescription(pending.lines, pending.chars)
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {pending?.preview && (
          <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/50 px-3 py-2">
            <p className="truncate font-mono text-[12px] text-muted-foreground">
              {pending.preview}
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={clear}>
            {messages.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction onClick={confirmPaste}>
            {t.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
