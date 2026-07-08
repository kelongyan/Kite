import { describe, expect, it } from "vitest";
import { basename, dirname, joinRemotePath, splitRemotePath } from "./path";

describe("SFTP path helpers", () => {
  it("joins remote paths without losing the absolute root", () => {
    expect(joinRemotePath("/", "app.log")).toBe("/app.log");
    expect(joinRemotePath("/home/deploy", "app.log")).toBe(
      "/home/deploy/app.log",
    );
  });

  it("splits remote paths into clickable breadcrumb segments", () => {
    expect(splitRemotePath("/")).toEqual([{ label: "/", path: "/" }]);
    expect(splitRemotePath("/home/deploy/releases")).toEqual([
      { label: "/", path: "/" },
      { label: "home", path: "/home" },
      { label: "deploy", path: "/home/deploy" },
      { label: "releases", path: "/home/deploy/releases" },
    ]);
  });

  it("computes basename and dirname for local and remote style paths", () => {
    expect(basename("/home/deploy/app.log")).toBe("app.log");
    expect(basename("C:/Users/Admin/app.log")).toBe("app.log");
    expect(dirname("/home/deploy/app.log")).toBe("/home/deploy");
    expect(dirname("C:/Users/Admin/app.log")).toBe("C:/Users/Admin");
  });
});
