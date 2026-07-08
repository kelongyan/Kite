import { describe, expect, test } from "vitest";
import {
  conflictDecisionReducer,
  initialConflictDecisionState,
} from "./conflict";

describe("SFTP conflict decision reducer", () => {
  test("opens only when conflicts exist", () => {
    expect(
      conflictDecisionReducer(initialConflictDecisionState, {
        type: "open",
        conflicts: [],
      }),
    ).toEqual(initialConflictDecisionState);

    const state = conflictDecisionReducer(initialConflictDecisionState, {
      type: "open",
      conflicts: [{ name: "app.log", path: "/app.log" }],
    });
    expect(state.open).toBe(true);
    expect(state.policy).toBeNull();
  });

  test("stores the selected policy and closes", () => {
    const opened = conflictDecisionReducer(initialConflictDecisionState, {
      type: "open",
      conflicts: [{ name: "app.log", path: "/app.log" }],
    });

    expect(
      conflictDecisionReducer(opened, { type: "choose", policy: "rename" }),
    ).toMatchObject({ open: false, policy: "rename" });
  });
});
