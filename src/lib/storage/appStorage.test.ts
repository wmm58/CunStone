import { beforeEach, describe, expect, it } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
} from "../../domain/types";
import { encodeOverlay } from "../binary/overlayCodec";
import {
  APP_STORAGE_KEY,
  clearAppState,
  createEmptyAppState,
  readAppState,
  writeAppState,
} from "./appStorage";

const sampleState = {
  version: 3 as const,
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

const v2State = {
  version: 2,
  activeUserId: "user-1",
  users: sampleState.users,
  works: [
    {
      id: "work-1",
      ownerId: "user-1",
      name: "测试作品",
      status: "draft",
      createdAt: "2026-11-02T10:01:00.000Z",
      lastSavedAt: "2026-11-02T10:02:00.000Z",
      imageState: {
        ...createDefaultWorkImageState(),
        sourceKind: "upload",
        sourceDataUrl: "data:image/png;base64,AAAA",
      },
    },
  ],
};

const v1State = {
  version: 1,
  activeUserId: "user-1",
  users: sampleState.users,
  works: [
    {
      id: "work-1",
      ownerId: "user-1",
      name: "测试作品",
      status: "draft",
      createdAt: "2026-11-02T10:01:00.000Z",
      lastSavedAt: "2026-11-02T10:02:00.000Z",
    },
  ],
};

describe("appStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty versioned state when storage is empty", () => {
    expect(readAppState()).toEqual({
      state: createEmptyAppState(),
      recovery: "none",
    });
  });

  it("round-trips a valid state", () => {
    writeAppState(sampleState);

    expect(readAppState()).toEqual({
      state: sampleState,
      recovery: "none",
    });
  });

  it("falls back safely when stored JSON is corrupted", () => {
    window.localStorage.setItem(APP_STORAGE_KEY, "{not-json");

    expect(readAppState()).toEqual({
      state: createEmptyAppState(),
      recovery: "corrupt",
    });
  });

  it("falls back safely when the stored structure is invalid", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({ version: 1, users: "invalid" }),
    );

    expect(readAppState()).toEqual({
      state: createEmptyAppState(),
      recovery: "corrupt",
    });
  });

  it("falls back safely when the stored version is unsupported", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({ ...sampleState, version: 999 }),
    );

    expect(readAppState()).toEqual({
      state: createEmptyAppState(),
      recovery: "unsupported-version",
    });
  });

  it("migrates v1 data without losing users, works, or the active account", () => {
    window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(v1State));

    const result = readAppState();

    expect(result.recovery).toBe("migrated");
    expect(result.state.version).toBe(3);
    expect(result.state.activeUserId).toBe("user-1");
    expect(result.state.users).toEqual(sampleState.users);
    expect(result.state.works[0]).toMatchObject({
      id: "work-1",
      name: "测试作品",
      status: "draft",
      imageState: createDefaultWorkImageState(),
      binaryState: createDefaultWorkBinaryState(),
    });
  });

  it("migrates v2 data while preserving the complete image state", () => {
    window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(v2State));

    const result = readAppState();

    expect(result.recovery).toBe("migrated");
    expect(result.state).toMatchObject({
      version: 3,
      activeUserId: "user-1",
      works: [
        {
          id: "work-1",
          imageState: {
            sourceKind: "upload",
            sourceDataUrl: "data:image/png;base64,AAAA",
          },
          binaryState: createDefaultWorkBinaryState(),
        },
      ],
    });
  });

  it("rejects invalid v3 binary state", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        ...sampleState,
        works: [
          {
            ...sampleState.works[0],
            binaryState: {
              ...createDefaultWorkBinaryState(),
              brushSize: 33,
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

  it("rejects invalid overlay encoding, dimensions and null pairing", () => {
    const invalidStates = [
      {
        ...createDefaultWorkBinaryState(),
        overlayData: "not-base64!",
        overlayWidth: 2,
        overlayHeight: 2,
        generationSignature: "signature",
      },
      {
        ...createDefaultWorkBinaryState(),
        overlayData: encodeOverlay(new Uint8Array(8), 4, 2),
        overlayWidth: 3,
        overlayHeight: 3,
        generationSignature: "signature",
      },
      {
        ...createDefaultWorkBinaryState(),
        overlayData: null,
        overlayWidth: 2,
        overlayHeight: 2,
        generationSignature: "signature",
      },
    ];

    for (const binaryState of invalidStates) {
      window.localStorage.setItem(
        APP_STORAGE_KEY,
        JSON.stringify({
          ...sampleState,
          works: [{ ...sampleState.works[0], binaryState }],
        }),
      );
      expect(readAppState()).toEqual({
        state: createEmptyAppState(),
        recovery: "corrupt",
      });
    }
  });

  it("clears stored application data", () => {
    writeAppState(sampleState);

    clearAppState();

    expect(window.localStorage.getItem(APP_STORAGE_KEY)).toBeNull();
  });
});
