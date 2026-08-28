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

type Props = {
  pendingTerminalCloseTab: number | null;
  onCancelTerminalClose: () => void;
  onConfirmTerminalClose: () => void;
};

/** Confirmation dialog for closing terminals with live processes. */
export function CloseDialogs({
  pendingTerminalCloseTab,
  onCancelTerminalClose,
  onConfirmTerminalClose,
}: Props) {
  const messages = useMessages();
  const dialogMessages = messages.mainShell.closeDialogs;
  const cancelLabel = messages.common.cancel;

  return (
    <AlertDialog
      open={pendingTerminalCloseTab !== null}
      onOpenChange={(open) => !open && onCancelTerminalClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogMessages.closeTerminalTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {dialogMessages.terminalProcessDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancelTerminalClose}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmTerminalClose}>
            {dialogMessages.closeAnyway}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
