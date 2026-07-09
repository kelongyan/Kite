import { describe, expect, it } from "vitest";
import {
  basename,
  createNavigationState,
  dirname,
  goBack,
  joinRemotePath,
  pushNavigation,
  replaceNavigation,
  splitLocalPath,
  splitRemotePath,
} from "./path";

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

  it("splits local paths into clickable breadcrumb segments", () => {
    expect(splitLocalPath("C:/Users/Admin")).toEqual([
      { label: "C:/", path: "C:/" },
      { label: "Users", path: "C:/Users" },
      { label: "Admin", path: "C:/Users/Admin" },
    ]);
    expect(splitLocalPath("C:\\Users\\Admin")).toEqual([
      { label: "C:\\", path: "C:\\" },
      { label: "Users", path: "C:\\Users" },
      { label: "Admin", path: "C:\\Users\\Admin" },
    ]);
  });

  it("computes basename and dirname for local and remote style paths", () => {
    expect(basename("/home/deploy/app.log")).toBe("app.log");
    expect(basename("C:/Users/Admin/app.log")).toBe("app.log");
    expect(dirname("/home/deploy/app.log")).toBe("/home/deploy");
    expect(dirname("C:/Users/Admin/app.log")).toBe("C:/Users/Admin");
  });

  it("tracks only back history for directory navigation", () => {
    const root = createNavigationState("/");
    const home = pushNavigation(root, "/home");
    const deploy = pushNavigation(home, "/home/deploy");

    expect(deploy).toEqual({
      current: "/home/deploy",
      back: ["/", "/home"],
    });

    const afterBack = goBack(deploy);
    expect(afterBack).toEqual({
      current: "/home",
      back: ["/"],
    });

    const varPath = pushNavigation(afterBack, "/var/www");
    expect(varPath).toEqual({
      current: "/var/www",
      back: ["/", "/home"],
    });

    const replaced = replaceNavigation(varPath, "/srv");
    expect(replaced).toEqual({
      current: "/srv",
      back: [],
    });
  });
});
