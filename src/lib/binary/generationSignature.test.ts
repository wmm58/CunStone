import { describe, expect, it } from "vitest";

import {
  createDefaultWorkImageState,
  type BackgroundRemovalRule,
} from "../../domain/types";
import { createGenerationSignature } from "./generationSignature";

function rule(
  id: string,
  color: string | null,
  tolerance: number,
): BackgroundRemovalRule {
  return { id, color, tolerance };
}

describe("generationSignature", () => {
  it("ignores empty rules and rule ids", () => {
    const base = {
      ...createDefaultWorkImageState(),
      sourceDataUrl: "data:image/png;base64,AAAA",
    };
    const withEmpty = {
      ...base,
      backgroundRules: [rule("empty", null, 20)],
    };
    const withDifferentId = {
      ...base,
      backgroundRules: [rule("another-id", "#ffffff", 20)],
    };
    const withSameValue = {
      ...base,
      backgroundRules: [rule("stable-id", "#ffffff", 20)],
    };

    expect(createGenerationSignature(withEmpty)).toBe(
      createGenerationSignature(base),
    );
    expect(createGenerationSignature(withDifferentId)).toBe(
      createGenerationSignature(withSameValue),
    );
  });

  it("ignores rule order but changes with color or tolerance", () => {
    const base = {
      ...createDefaultWorkImageState(),
      sourceDataUrl: "data:image/png;base64,AAAA",
      backgroundRules: [
        rule("white", "#ffffff", 20),
        rule("blue", "#0000ff", 30),
      ],
    };
    const reordered = {
      ...base,
      backgroundRules: [base.backgroundRules[1], base.backgroundRules[0]],
    };

    expect(createGenerationSignature(reordered)).toBe(
      createGenerationSignature(base),
    );
    expect(
      createGenerationSignature({
        ...base,
        backgroundRules: [rule("white", "#ffffff", 21)],
      }),
    ).not.toBe(createGenerationSignature(base));
    expect(
      createGenerationSignature({
        ...base,
        backgroundRules: [rule("red", "#ff0000", 20)],
      }),
    ).not.toBe(createGenerationSignature(base));
  });

  it("changes when outline thickness changes", () => {
    const base = {
      ...createDefaultWorkImageState(),
      sourceDataUrl: "data:image/png;base64,AAAA",
      effectMode: "outline" as const,
      outlineThickness: 1,
    };

    expect(
      createGenerationSignature({ ...base, outlineThickness: 8 }),
    ).not.toBe(createGenerationSignature(base));
  });

  it("changes when sharpen or outer margin changes", () => {
    const base = {
      ...createDefaultWorkImageState(),
      sourceDataUrl: "data:image/png;base64,AAAA",
    };

    expect(
      createGenerationSignature({ ...base, sharpenAmount: 4 }),
    ).not.toBe(createGenerationSignature(base));
    expect(
      createGenerationSignature({ ...base, outerMarginMm: 12 }),
    ).not.toBe(createGenerationSignature(base));
  });
});
