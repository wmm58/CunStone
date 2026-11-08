import { describe, expect, it } from "vitest";

import { parseRoute } from "./router";

describe("parseRoute", () => {
  it("maps the supported application routes", () => {
    expect(parseRoute("#/login")).toEqual({ name: "editor" });
    expect(parseRoute("")).toEqual({ name: "editor" });
    expect(parseRoute("#/")).toEqual({ name: "editor" });
    expect(parseRoute("#/works")).toEqual({ name: "works" });
    expect(parseRoute("#/export/a4")).toEqual({ name: "exportA4" });
    expect(parseRoute("#/editor/new")).toEqual({ name: "editor" });
    expect(parseRoute("#/editor/work-1")).toEqual({
      name: "editor",
      workId: "work-1",
    });
  });

  it("falls back to the editor for unsupported routes", () => {
    expect(parseRoute("#/unknown")).toEqual({ name: "editor" });
  });
});
