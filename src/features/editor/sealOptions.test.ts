import { describe, expect, it } from "vitest";

import { createDefaultWorkImageState } from "../../domain/types";
import {
  applyRecommendation,
  isValidSealDimension,
  recommendationsForShape,
  selectShape,
} from "./sealOptions";

describe("sealOptions", () => {
  it("provides recommended sizes for each shape", () => {
    expect(recommendationsForShape("square")).toEqual([
      { widthMm: 20, heightMm: 20, label: "20 mm" },
      { widthMm: 25, heightMm: 25, label: "25 mm" },
      { widthMm: 30, heightMm: 30, label: "30 mm" },
    ]);
    expect(recommendationsForShape("rectangle")[0]).toEqual({
      widthMm: 15,
      heightMm: 30,
      label: "15×30 mm",
    });
    expect(recommendationsForShape("circle")[1]).toEqual({
      widthMm: 25,
      heightMm: 25,
      label: "Ø25 mm",
    });
    expect(recommendationsForShape("custom")).toEqual([]);
  });

  it("validates the 10-100 mm dimension range", () => {
    expect(isValidSealDimension(10)).toBe(true);
    expect(isValidSealDimension(100)).toBe(true);
    expect(isValidSealDimension(9.9)).toBe(false);
    expect(isValidSealDimension(100.1)).toBe(false);
    expect(isValidSealDimension(Number.NaN)).toBe(false);
  });

  it("applies a recommended size", () => {
    const state = createDefaultWorkImageState();
    expect(applyRecommendation(state, 20, 30)).toMatchObject({
      widthMm: 20,
      heightMm: 30,
    });
  });

  it("switches shapes while keeping valid dimensions where possible", () => {
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
    expect(selectShape(rectangle, "custom")).toMatchObject({
      shape: "custom",
      widthMm: 20,
      heightMm: 30,
    });
  });
});
