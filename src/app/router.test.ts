import { describe, expect, it } from "vitest";

import { parseRoute } from "./router";

describe("parseRoute", () => {
  it("maps the supported Change 1 routes", () => {
    expect(parseRoute("#/login")).toEqual({ name: "login" });
    expect(parseRoute("#/editor/new")).toEqual({ name: "editor" });
    expect(parseRoute("#/editor/work-1")).toEqual({
      name: "editor",
      workId: "work-1",
    });
  });

  it("does not expose P3 or P4 routes in Change 1", () => {
    expect(parseRoute("#/works")).toEqual({ name: "login" });
    expect(parseRoute("#/export/a4")).toEqual({ name: "login" });
  });
});
