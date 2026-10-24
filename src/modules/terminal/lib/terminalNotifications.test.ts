import { describe, expect, it } from "vitest";
import { shouldDeliverTerminalNotification } from "./terminalNotifications";

describe("shouldDeliverTerminalNotification", () => {
  it("stays silent while the user is watching the pane", () => {
    expect(
      shouldDeliverTerminalNotification({
        windowFocused: true,
        tabActive: true,
      }),
    ).toBe(false);
  });

  it("notifies for background tabs and unfocused windows", () => {
    expect(
      shouldDeliverTerminalNotification({ windowFocused: true, tabActive: false }),
    ).toBe(true);
    expect(
      shouldDeliverTerminalNotification({ windowFocused: false, tabActive: true }),
    ).toBe(true);
    expect(
      shouldDeliverTerminalNotification({ windowFocused: false, tabActive: false }),
    ).toBe(true);
  });
});
