import { afterEach, describe, expect, it } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type WorkRecord,
} from "../../domain/types";
import { installCanvasMock } from "../../test/canvasMock";
import type { RgbaImage } from "../editor/imageProcessing";
import {
  createWorkPng,
  getRotatedDimensions,
  normalizeExportRotation,
} from "./workPng";

const source: RgbaImage = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    255, 255, 255, 255,
    0, 0, 0, 255,
    0, 0, 0, 255,
    255, 255, 255, 255,
  ]),
};

function work(borderThickness: number): WorkRecord {
  return {
    id: "work-1",
    ownerId: "user-1",
    name: "边框作品",
    status: "completed",
    createdAt: "2026-11-08T10:00:00.000Z",
    lastSavedAt: "2026-11-08T10:00:00.000Z",
    imageState: {
      ...createDefaultWorkImageState(),
      sourceKind: "upload",
      sourceDataUrl: "source",
      sharpenAmount: 0,
      backgroundRules: [
        { id: "white", color: "#ffffff", tolerance: 0 },
      ],
    },
    binaryState: {
      ...createDefaultWorkBinaryState(),
      borderStyle: "single",
      borderThickness,
    },
  };
}

describe("workPng", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
  });

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

  it("encodes different border thickness as different PDF image bytes", () => {
    canvasMock = installCanvasMock({
      width: 512,
      height: 512,
      dataUrlFromImageData(data) {
        let black = 0;
        for (let offset = 0; offset < data.length; offset += 4) {
          if (data[offset] === 0) {
            black += 1;
          }
        }
        return `data:image/png;base64,${globalThis.btoa(String(black))}`;
      },
    });

    const thin = createWorkPng(work(1), source, 0);
    const thick = createWorkPng(work(8), source, 0);

    expect(thin.bytes).not.toEqual(thick.bytes);
  });
});
