import { beforeEach, describe, expect, it } from "vitest";
import { useTabActivityStore } from "./tabActivityStore";

function state() {
  return useTabActivityStore.getState();
}

describe("tabActivityStore", () => {
  beforeEach(() => {
    useTabActivityStore.setState({
      activeTabs: new Set<number>(),
      runningLeaves: new Set<number>(),
    });
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

  it("tracks command running state per leaf", () => {
    state().setLeafRunning(7, true);
    expect([...state().runningLeaves]).toEqual([7]);

    state().setLeafRunning(7, false);
    expect([...state().runningLeaves]).toEqual([]);
  });

  it("keeps the running set identity when the value does not change", () => {
    state().setLeafRunning(7, true);
    const running = state().runningLeaves;

    state().setLeafRunning(7, true);
    expect(state().runningLeaves).toBe(running);

    state().setLeafRunning(9, false);
    expect(state().runningLeaves).toBe(running);
  });

  it("keeps running state independent from the unread dot", () => {
    state().setLeafRunning(7, true);
    state().markActive(3);
    state().clear(3);

    expect([...state().activeTabs]).toEqual([]);
    expect([...state().runningLeaves]).toEqual([7]);
  });
});
