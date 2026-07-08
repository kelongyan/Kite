import { describe, expect, it } from "vitest";
import { parseSshCommand } from "./sshCommand";

describe("parseSshCommand", () => {
  it("prefills an SFTP profile from ssh user@host", () => {
    expect(parseSshCommand("ssh deploy@example.com")).toEqual({
      name: "example.com",
      host: "example.com",
      port: 22,
      username: "deploy",
      authMethod: "password",
      privateKeyPath: null,
      defaultRemotePath: "/home/deploy",
    });
  });

  it("prefills a custom port from ssh -p", () => {
    expect(parseSshCommand("ssh -p 2222 root@10.0.0.5")).toEqual({
      name: "10.0.0.5",
      host: "10.0.0.5",
      port: 2222,
      username: "root",
      authMethod: "password",
      privateKeyPath: null,
      defaultRemotePath: "/root",
    });
  });
});
