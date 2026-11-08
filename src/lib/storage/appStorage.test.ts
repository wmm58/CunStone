import { beforeEach, describe, expect, it } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type WorkRecord,
} from "../../domain/types";
import {
  APP_STORAGE_KEY,
  APP_STORAGE_VERSION,
  clearAppState,
  createEmptyAppState,
  readAppState,
  writeAppState,
} from "./appStorage";

function sampleWork(): WorkRecord {
  return {
    id: "work-1",
    name: "测试作品",
    status: "draft",
    createdAt: "2026-11-02T10:01:00.000Z",
    lastSavedAt: "2026-11-02T10:02:00.000Z",
    imageState: createDefaultWorkImageState(),
    binaryState: createDefaultWorkBinaryState(),
  };
}

const sampleState = {
  version: APP_STORAGE_VERSION,
  works: [sampleWork()],
};

describe("appStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty v8 state when storage is empty", () => {
    expect(APP_STORAGE_VERSION).toBe(8);
    expect(readAppState()).toEqual({
      state: createEmptyAppState(),
      recovery: "none",
    });
  });

  it("round-trips a valid v8 state", () => {
    writeAppState(sampleState);

    expect(readAppState()).toEqual({
      state: sampleState,
      recovery: "none",
    });
  });

  it("clears old versioned account data and starts with an empty library", () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        version: 7,
        activeUserId: "user-1",
        users: [
          {
            id: "user-1",
            phone: "13800138000",
            createdAt: "2026-11-02T10:00:00.000Z",
          },
        ],
        works: [{ ...sampleWork(), ownerId: "user-1" }],
      }),
    );

    expect(readAppState()).toEqual({
      state: createEmptyAppState(),
      recovery: "reset-old-version",
    });
    expect(window.localStorage.getItem(APP_STORAGE_KEY)).toBeNull();
  });

  it("clears corrupt data and reports corruption", () => {
    window.localStorage.setItem(APP_STORAGE_KEY, "{not-json");

    expect(readAppState()).toEqual({
      state: createEmptyAppState(),
      recovery: "corrupt",
    });
    expect(window.localStorage.getItem(APP_STORAGE_KEY)).toBeNull();
  });

  it("rejects v8 data containing users, ownership or invalid fields", () => {
    const invalidStates = [
      {
        ...sampleState,
        users: [],
      },
      {
        ...sampleState,
        works: [{ ...sampleWork(), ownerId: "user-1" }],
      },
      {
        ...sampleState,
        works: [
          {
            ...sampleWork(),
            binaryState: {
              ...createDefaultWorkBinaryState(),
              borderStyle: "broken",
            },
          },
        ],
      },
    ];

    for (const value of invalidStates) {
      window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(value));
      expect(readAppState()).toEqual({
        state: createEmptyAppState(),
        recovery: "corrupt",
      });
      expect(window.localStorage.getItem(APP_STORAGE_KEY)).toBeNull();
    }
  });

  it("clears the app state explicitly", () => {
    writeAppState(sampleState);
    clearAppState();
    expect(window.localStorage.getItem(APP_STORAGE_KEY)).toBeNull();
  });
});
