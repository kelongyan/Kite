import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useTabActivityStore, type LeafCommandState } from "./tabActivityStore";

function state() {
  return useTabActivityStore.getState();
}

describe("tabActivityStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTabActivityStore.setState({
      activeTabs: new Set<number>(),
      leafStates: new Map<number, LeafCommandState>(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks a tab active once and keeps the set identity on repeats", () => {
    // Marked from every PTY chunk of a background tab, so an unchanged set has
    // to stay identical or each chunk would re-render the whole tab bar.
    state().markActive(3);
    const marked = state().activeTabs;
    expect([...marked]).toEqual([3]);

    state().markActive(3);
    expect(state().activeTabs).toBe(marked);
  });

  it("clears a marked tab and ignores one that was never marked", () => {
    state().markActive(3);
    const marked = state().activeTabs;

    state().clear(4);
    expect(state().activeTabs).toBe(marked);

    state().clear(3);
    expect([...state().activeTabs]).toEqual([]);
  });

  it("tracks the working state with its command line per leaf", () => {
    state().setLeafWorking(7, "ping 127.0.0.1");
    expect(state().leafStates.get(7)).toEqual({
      state: "working",
      cmdline: "ping 127.0.0.1",
    });

    // A command without a reported line still shows as working.
    state().setLeafWorking(9);
    expect(state().leafStates.get(9)).toEqual({ state: "working" });
  });

  it("finishes a background command into done or failed", () => {
    state().setLeafWorking(7, "cargo build");
    state().setLeafFinished(7, false);
    expect(state().leafStates.get(7)).toEqual({ state: "done" });

    state().setLeafFinished(8, true);
    expect(state().leafStates.get(8)).toEqual({ state: "failed" });
  });

  it("clears a leaf state and ignores one that was never set", () => {
    state().setLeafWorking(7);
    const states = state().leafStates;

    state().clearLeafState(9);
    expect(state().leafStates).toBe(states);

    state().clearLeafState(7);
    expect(state().leafStates.has(7)).toBe(false);
  });

  it("keeps the state map identity when nothing changes", () => {
    state().setLeafWorking(7, "sleep 5");
    const states = state().leafStates;

    // Same value re-emitted at PTY-chunk rate must not re-render the bar.
    state().setLeafWorking(7, "sleep 5");
    expect(state().leafStates).toBe(states);

    state().setLeafFinished(7, false);
    expect(state().leafStates).not.toBe(states);
  });

  it("keeps working state independent from the unread dot", () => {
    state().setLeafWorking(7);
    state().markActive(3);
    state().clear(3);

    expect([...state().activeTabs]).toEqual([]);
    expect(state().leafStates.get(7)?.state).toBe("working");
  });

  it("clears the bell pulse once after its window", () => {
    state().setLeafBell(5);
    expect(state().leafStates.get(5)?.state).toBe("bell");

    // A newer state arriving inside the window is not cleared.
    state().setLeafWorking(6);
    state().setLeafBell(6);
    state().setLeafWorking(6, "ls");
    vi.advanceTimersByTime(1000);

    expect(state().leafStates.has(5)).toBe(false);
    expect(state().leafStates.get(6)?.state).toBe("working");
  });
});
