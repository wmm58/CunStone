import { beforeEach, describe, expect, it } from "vitest";

import {
  peekExportWorkIds,
  setExportWorkIds,
  takeExportWorkIds,
} from "./exportSession";

describe("exportSession", () => {
  beforeEach(() => {
    setExportWorkIds([]);
  });

  it("stores unique work ids in memory and can be consumed once", () => {
    setExportWorkIds(["work-1", "work-1", "work-2"]);

    expect(peekExportWorkIds()).toEqual(["work-1", "work-2"]);
    expect(takeExportWorkIds()).toEqual(["work-1", "work-2"]);
    expect(takeExportWorkIds()).toEqual([]);
  });
});
