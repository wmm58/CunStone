import { describe, expect, it } from "vitest";

import {
  createDefaultWorkImageState,
  type BackgroundRemovalRule,
} from "../../domain/types";
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

function rule(
  id: string,
  color: string | null,
  tolerance: number,
): BackgroundRemovalRule {
  return { id, color, tolerance };
}

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
    const exact = createSubjectMask(source, [rule("white", "#ffffff", 0)]);
    const wide = createSubjectMask(source, [rule("white", "#ffffff", 100)]);

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

    expect([...createSubjectMask(blue, [rule("blue", "#0000ff", 0)])]).toEqual([
      0, 0, 0, 0, 1, 1, 0, 0, 0,
    ]);
    expect([...createSubjectMask(green, [rule("green", "#00ff00", 0)])]).toEqual([
      0, 0, 0, 0, 1, 0, 0, 0, 0,
    ]);
  });

  it("removes the union of multiple backgrounds and ignores empty rules", () => {
    const source = imageFromRows(
      ["WUW", "WGR", "WUW"],
      palette,
    );
    const rules = [
      rule("empty", null, 100),
      rule("white", "#ffffff", 0),
      rule("blue", "#0000ff", 0),
    ];

    expect([...createSubjectMask(source, rules)]).toEqual([
      0, 0, 0,
      0, 1, 1,
      0, 0, 0,
    ]);
    expect([...createSubjectMask(source, [])]).toEqual(new Array(9).fill(1));
  });

  it("supports ten rules and produces the same union regardless of order", () => {
    const colors = [
      "#ffffff",
      "#0000ff",
      "#00ff00",
      "#ff0000",
      "#fafafa",
      "#000001",
      "#00ff01",
      "#ff0001",
      "#fafafb",
      "#000002",
    ];
    const source = imageFromRows(
      ["WUR", "NGT", "WUR"],
      palette,
    );
    const rules = colors.map((color, index) => rule(`rule-${index}`, color, 10));
    const reversed = [...rules].reverse();

    expect([...createSubjectMask(source, rules)]).toEqual([
      0, 0, 1,
      0, 0, 0,
      0, 0, 1,
    ]);
    expect([...createSubjectMask(source, reversed)]).toEqual(
      [...createSubjectMask(source, rules)],
    );
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

    expect([...createSubjectMask(source, [])]).toEqual([1, 0, 1]);
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

  it("applies sharpen amount from zero to eight without gray pixels", () => {
    const mask = new Uint8Array([
      0, 0, 0, 0, 0,
      0, 1, 1, 1, 0,
      0, 1, 0, 1, 0,
      0, 1, 1, 1, 0,
      0, 0, 0, 0, 0,
    ]);
    const none = sharpenMask(mask, 5, 5, 0);
    const strong = sharpenMask(mask, 5, 5, 8);

    expect([...none]).toEqual([...mask]);
    expect([...strong].every((value) => value === 0 || value === 1)).toBe(true);
    expect([...strong]).not.toEqual([...none]);
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

  it("uses the requested rectangle aspect ratio", () => {
    const mask = new Uint8Array(9).fill(1);
    const rectangle = fitMaskToShape(mask, 3, 3, "rectangle", 20, 40, 80);

    expect(rectangle).toMatchObject({ width: 40, height: 80 });
  });

  it("shrinks fitted content as the outer margin increases", () => {
    const mask = new Uint8Array(9).fill(1);
    const noMargin = fitMaskToShape(mask, 3, 3, "square", 25, 25, 80, 0);
    const largeMargin = fitMaskToShape(mask, 3, 3, "square", 25, 25, 80, 20);
    const countBlack = (target: Uint8Array) =>
      [...target].filter((value) => value === 1).length;

    expect(countBlack(largeMargin.mask)).toBeLessThan(
      countBlack(noMargin.mask),
    );
  });

  it("uses millimetres for outer margin and reaches the edge at zero", () => {
    const mask = new Uint8Array(9).fill(1);
    const noMargin = fitMaskToShape(mask, 3, 3, "square", 20, 20, 80, 0);
    const fiveMillimetres = fitMaskToShape(
      mask,
      3,
      3,
      "square",
      20,
      20,
      80,
      5,
    );

    expect(noMargin.mask[0]).toBe(1);
    expect(noMargin.mask[80 * 40 + 0]).toBe(1);
    expect(fiveMillimetres.mask[80 * 40 + 19]).toBe(0);
    expect(fiveMillimetres.mask[80 * 40 + 20]).toBe(1);
    expect(fiveMillimetres.mask[80 * 40 + 59]).toBe(1);
    expect(fiveMillimetres.mask[80 * 40 + 60]).toBe(0);
  });

  it("creates a transparent cutout preserving subject colors", () => {
    const source = imageFromRows(["WRW"], palette);
    const cutout = createCutoutImage(source, [rule("white", "#ffffff", 0)]);

    expect(cutout.data[3]).toBe(0);
    expect([...cutout.data.slice(4, 8)]).toEqual([220, 20, 20, 255]);
    expect(cutout.data[11]).toBe(0);
  });

  it("applies the same multi-background union to cutouts", () => {
    const source = imageFromRows(["WUR"], palette);
    const rules = [
      rule("white", "#ffffff", 0),
      rule("blue", "#0000ff", 0),
    ];
    const cutout = createCutoutImage(source, rules);

    expect(cutout.data[3]).toBe(0);
    expect(cutout.data[7]).toBe(0);
    expect([...cutout.data.slice(8, 12)]).toEqual([220, 20, 20, 255]);

    const restored = createCutoutImage(source, []);
    expect([...restored.data]).toEqual([...source.data]);
  });

  it("renders silhouette and outline drafts as pure black and white", () => {
    const source = imageFromRows(
      ["WWWW", "WRRW", "WRRW", "WWWW"],
      palette,
    );
    const base = {
      ...createDefaultWorkImageState(),
      backgroundRules: [rule("white", "#ffffff", 10)],
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

  it("renders thicker outlines with more black pixels at levels 1 to 8", () => {
    const source = imageFromRows(
      ["WWWWW", "WBBBW", "WBBBW", "WBBBW", "WWWWW"],
      palette,
    );
    const state = {
      ...createDefaultWorkImageState(),
      backgroundRules: [rule("white", "#ffffff", 0)],
      effectMode: "outline" as const,
    };
    const thin = renderBinaryDraft(source, {
      ...state,
      outlineThickness: 1,
    });
    const thick = renderBinaryDraft(source, {
      ...state,
      outlineThickness: 8,
    });
    const blackCount = (image: typeof thin) =>
      Array.from({ length: image.data.length / 4 }, (_, index) =>
        image.data[index * 4],
      ).filter((value) => value === 0).length;

    expect(blackCount(thick)).toBeGreaterThan(blackCount(thin));
    expect(isBinaryBlackWhite(thin)).toBe(true);
    expect(isBinaryBlackWhite(thick)).toBe(true);
  });

  it("keeps the hole in an outline draft and returns blank white when nothing remains", () => {
    const ring = imageFromRows(
      ["WWWWW", "WBBBW", "WBWBW", "WBBBW", "WWWWW"],
      palette,
    );
    const state = {
      ...createDefaultWorkImageState(),
      backgroundRules: [rule("white", "#ffffff", 0)],
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
