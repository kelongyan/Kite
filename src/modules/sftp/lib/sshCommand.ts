import type { SftpProfileTemplate } from "./types";

export function parseSshCommand(command: string): SftpProfileTemplate | null {
  const tokens = tokenize(command);
  if (tokens.length < 2 || tokens[0] !== "ssh") return null;

  let port = 22;
  let username = "";
  let privateKeyPath: string | null = null;
  let target: string | null = null;

  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "-p") {
      const parsed = parsePort(tokens[i + 1]);
      if (parsed === null) return null;
      port = parsed;
      i += 1;
      continue;
    }
    if (token.startsWith("-p") && token.length > 2) {
      const parsed = parsePort(token.slice(2));
      if (parsed === null) return null;
      port = parsed;
      continue;
    }
    if (token === "-l") {
      username = tokens[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "-i") {
      privateKeyPath = tokens[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token.startsWith("-")) {
      continue;
    }
    target = token;
    break;
  }

  if (!target) return null;
  const at = target.lastIndexOf("@");
  const host = at >= 0 ? target.slice(at + 1) : target;
  const targetUser = at >= 0 ? target.slice(0, at) : "";
  username = username || targetUser;

  if (!isSafeText(host) || !isSafeText(username)) return null;

  return {
    name: host,
    host,
    port,
    username,
    authMethod: privateKeyPath ? "privateKey" : "password",
    privateKeyPath,
    defaultRemotePath: defaultRemotePath(username),
  };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of input.trim()) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function parsePort(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const port = Number(value);
  return port >= 1 && port <= 65535 ? port : null;
}

function isSafeText(value: string): boolean {
  return value.trim().length > 0 && !/[\/\\\0\s]/.test(value);
}

function defaultRemotePath(username: string): string {
  if (username === "root") return "/root";
  return `/home/${username}`;
}
