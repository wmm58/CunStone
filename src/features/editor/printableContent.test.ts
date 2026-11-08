import { describe, expect, it } from "vitest";

import { hasPrintableBlackContent } from "./printableContent";
import type { RgbaImage } from "./imageProcessing";

function image(colors: number[][]): RgbaImage {
  return {
    width: colors.length,
    height: 1,
    data: new Uint8ClampedArray(colors.flat()),
  };
}

describe("hasPrintableBlackContent", () => {
  it("rejects missing source or an all-white base", () => {
    const white = image([
      [255, 255, 255, 255],
      [255, 255, 255, 255],
    ]);

    expect(hasPrintableBlackContent(null, white, null)).toBe(false);
    expect(hasPrintableBlackContent("source", white, null)).toBe(false);
  });

  it("accepts retained black content before border and yin rendering", () => {
    const base = image([
      [255, 255, 255, 255],
      [0, 0, 0, 255],
    ]);

    expect(hasPrintableBlackContent("source", base, null)).toBe(true);
  });

  it("respects a manual overlay that erases the final black content", () => {
    const base = image([[0, 0, 0, 255]]);

    expect(
      hasPrintableBlackContent("source", base, new Uint8Array([2])),
    ).toBe(false);
  });
});
