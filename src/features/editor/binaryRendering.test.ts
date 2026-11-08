import { describe, expect, it } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
} from "../../domain/types";
import { applyBorder, createGenerationSignature, invertBinary, mirrorBinary, renderFinalBinary } from "./binaryRendering";
import type { RgbaImage } from "./imageProcessing";

function image(width: number, height: number, white = true): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.set(white ? [255, 255, 255, 255] : [0, 0, 0, 255], offset);
  }
  return { width, height, data };
}

function blackCount(target: RgbaImage): number {
  let count = 0;
  for (let offset = 0; offset < target.data.length; offset += 4) {
    if (target.data[offset] === 0) {
      count += 1;
    }
  }
  return count;
}

describe("binaryRendering", () => {
  it("inverts and mirrors without changing dimensions", () => {
    const source = image(3, 1);
    source.data.set([0, 0, 0, 255], 0);
    source.data.set([255, 255, 255, 255], 4);
    source.data.set([0, 0, 0, 255], 8);

    const inverted = invertBinary(source);
    expect([...inverted.data.slice(0, 4)]).toEqual([255, 255, 255, 255]);
    expect(inverted.width).toBe(3);
    expect(inverted.height).toBe(1);

    const mirrored = mirrorBinary(source);
    expect([...mirrored.data.slice(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...mirrored.data.slice(4, 8)]).toEqual([255, 255, 255, 255]);
  });

  it("renders distinct none, single and double borders", () => {
    const source = image(80, 80);
    const none = applyBorder(source, "none", "square");
    const single = applyBorder(source, "single", "square");
    const double = applyBorder(source, "double", "square");

    expect(blackCount(none)).toBe(0);
    expect(blackCount(single)).toBeGreaterThan(0);
    expect(blackCount(double)).toBeGreaterThan(blackCount(single));
  });

  it("uses the saved border thickness for single and double borders", () => {
    const source = image(80, 80);
    const single1 = applyBorder(source, "single", "square", 1);
    const single8 = applyBorder(source, "single", "square", 8);
    const double8 = applyBorder(source, "double", "square", 8);

    expect(blackCount(single8)).toBeGreaterThan(blackCount(single1));
    expect(blackCount(double8)).toBeGreaterThan(blackCount(single8));
  });

  it("moves the border inward using millimetres from the canvas edge", () => {
    const source = image(80, 80);
    const bordered = applyBorder(source, "single", "square", 2, 5, 20, 20);
    const rowOffset = 40 * 80 * 4;

    expect(bordered.data[rowOffset]).toBe(255);
    expect(bordered.data[rowOffset + 20 * 4]).toBe(0);
    expect(bordered.data[rowOffset + 58 * 4]).toBe(0);
  });

  it("renders deterministic broken borders", () => {
    const source = image(64, 64);
    const first = applyBorder(source, "broken", "square");
    const second = applyBorder(source, "broken", "square");

    expect(first.data).toEqual(second.data);
    expect(first.data).not.toEqual(applyBorder(source, "single", "square").data);
  });

  it("keeps circular border pixels inside the circle", () => {
    const source = image(80, 80);
    const bordered = applyBorder(source, "single", "circle");

    expect(bordered.data[(0 * 80 + 0) * 4]).toBe(255);
    expect(bordered.data[(0 * 80 + 79) * 4]).toBe(255);
    expect(blackCount(bordered)).toBeGreaterThan(0);
  });

  it("creates stable signatures and changes when processing inputs change", () => {
    const base = createDefaultWorkImageState();
    const changed = { ...base, sourceDataUrl: "data:image/png;base64,AAAA" };
    const same = { ...base, sourceDataUrl: "data:image/png;base64,AAAA" };

    expect(createGenerationSignature(changed)).toBe(createGenerationSignature(same));
    expect(createGenerationSignature(base)).not.toBe(createGenerationSignature(changed));
    const variants = [
      { ...changed, shape: "circle" as const },
      { ...changed, widthMm: 26 },
      { ...changed, heightMm: 26 },
      {
        ...changed,
        backgroundRules: [
          { id: "white", color: "#ffffff", tolerance: 20 },
        ],
      },
      { ...changed, effectMode: "outline" as const },
    ];
    for (const variant of variants) {
      expect(createGenerationSignature(variant)).not.toBe(
        createGenerationSignature(changed),
      );
    }
  });

  it("renders the full pipeline as pure black and white", () => {
    const base = image(16, 16);
    base.data.set([0, 0, 0, 255], (8 * 16 + 8) * 4);
    const binary = {
      ...createDefaultWorkBinaryState(),
      carvingMode: "yin" as const,
      orientation: "mirror" as const,
      borderStyle: "double" as const,
    };

    const result = renderFinalBinary(
      base,
      new Uint8Array(16 * 16),
      binary,
      "square",
      20,
      20,
    );

    expect(result.width).toBe(16);
    for (let offset = 0; offset < result.data.length; offset += 4) {
      expect(result.data[offset]).toBe(result.data[offset + 1]);
      expect(result.data[offset]).toBe(result.data[offset + 2]);
      expect([0, 255]).toContain(result.data[offset]);
      expect(result.data[offset + 3]).toBe(255);
    }
  });
});
