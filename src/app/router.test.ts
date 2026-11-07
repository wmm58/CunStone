import { describe, expect, it } from "vitest";

import { parseRoute } from "./router";

describe("parseRoute", () => {
  it("maps the supported application routes", () => {
    expect(parseRoute("#/login")).toEqual({ name: "login" });
    expect(parseRoute("#/works")).toEqual({ name: "works" });
    expect(parseRoute("#/editor/new")).toEqual({ name: "editor" });
    expect(parseRoute("#/editor/work-1")).toEqual({
      name: "editor",
      workId: "work-1",
    });
  });

  it("does not expose the P4 route before Change 5", () => {
    expect(parseRoute("#/export/a4")).toEqual({ name: "login" });
  });
});
