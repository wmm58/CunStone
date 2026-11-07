import { describe, expect, it } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type WorkRecord,
} from "../../domain/types";
import type { RgbaImage } from "../editor/imageProcessing";
import { renderRedImpression, renderWorkBlackWhite } from "./workPreview";

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

function work(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: "work-1",
    ownerId: "user-1",
    name: "预览作品",
    status: "completed",
    createdAt: "2026-11-07T10:00:00.000Z",
    lastSavedAt: "2026-11-07T10:00:00.000Z",
    imageState: createDefaultWorkImageState(),
    binaryState: createDefaultWorkBinaryState(),
    ...overrides,
  };
}

describe("workPreview", () => {
  it("rebuilds a pure black-white preview from saved work state", () => {
    const preview = renderWorkBlackWhite(work(), source);

    expect(preview.width).toBe(512);
    expect(preview.height).toBe(512);
    let invalidPixels = 0;
    for (let offset = 0; offset < preview.data.length; offset += 4) {
      if (
        ![0, 255].includes(preview.data[offset]) ||
        preview.data[offset + 3] !== 255
      ) {
        invalidPixels += 1;
      }
    }
    expect(invalidPixels).toBe(0);
  });

  it("maps black pixels to clean red and keeps white pixels white", () => {
    const blackWhite = renderWorkBlackWhite(
      work({ imageState: { ...createDefaultWorkImageState(), sourceDataUrl: "source" } }),
      source,
    );
    const red = renderRedImpression(blackWhite);
    let black = 0;
    let white = 0;
    let invalid = 0;

    for (let offset = 0; offset < red.data.length; offset += 4) {
      if (blackWhite.data[offset] === 0) {
        if (
          red.data[offset] === 198 &&
          red.data[offset + 1] === 40 &&
          red.data[offset + 2] === 40 &&
          red.data[offset + 3] === 255
        ) {
          black += 1;
        } else {
          invalid += 1;
        }
      } else {
        if (
          red.data[offset] === 255 &&
          red.data[offset + 1] === 255 &&
          red.data[offset + 2] === 255 &&
          red.data[offset + 3] === 255
        ) {
          white += 1;
        } else {
          invalid += 1;
        }
      }
    }
    expect(black).toBeGreaterThan(0);
    expect(white).toBeGreaterThan(0);
    expect(invalid).toBe(0);
  });
});
