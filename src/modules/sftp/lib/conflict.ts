import type { SftpConflictPolicy } from "@/modules/sftp/lib/types";
import type { SelectableEntry } from "@/modules/sftp/lib/selection";

export type ConflictDecisionState = {
  open: boolean;
  conflicts: SelectableEntry[];
  policy: SftpConflictPolicy | null;
};

export type ConflictDecisionAction =
  | { type: "open"; conflicts: SelectableEntry[] }
  | { type: "choose"; policy: SftpConflictPolicy }
  | { type: "cancel" };

export const initialConflictDecisionState: ConflictDecisionState = {
  open: false,
  conflicts: [],
  policy: null,
};

export function conflictDecisionReducer(
  state: ConflictDecisionState,
  action: ConflictDecisionAction,
): ConflictDecisionState {
  switch (action.type) {
    case "open":
      return {
        open: action.conflicts.length > 0,
        conflicts: action.conflicts,
        policy: null,
      };
    case "choose":
      return {
        ...state,
        open: false,
        policy: action.policy,
      };
    case "cancel":
      return initialConflictDecisionState;
  }
}
