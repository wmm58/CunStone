import { describe, expect, it } from "vitest";

import {
  applyManualOverlay,
  createEmptyOverlay,
  getNeutralOverlayValue,
  hasManualEdits,
  mapFinalPointToNeutral,
  paintStroke,
  recordStrokeHistory,
  redoOverlay,
  undoOverlay,
} from "./binaryEditing";
import type { RgbaImage } from "./imageProcessing";

function image(width: number, height: number, white = true): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.set(white ? [255, 255, 255, 255] : [0, 0, 0, 255], offset);
  }
  return { width, height, data };
}

describe("binaryEditing", () => {
  it("creates an empty overlay and detects manual edits", () => {
    expect(hasManualEdits(createEmptyOverlay(3, 3))).toBe(false);
    expect(hasManualEdits(new Uint8Array([0, 1, 0]))).toBe(true);
  });

  it("applies forced black and forced white overlay values", () => {
    const base = image(2, 1);
    const overlay = new Uint8Array([1, 2]);
    const result = applyManualOverlay(base, overlay);

    expect([...result.data.slice(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...result.data.slice(4, 8)]).toEqual([255, 255, 255, 255]);
  });

  it("maps final pointer coordinates and tool colors through yin and mirror", () => {
    expect(mapFinalPointToNeutral({ x: 1, y: 2 }, 4, false)).toEqual({ x: 1, y: 2 });
    expect(mapFinalPointToNeutral({ x: 1, y: 2 }, 4, true)).toEqual({ x: 2, y: 2 });
    expect(getNeutralOverlayValue("brush", "yang")).toBe(1);
    expect(getNeutralOverlayValue("brush", "yin")).toBe(2);
    expect(getNeutralOverlayValue("eraser", "yang")).toBe(2);
    expect(getNeutralOverlayValue("eraser", "yin")).toBe(1);
  });

  it("rasterizes continuous strokes with width and clipping", () => {
    const overlay = createEmptyOverlay(12, 12);
    const line = paintStroke(
      overlay,
      12,
      12,
      { x: 1, y: 2 },
      { x: 10, y: 2 },
      3,
      1,
    );

    expect(line[2 * 12 + 1]).toBe(1);
    expect(line[2 * 12 + 5]).toBe(1);
    expect(line[2 * 12 + 10]).toBe(1);
    expect(line[1 * 12 + 5]).toBe(1);
    expect(line.filter((value) => value === 1).length).toBeGreaterThan(10);

    const clipped = paintStroke(
      createEmptyOverlay(5, 5),
      5,
      5,
      { x: -10, y: 2 },
      { x: 10, y: 2 },
      2,
      2,
    );
    expect(clipped).toHaveLength(25);
    expect(clipped.every((value) => value === 0 || value === 2)).toBe(true);
  });

  it("keeps single-point strokes and different widths visible", () => {
    const thin = paintStroke(
      createEmptyOverlay(9, 9),
      9,
      9,
      { x: 4, y: 4 },
      { x: 4, y: 4 },
      1,
      1,
    );
    const thick = paintStroke(
      createEmptyOverlay(9, 9),
      9,
      9,
      { x: 4, y: 4 },
      { x: 4, y: 4 },
      5,
      1,
    );

    expect(thin[4 * 9 + 4]).toBe(1);
    expect(thick.filter((value) => value === 1).length).toBeGreaterThan(
      thin.filter((value) => value === 1).length,
    );
  });

  it("supports undo, redo, redo reset and 20-snapshot retention", () => {
    let history = recordStrokeHistory({ undo: [], redo: [] }, "a");
    expect(history.undo).toEqual(["a"]);

    const undone = undoOverlay(history, "b");
    expect(undone?.snapshot).toBe("a");
    expect(undone?.history.redo).toEqual(["b"]);

    const redone = redoOverlay(undone!.history, "a");
    expect(redone?.snapshot).toBe("b");

    history = recordStrokeHistory(redone!.history, "c");
    expect(history.redo).toEqual([]);

    for (let index = 0; index < 25; index += 1) {
      history = recordStrokeHistory(history, `s${index}`);
    }
    expect(history.undo).toHaveLength(20);
    expect(history.undo[0]).toBe("s5");
  });
});
