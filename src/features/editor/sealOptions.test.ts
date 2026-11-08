import { describe, expect, it } from "vitest";

import { createDefaultWorkImageState } from "../../domain/types";
import {
  isValidSealDimension,
  sanitizeDimensionInput,
  selectShape,
} from "./sealOptions";

describe("sealOptions", () => {
  it("validates the 10-100 mm dimension range", () => {
    expect(isValidSealDimension(10)).toBe(true);
    expect(isValidSealDimension(100)).toBe(true);
    expect(isValidSealDimension(9.9)).toBe(false);
    expect(isValidSealDimension(100.1)).toBe(false);
    expect(isValidSealDimension(Number.NaN)).toBe(false);
  });

  it("keeps only one decimal separator and numeric characters", () => {
    expect(sanitizeDimensionInput("2a5.5mm")).toBe("25.5");
    expect(sanitizeDimensionInput("2.5.0")).toBe("2.50");
    expect(sanitizeDimensionInput("abc")).toBe("");
  });

  it("switches between the three supported shapes", () => {
    const rectangle = {
      ...createDefaultWorkImageState(),
      shape: "rectangle" as const,
      widthMm: 20,
      heightMm: 30,
    };

    expect(selectShape(rectangle, "circle")).toMatchObject({
      shape: "circle",
      widthMm: 25,
      heightMm: 25,
    });
    expect(selectShape(rectangle, "square")).toMatchObject({
      shape: "square",
      widthMm: 25,
      heightMm: 25,
    });
    expect(selectShape(rectangle, "rectangle")).toMatchObject({
      shape: "rectangle",
      widthMm: 20,
      heightMm: 30,
    });
  });
});
