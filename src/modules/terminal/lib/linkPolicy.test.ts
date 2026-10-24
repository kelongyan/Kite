import { describe, expect, it } from "vitest";
import { isSafeLinkUri, shouldActivateLink } from "./linkPolicy";

describe("isSafeLinkUri", () => {
  it("allows http, https, and mailto in any casing", () => {
    expect(isSafeLinkUri("https://example.com/a?b=c")).toBe(true);
    expect(isSafeLinkUri("http://example.com")).toBe(true);
    expect(isSafeLinkUri("HTTPS://EXAMPLE.COM")).toBe(true);
    expect(isSafeLinkUri("mailto:someone@example.com")).toBe(true);
  });

  it("blocks schemes outside the allowlist", () => {
    expect(isSafeLinkUri("javascript:alert(1)")).toBe(false);
    expect(isSafeLinkUri("file:///C:/Windows/System32")).toBe(false);
    expect(isSafeLinkUri("vscode://file/x")).toBe(false);
    expect(isSafeLinkUri("ftp://example.com")).toBe(false);
  });

  it("blocks strings without a scheme", () => {
    expect(isSafeLinkUri("example.com")).toBe(false);
    expect(isSafeLinkUri("")).toBe(false);
    expect(isSafeLinkUri("  https://example.com  ")).toBe(true);
  });
});

describe("shouldActivateLink", () => {
  it("requires the captured modifier in ctrlClick mode", () => {
    expect(shouldActivateLink(false, "ctrlClick")).toBe(false);
    expect(shouldActivateLink(true, "ctrlClick")).toBe(true);
  });

  it("opens on plain click in direct mode", () => {
    expect(shouldActivateLink(false, "direct")).toBe(true);
    expect(shouldActivateLink(true, "direct")).toBe(true);
  });
});
