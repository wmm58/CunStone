import { describe, expect, it } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
} from "./types";

describe("work default states", () => {
  it("starts with the current image-processing defaults", () => {
    expect(createDefaultWorkImageState()).toMatchObject({
      backgroundRules: [],
      outlineThickness: 1,
      sharpenAmount: 1,
      outerMarginMm: 0,
      imageEraserSize: 24,
      processingVersion: 5,
    });
  });

  it("starts with border thickness 2, border margin 0 and edit version 4", () => {
    expect(createDefaultWorkBinaryState()).toMatchObject({
      borderThickness: 2,
      borderMarginMm: 0,
      eraserSize: 6,
      editVersion: 4,
    });
  });
});
