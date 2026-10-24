export type TerminalLinkActivation = "ctrlClick" | "direct";

// Only these schemes are handed to the OS opener. Everything else a program
// prints (file:, javascript:, custom app schemes) is ignored: the handler runs
// on untrusted terminal output, so the allowlist stays deliberately tiny.
const SAFE_LINK_SCHEMES = new Set(["http", "https", "mailto"]);

const URI_SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;

export function isSafeLinkUri(uri: string): boolean {
  const match = URI_SCHEME_RE.exec(uri.trim());
  if (!match) return false;
  return SAFE_LINK_SCHEMES.has(match[1].toLowerCase());
}

/**
 * `modifierHeld` must come from a pointerdown captured by us: the event xterm
 * hands the activate callback is not reliably the click (addon 0.12 passes the
 * last mousemove), so its modifier keys cannot be trusted.
 */
export function shouldActivateLink(
  modifierHeld: boolean,
  activation: TerminalLinkActivation,
): boolean {
  if (activation === "direct") return true;
  return modifierHeld;
}
