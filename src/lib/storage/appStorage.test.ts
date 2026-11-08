import { beforeEach, describe, expect, it } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
} from "../../domain/types";
import { decodeOverlay } from "../binary/overlayCodec";
import { createGenerationSignature } from "../binary/generationSignature";
import {
  createV1MigrationFixture,
  createV2MigrationFixture,
  createV3MigrationFixtures,
  createV4MigrationFixture,
  createV5MigrationFixture,
  createV6MigrationFixture,
} from "../../test/migrationFixtures";
import {
  APP_STORAGE_KEY,
  APP_STORAGE_VERSION,
  clearAppState,
  createEmptyAppState,
  readAppState,
  writeAppState,
} from "./appStorage";

const sampleState = {
  version: APP_STORAGE_VERSION,
  activeUserId: "user-1",
  users: [
    {
      id: "user-1",
      phone: "13800138000",
      createdAt: "2026-11-02T10:00:00.000Z",
    },
  ],
  works: [
    {
      id: "work-1",
      ownerId: "user-1",
      name: "测试作品",
      status: "draft" as const,
      createdAt: "2026-11-02T10:01:00.000Z",
      lastSavedAt: "2026-11-02T10:02:00.000Z",
      imageState: createDefaultWorkImageState(),
      binaryState: createDefaultWorkBinaryState(),
    },
  ],
};

describe("appStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty v7 state when storage is empty", () => {
    expect(APP_STORAGE_VERSION).toBe(7);
    expect(readAppState()).toEqual({
      state: createEmptyAppState(),
      recovery: "none",
    });
  });

  it("round-trips a valid v7 state", () => {
    writeAppState(sampleState);

    expect(readAppState()).toEqual({
      state: sampleState,
      recovery: "none",
    });
  });

  it("migrates v1 data without losing users, works, or the active account", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify(createV1MigrationFixture()),
    );

    const result = readAppState();

    expect(result.recovery).toBe("migrated");
    expect(result.state.version).toBe(7);
    expect(result.state.activeUserId).toBe("user-1");
    expect(result.state.works[0]).toMatchObject({
      id: "v1-work",
      name: "v1 work",
      imageState: createDefaultWorkImageState(),
      binaryState: createDefaultWorkBinaryState(),
    });
  });

  it("migrates v2 single-background data into one background rule", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify(createV2MigrationFixture()),
    );

    const result = readAppState();
    const work = result.state.works[0];

    expect(result.recovery).toBe("migrated");
    expect(work.imageState).toMatchObject({
      sourceDataUrl: "data:image/png;base64,djI=",
      effectMode: "outline",
      outlineThickness: 1,
      sharpenAmount: 1,
      outerMarginMm: 0,
      imageEraserSize: 24,
      processingVersion: 5,
      backgroundRules: [
        {
          color: "#0000ff",
          tolerance: 40,
        },
      ],
    });
    expect(work.binaryState).toEqual(createDefaultWorkBinaryState());
  });

  it("migrates v3 rules, custom shape and legacy drawing/broken values", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify(createV3MigrationFixtures()),
    );

    const result = readAppState();
    const byId = new Map(result.state.works.map((work) => [work.id, work]));

    expect(result.recovery).toBe("migrated");
    expect(byId.get("single-background")?.imageState.backgroundRules).toEqual([
      expect.objectContaining({ color: "#ffffff", tolerance: 35 }),
    ]);
    expect(byId.get("manual-overlay")?.imageState.backgroundRules).toEqual([]);
    expect(byId.get("legacy-drawing")?.imageState.sourceKind).toBe("drawing");
    expect(byId.get("legacy-custom")?.imageState).toMatchObject({
      shape: "rectangle",
      widthMm: 20,
      heightMm: 30,
    });
    expect(byId.get("legacy-broken")?.binaryState).toMatchObject({
      borderStyle: "broken",
      borderThickness: 2,
      borderMarginMm: 0,
      editVersion: 4,
    });
    expect(byId.get("legacy-thick")?.binaryState).toMatchObject({
      borderStyle: "single",
      borderThickness: 4,
      borderMarginMm: 0,
      editVersion: 4,
    });
    expect(byId.get("legacy-thick")?.imageState).toMatchObject({
      outlineThickness: 1,
      processingVersion: 5,
    });
  });

  it("migrates v4 outline defaults and thick borders to v7", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify(createV4MigrationFixture()),
    );

    const result = readAppState();
    const byId = new Map(result.state.works.map((work) => [work.id, work]));
    const thick = byId.get("v4-thick")!;

    expect(result.recovery).toBe("migrated");
    expect(thick.imageState).toMatchObject({
      outlineThickness: 1,
      sharpenAmount: 1,
      outerMarginMm: 0,
      imageEraserSize: 24,
      processingVersion: 5,
      effectMode: "outline",
    });
    expect(thick.binaryState).toMatchObject({
      borderStyle: "single",
      borderThickness: 8,
      borderMarginMm: 0,
      eraserSize: 6,
      editVersion: 4,
    });
    expect(thick.binaryState.generationSignature).toBe(
      createGenerationSignature(thick.imageState),
    );
    expect(byId.get("v4-broken")?.binaryState).toMatchObject({
      borderStyle: "broken",
      borderThickness: 2,
    });
  });

  it("migrates v5 processing and tool defaults to v7", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify(createV5MigrationFixture()),
    );

    const result = readAppState();
    const work = result.state.works[0];

    expect(result.recovery).toBe("migrated");
    expect(work.imageState).toMatchObject({
      outlineThickness: 3,
      sharpenAmount: 1,
      outerMarginMm: 0,
      imageEraserSize: 24,
      processingVersion: 5,
    });
    expect(work.binaryState).toMatchObject({
      brushSize: 8,
      eraserSize: 6,
      borderStyle: "single",
      borderThickness: 4,
      borderMarginMm: 0,
      editVersion: 4,
    });
  });

  it("migrates v6 percentages to millimetres and resets border margin", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify(createV6MigrationFixture()),
    );

    const result = readAppState();
    const work = result.state.works[0];
    const decoded = decodeOverlay(
      work.binaryState.overlayData!,
      work.binaryState.overlayWidth!,
      work.binaryState.overlayHeight!,
    );

    expect(result.recovery).toBe("migrated");
    expect(work.imageState).toMatchObject({
      outerMarginMm: 2.3,
      imageEraserSize: 42,
      processingVersion: 5,
    });
    expect(work.binaryState).toMatchObject({
      brushSize: 7,
      eraserSize: 9,
      borderStyle: "double",
      borderThickness: 5,
      borderMarginMm: 0,
      editVersion: 4,
    });
    expect(work.binaryState.generationSignature).toBe(
      createGenerationSignature(work.imageState),
    );
    expect([...decoded!]).toEqual([0, 1, 2, 0]);
  });

  it("recomputes a migrated overlay signature while keeping overlay pixels", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify(createV3MigrationFixtures()),
    );

    const work = readAppState().state.works.find(
      (candidate) => candidate.id === "manual-overlay",
    )!;
    const decoded = decodeOverlay(
      work.binaryState.overlayData!,
      work.binaryState.overlayWidth!,
      work.binaryState.overlayHeight!,
    );

    expect(work.binaryState.generationSignature).toBe(
      createGenerationSignature(work.imageState),
    );
    expect([...decoded!]).toEqual([0, 1, 2, 0]);
  });

  it("rejects invalid v7 background rules, processing amounts and border style", () => {
    const invalidVariants = [
      {
        imageState: {
          ...sampleState.works[0].imageState,
          backgroundRules: Array.from({ length: 11 }, (_, index) => ({
            id: `rule-${index}`,
            color: "#ffffff",
            tolerance: 20,
          })),
        },
      },
      {
        imageState: {
          ...sampleState.works[0].imageState,
          backgroundRules: [
            { id: "rule-1", color: "#ffffff", tolerance: 101 },
          ],
        },
      },
      {
        binaryState: {
          ...sampleState.works[0].binaryState,
          borderThickness: 9,
        },
      },
      {
        imageState: {
          ...sampleState.works[0].imageState,
          outlineThickness: 0,
        },
      },
      {
        imageState: {
          ...sampleState.works[0].imageState,
          outlineThickness: 9,
        },
      },
      {
        imageState: {
          ...sampleState.works[0].imageState,
          sharpenAmount: 9,
        },
      },
      {
        imageState: {
          ...sampleState.works[0].imageState,
          outerMarginMm: 21,
        },
      },
      {
        imageState: {
          ...sampleState.works[0].imageState,
          imageEraserSize: 81,
        },
      },
      {
        binaryState: {
          ...sampleState.works[0].binaryState,
          eraserSize: 33,
        },
      },
      {
        binaryState: {
          ...sampleState.works[0].binaryState,
          borderMarginMm: 21,
        },
      },
      {
        binaryState: {
          ...sampleState.works[0].binaryState,
          borderStyle: "thick",
        },
      },
    ];

    for (const variant of invalidVariants) {
      window.localStorage.setItem(
        APP_STORAGE_KEY,
        JSON.stringify({
          ...sampleState,
          works: [{ ...sampleState.works[0], ...variant }],
        }),
      );
      expect(readAppState()).toEqual({
        state: createEmptyAppState(),
        recovery: "corrupt",
      });
    }
  });

  it("rejects invalid overlay encoding and dimensions", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        ...sampleState,
        works: [
          {
            ...sampleState.works[0],
            binaryState: {
              ...createDefaultWorkBinaryState(),
              overlayData: "not-base64!",
              overlayWidth: 2,
              overlayHeight: 2,
              generationSignature: "signature",
            },
          },
        ],
      }),
    );

    expect(readAppState()).toEqual({
      state: createEmptyAppState(),
      recovery: "corrupt",
    });
  });

  it("falls back safely for corrupt or unsupported data and clears storage", () => {
    window.localStorage.setItem(APP_STORAGE_KEY, "{not-json");
    expect(readAppState().recovery).toBe("corrupt");

    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({ ...sampleState, version: 999 }),
    );
    expect(readAppState().recovery).toBe("unsupported-version");

    writeAppState(sampleState);
    clearAppState();
    expect(window.localStorage.getItem(APP_STORAGE_KEY)).toBeNull();
  });
});
