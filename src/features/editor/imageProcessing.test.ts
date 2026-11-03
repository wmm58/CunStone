import { describe, expect, it } from "vitest";

import { createDefaultWorkImageState } from "../../domain/types";
import {
  colorDistance,
  createCutoutImage,
  createSubjectMask,
  cropMask,
  findMaskBounds,
  fitMaskToShape,
  isBinaryBlackWhite,
  parseHexColor,
  renderBinaryDraft,
  sharpenMask,
  toleranceToDistance,
  type RgbaImage,
} from "./imageProcessing";

function imageFromRows(rows: string[], palette: Record<string, [number, number, number, number]>): RgbaImage {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8ClampedArray(width * height * 4);

  rows.forEach((row, y) => {
    [...row].forEach((token, x) => {
      const color = palette[token];
      data.set(color, (y * width + x) * 4);
    });
  });

  return { width, height, data };
}

const palette: Record<string, [number, number, number, number]> = {
  W: [255, 255, 255, 255],
  B: [0, 0, 0, 255],
  R: [220, 20, 20, 255],
  N: [250, 250, 250, 255],
  T: [0, 0, 0, 0],
  U: [0, 0, 255, 255],
  G: [0, 255, 0, 255],
};

describe("imageProcessing", () => {
  it("parses colors and maps tolerance to RGB distance", () => {
    expect(parseHexColor("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("#abc")).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseHexColor("not-a-color")).toBeNull();
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 })).toBe(0);
    expect(toleranceToDistance(0)).toBe(0);
    expect(toleranceToDistance(100)).toBeCloseTo(Math.sqrt(3) * 255, 5);
  });

  it("removes only pixels within the selected background tolerance", () => {
    const source = imageFromRows(["WNN", "WRN", "WWW"], palette);
    const exact = createSubjectMask(source, "#ffffff", 0);
    const wide = createSubjectMask(source, "#ffffff", 100);

    expect([...exact]).toEqual([0, 1, 1, 0, 1, 1, 0, 0, 0]);
    expect([...wide]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("supports blue and green solid backgrounds", () => {
    const blue = imageFromRows(
      ["UUU", "UGR", "UUU"],
      palette,
    );
    const green = imageFromRows(
      ["GGG", "GUG", "GGG"],
      palette,
    );

    expect([...createSubjectMask(blue, "#0000ff", 0)]).toEqual([
      0, 0, 0, 0, 1, 1, 0, 0, 0,
    ]);
    expect([...createSubjectMask(green, "#00ff00", 0)]).toEqual([
      0, 0, 0, 0, 1, 0, 0, 0, 0,
    ]);
  });

  it("finds and crops the visible-content bounds", () => {
    const mask = new Uint8Array([
      0, 0, 0, 0,
      0, 1, 1, 0,
      0, 1, 0, 0,
      0, 0, 0, 0,
    ]);
    const bounds = findMaskBounds(mask, 4, 4);
    expect(bounds).toEqual({ x: 1, y: 1, width: 2, height: 2 });
    expect(cropMask(mask, 4, 4, bounds!)).toEqual({
      width: 2,
      height: 2,
      mask: new Uint8Array([1, 1, 1, 0]),
    });
  });

  it("handles an empty mask and a single visible pixel", () => {
    expect(findMaskBounds(new Uint8Array(9), 3, 3)).toBeNull();

    const single = new Uint8Array(9);
    single[4] = 1;
    const bounds = findMaskBounds(single, 3, 3);

    expect(bounds).toEqual({ x: 1, y: 1, width: 1, height: 1 });
    expect(cropMask(single, 3, 3, bounds!)).toEqual({
      width: 1,
      height: 1,
      mask: new Uint8Array([1]),
    });
  });

  it("treats transparent source pixels as background", () => {
    const source = imageFromRows(["WTW"], palette);

    expect([...createSubjectMask(source, null, 20)]).toEqual([1, 0, 1]);
  });

  it("sharpens a binary mask without producing intermediate values", () => {
    const mask = new Uint8Array([
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ]);
    const sharpened = sharpenMask(mask, 3, 3);

    expect([...sharpened].every((value) => value === 0 || value === 1)).toBe(true);
  });

  it("fits content inside square and circular seal bounds", () => {
    const mask = new Uint8Array([
      0, 1, 0,
      1, 1, 1,
      0, 1, 0,
    ]);
    const square = fitMaskToShape(mask, 3, 3, "square", 25, 25, 9);
    const circle = fitMaskToShape(mask, 3, 3, "circle", 25, 25, 9);

    expect(square).toMatchObject({ width: 9, height: 9 });
    expect(circle).toMatchObject({ width: 9, height: 9 });
    expect(square.mask.some((value) => value === 1)).toBe(true);
    expect(circle.mask.some((value) => value === 1)).toBe(true);
    expect(circle.mask[0]).toBe(0);
  });

  it("uses the requested rectangle and custom aspect ratios", () => {
    const mask = new Uint8Array(9).fill(1);
    const rectangle = fitMaskToShape(mask, 3, 3, "rectangle", 20, 40, 80);
    const custom = fitMaskToShape(mask, 3, 3, "custom", 30, 10, 90);

    expect(rectangle).toMatchObject({ width: 40, height: 80 });
    expect(custom).toMatchObject({ width: 90, height: 30 });
  });

  it("creates a transparent cutout preserving subject colors", () => {
    const source = imageFromRows(["WRW"], palette);
    const cutout = createCutoutImage(source, "#ffffff", 0);

    expect(cutout.data[3]).toBe(0);
    expect([...cutout.data.slice(4, 8)]).toEqual([220, 20, 20, 255]);
    expect(cutout.data[11]).toBe(0);
  });

  it("renders silhouette and outline drafts as pure black and white", () => {
    const source = imageFromRows(
      ["WWWW", "WRRW", "WRRW", "WWWW"],
      palette,
    );
    const base = {
      ...createDefaultWorkImageState(),
      backgroundColor: "#ffffff",
      tolerance: 10,
      widthMm: 25,
      heightMm: 25,
    };

    const silhouette = renderBinaryDraft(source, {
      ...base,
      effectMode: "silhouette",
    });
    const outline = renderBinaryDraft(source, {
      ...base,
      effectMode: "outline",
    });

    expect(isBinaryBlackWhite(silhouette)).toBe(true);
    expect(isBinaryBlackWhite(outline)).toBe(true);
    expect(silhouette.data).toContain(0);
    expect(silhouette.data).toContain(255);
  });

  it("keeps the hole in an outline draft and returns blank white when nothing remains", () => {
    const ring = imageFromRows(
      ["WWWWW", "WBBBW", "WBWBW", "WBBBW", "WWWWW"],
      palette,
    );
    const state = {
      ...createDefaultWorkImageState(),
      backgroundColor: "#ffffff",
      tolerance: 0,
      effectMode: "outline" as const,
    };
    const outline = renderBinaryDraft(ring, state);
    const centerOffset = (256 * outline.width + 256) * 4;

    expect([...outline.data.slice(centerOffset, centerOffset + 4)]).toEqual([
      255, 255, 255, 255,
    ]);
    expect(outline.data).toContain(0);
    expect(isBinaryBlackWhite(outline)).toBe(true);

    const blank = renderBinaryDraft(
      imageFromRows(["WWW", "WWW", "WWW"], palette),
      state,
    );
    expect(isBinaryBlackWhite(blank)).toBe(true);
    expect(
      Array.from({ length: blank.data.length / 4 }, (_, index) => index).every(
        (index) => blank.data[index * 4] === 255,
      ),
    ).toBe(true);
  });
});
