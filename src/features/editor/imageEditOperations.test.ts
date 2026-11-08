import { describe, expect, it } from "vitest";

import {
  cropRaster,
  eraseRasterStroke,
  perspectiveCropRaster,
  type RasterPoint,
} from "./imageEditOperations";
import type { RgbaImage } from "./imageProcessing";

function image(width: number, height: number, colorAt: (x: number, y: number) => number[]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(colorAt(x, y), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

describe("imageEditOperations", () => {
  it("crops the selected rectangle", () => {
    const source = image(4, 4, (x, y) => [x * 10, y * 10, 0, 255]);
    const crop = cropRaster(source, { x: 1, y: 2, width: 2, height: 1 });

    expect(crop).toMatchObject({ width: 2, height: 1 });
    expect([...crop.data]).toEqual([
      10, 20, 0, 255,
      20, 20, 0, 255,
    ]);
  });

  it("erases a circular stroke with the selected size", () => {
    const source = image(9, 9, () => [255, 255, 255, 255]);
    const erased = eraseRasterStroke(
      source,
      { x: 2, y: 4 },
      { x: 6, y: 4 },
      3,
    );

    expect(erased.data[(4 * 9 + 2) * 4 + 3]).toBe(0);
    expect(erased.data[(4 * 9 + 4) * 4 + 3]).toBe(0);
    expect(erased.data[(4 * 9 + 6) * 4 + 3]).toBe(0);
    expect(erased.data[(0 * 9 + 0) * 4 + 3]).toBe(255);
  });

  it("perspective-crops a quadrilateral into a rectangle", () => {
    const source = image(7, 7, (x) =>
      x < 4 ? [220, 20, 20, 255] : [0, 0, 255, 255],
    );
    const points: [RasterPoint, RasterPoint, RasterPoint, RasterPoint] = [
      { x: 1, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: 6 },
      { x: 0, y: 6 },
    ];
    const corrected = perspectiveCropRaster(source, points);
    const pixel = (x: number, y: number) => {
      const offset = (y * corrected.width + x) * 4;
      return [...corrected.data.slice(offset, offset + 4)];
    };

    expect(corrected).toMatchObject({ width: 5, height: 6 });
    expect(pixel(0, 0)).toEqual([220, 20, 20, 255]);
    expect(pixel(4, 0)).toEqual([0, 0, 255, 255]);
    expect(pixel(0, 5)).toEqual([220, 20, 20, 255]);
    expect(pixel(4, 5)).toEqual([0, 0, 255, 255]);
  });
});
