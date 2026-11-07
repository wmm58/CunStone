import { describe, expect, it } from "vitest";

import { getRotatedDimensions, normalizeExportRotation } from "./workPng";

describe("workPng", () => {
  it("swaps dimensions for quarter turns", () => {
    expect(getRotatedDimensions(40, 20, 0)).toEqual({
      widthMm: 40,
      heightMm: 20,
    });
    expect(getRotatedDimensions(40, 20, 90)).toEqual({
      widthMm: 20,
      heightMm: 40,
    });
    expect(getRotatedDimensions(40, 20, 180)).toEqual({
      widthMm: 40,
      heightMm: 20,
    });
    expect(getRotatedDimensions(40, 20, 270)).toEqual({
      widthMm: 20,
      heightMm: 40,
    });
  });

  it("normalizes export rotation to quarter turns", () => {
    expect(normalizeExportRotation(-90)).toBe(270);
    expect(normalizeExportRotation(450)).toBe(90);
  });
});
