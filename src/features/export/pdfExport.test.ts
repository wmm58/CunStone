import { describe, expect, it } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type WorkRecord,
} from "../../domain/types";
import { buildPdfPlacements } from "./pdfExport";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0GQAAAAASUVORK5CYII=",
    "base64",
  ),
);

function work(id: string, name: string): WorkRecord {
  return {
    id,
    name,
    status: "completed",
    createdAt: "2026-11-07T10:00:00.000Z",
    lastSavedAt: "2026-11-07T10:00:00.000Z",
    imageState: createDefaultWorkImageState(),
    binaryState: createDefaultWorkBinaryState(),
  };
}

describe("pdfExport", () => {
  it("keeps rotation centers and creates PDF placement bounds", () => {
    const placements = buildPdfPlacements(
      [work("work-1", "作品一")],
      [
        {
          id: "work-1",
          widthMm: 40,
          heightMm: 20,
          pageIndex: 0,
          xMm: 12,
          yMm: 12,
          rotationDeg: 90,
        },
      ],
      new Map([
        [
          "work-1",
          { bytes: PNG, widthMm: 20, heightMm: 40 },
        ],
      ]),
    );

    expect(placements[0]).toMatchObject({
      xMm: 22,
      yMm: 2,
      widthMm: 20,
      heightMm: 40,
      dimensionText: "25 x 25 mm",
    });
  });

  it("formats circle dimensions for PDF-safe text", () => {
    const circleWork = {
      ...work("circle-1", "圆章"),
      imageState: {
        ...createDefaultWorkImageState(),
        shape: "circle" as const,
        widthMm: 30,
        heightMm: 30,
      },
    };
    const placements = buildPdfPlacements(
      [circleWork],
      [
        {
          id: "circle-1",
          widthMm: 30,
          heightMm: 30,
          pageIndex: 0,
          xMm: 12,
          yMm: 12,
          rotationDeg: 0,
        },
      ],
      new Map([
        ["circle-1", { bytes: PNG, widthMm: 30, heightMm: 30 }],
      ]),
    );

    expect(placements[0].dimensionText).toBe("Dia 30 mm");
  });
});
