import { describe, expect, it } from "vitest";

import {
  decodeOverlay,
  encodeOverlay,
  isValidPackedOverlay,
} from "./overlayCodec";

describe("overlayCodec", () => {
  it("round-trips mixed overlay values without loss", () => {
    const overlay = new Uint8Array([0, 1, 2, 0, 2, 1, 1, 0, 2]);
    const encoded = encodeOverlay(overlay, 3, 3);

    expect(decodeOverlay(encoded, 3, 3)).toEqual(overlay);
    expect(isValidPackedOverlay(encoded, 3, 3)).toBe(true);
  });

  it("supports empty, untouched, all-black and all-white overlays", () => {
    const cases = [
      new Uint8Array(16),
      new Uint8Array(16).fill(0),
      new Uint8Array(16).fill(1),
      new Uint8Array(16).fill(2),
    ];

    for (const overlay of cases) {
      const encoded = encodeOverlay(overlay, 4, 4);
      expect(decodeOverlay(encoded, 4, 4)).toEqual(overlay);
    }
  });

  it("rejects malformed Base64, wrong lengths and invalid 2-bit values", () => {
    expect(decodeOverlay("not-base64!", 2, 2)).toBeNull();
    expect(decodeOverlay(encodeOverlay(new Uint8Array(4), 2, 2), 2, 3)).toBeNull();
    expect(decodeOverlay("////", 2, 2)).toBeNull();
    expect(isValidPackedOverlay("", 2, 2)).toBe(false);
  });
});
