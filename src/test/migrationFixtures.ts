import { encodeOverlay } from "../lib/binary/overlayCodec";

const users = [
  {
    id: "user-1",
    phone: "13800138000",
    createdAt: "2026-11-02T10:00:00.000Z",
  },
];

function legacyImageState(overrides: Record<string, unknown> = {}) {
  return {
    sourceKind: "upload",
    sourceDataUrl: "data:image/png;base64,bGVnYWN5",
    shape: "square",
    widthMm: 25,
    heightMm: 25,
    backgroundColor: null,
    tolerance: 20,
    effectMode: "silhouette",
    processingVersion: 1,
    ...overrides,
  };
}

function legacyBinaryState(overrides: Record<string, unknown> = {}) {
  return {
    overlayData: null,
    overlayWidth: null,
    overlayHeight: null,
    generationSignature: null,
    brushSize: 6,
    carvingMode: "yang",
    orientation: "normal",
    borderStyle: "none",
    editVersion: 1,
    ...overrides,
  };
}

function work(
  id: string,
  imageState: Record<string, unknown>,
  binaryState: Record<string, unknown> = legacyBinaryState(),
) {
  return {
    id,
    ownerId: "user-1",
    name: id,
    status: "completed",
    createdAt: "2026-11-02T10:01:00.000Z",
    lastSavedAt: "2026-11-02T10:02:00.000Z",
    imageState,
    binaryState,
  };
}

export function createV3MigrationFixtures() {
  const overlayData = encodeOverlay(new Uint8Array([0, 1, 2, 0]), 2, 2);
  return {
    version: 3,
    activeUserId: "user-1",
    users,
    works: [
      work(
        "single-background",
        legacyImageState({
          backgroundColor: "#ffffff",
          tolerance: 35,
        }),
      ),
      work(
        "manual-overlay",
        legacyImageState(),
        legacyBinaryState({
          overlayData,
          overlayWidth: 2,
          overlayHeight: 2,
          generationSignature: "legacy-single-background-signature",
          carvingMode: "yin",
          borderStyle: "double",
        }),
      ),
      work(
        "legacy-drawing",
        legacyImageState({
          sourceKind: "drawing",
          sourceDataUrl: "data:image/png;base64,ZHJhd2luZw==",
        }),
      ),
      work(
        "legacy-custom",
        legacyImageState({
          shape: "custom",
          widthMm: 20,
          heightMm: 30,
        }),
      ),
      work(
        "legacy-broken",
        legacyImageState(),
        legacyBinaryState({
          borderStyle: "broken",
        }),
      ),
      work(
        "legacy-thick",
        legacyImageState(),
        legacyBinaryState({
          borderStyle: "thick",
        }),
      ),
    ],
  };
}

export function createV1MigrationFixture() {
  return {
    version: 1,
    activeUserId: "user-1",
    users,
    works: [
      {
        id: "v1-work",
        ownerId: "user-1",
        name: "v1 work",
        status: "draft",
        createdAt: "2026-11-02T10:01:00.000Z",
        lastSavedAt: "2026-11-02T10:02:00.000Z",
      },
    ],
  };
}

export function createV2MigrationFixture() {
  return {
    version: 2,
    activeUserId: "user-1",
    users,
    works: [
      {
        id: "v2-work",
        ownerId: "user-1",
        name: "v2 work",
        status: "draft",
        createdAt: "2026-11-02T10:01:00.000Z",
        lastSavedAt: "2026-11-02T10:02:00.000Z",
        imageState: legacyImageState({
          sourceKind: "upload",
          sourceDataUrl: "data:image/png;base64,djI=",
          backgroundColor: "#0000ff",
          tolerance: 40,
          effectMode: "outline",
        }),
      },
    ],
  };
}

export function createV4MigrationFixture() {
  const overlayData = encodeOverlay(new Uint8Array([0, 1, 2, 0]), 2, 2);
  return {
    version: 4,
    activeUserId: "user-1",
    users,
    works: [
      {
        id: "v4-thick",
        ownerId: "user-1",
        name: "v4 thick",
        status: "completed",
        createdAt: "2026-11-02T10:01:00.000Z",
        lastSavedAt: "2026-11-02T10:02:00.000Z",
        imageState: {
          sourceKind: "upload",
          sourceDataUrl: "data:image/png;base64,djQ=",
          shape: "square",
          widthMm: 25,
          heightMm: 25,
          backgroundRules: [
            { id: "white", color: "#ffffff", tolerance: 20 },
          ],
          effectMode: "outline",
          processingVersion: 2,
        },
        binaryState: {
          overlayData,
          overlayWidth: 2,
          overlayHeight: 2,
          generationSignature: "legacy-v4-signature",
          brushSize: 6,
          carvingMode: "yang",
          orientation: "mirror",
          borderStyle: "thick",
          borderThickness: 6,
          editVersion: 2,
        },
      },
      {
        id: "v4-broken",
        ownerId: "user-1",
        name: "v4 broken",
        status: "completed",
        createdAt: "2026-11-02T10:01:00.000Z",
        lastSavedAt: "2026-11-02T10:02:00.000Z",
        imageState: {
          sourceKind: "upload",
          sourceDataUrl: "data:image/png;base64,YnJva2Vu",
          shape: "circle",
          widthMm: 20,
          heightMm: 20,
          backgroundRules: [],
          effectMode: "silhouette",
          processingVersion: 2,
        },
        binaryState: {
          overlayData: null,
          overlayWidth: null,
          overlayHeight: null,
          generationSignature: null,
          brushSize: 6,
          carvingMode: "yang",
          orientation: "normal",
          borderStyle: "broken",
          borderThickness: 2,
          editVersion: 2,
        },
      },
    ],
  };
}

export function createV5MigrationFixture() {
  return {
    version: 5,
    activeUserId: "user-1",
    users,
    works: [
      {
        id: "v5-work",
        ownerId: "user-1",
        name: "v5 work",
        status: "completed",
        createdAt: "2026-11-02T10:01:00.000Z",
        lastSavedAt: "2026-11-02T10:02:00.000Z",
        imageState: {
          sourceKind: "upload",
          sourceDataUrl: "data:image/png;base64,djU=",
          shape: "square",
          widthMm: 25,
          heightMm: 25,
          backgroundRules: [
            { id: "white", color: "#ffffff", tolerance: 20 },
          ],
          effectMode: "outline",
          outlineThickness: 3,
          processingVersion: 3,
        },
        binaryState: {
          overlayData: null,
          overlayWidth: null,
          overlayHeight: null,
          generationSignature: null,
          brushSize: 8,
          carvingMode: "yin",
          orientation: "mirror",
          borderStyle: "single",
          borderThickness: 4,
          editVersion: 2,
        },
      },
    ],
  };
}

export function createV6MigrationFixture() {
  const overlayData = encodeOverlay(new Uint8Array([0, 1, 2, 0]), 2, 2);
  return {
    version: 6,
    activeUserId: "user-1",
    users,
    works: [
      {
        id: "v6-work",
        ownerId: "user-1",
        name: "v6 work",
        status: "completed",
        createdAt: "2026-11-02T10:01:00.000Z",
        lastSavedAt: "2026-11-02T10:02:00.000Z",
        imageState: {
          sourceKind: "upload",
          sourceDataUrl: "data:image/png;base64,djY=",
          shape: "square",
          widthMm: 25,
          heightMm: 25,
          backgroundRules: [
            { id: "white", color: "#ffffff", tolerance: 20 },
          ],
          effectMode: "outline",
          outlineThickness: 3,
          sharpenAmount: 2,
          outerMarginPercent: 9,
          imageEraserSize: 42,
          processingVersion: 4,
        },
        binaryState: {
          overlayData,
          overlayWidth: 2,
          overlayHeight: 2,
          generationSignature: "legacy-v6-signature",
          brushSize: 7,
          eraserSize: 9,
          carvingMode: "yin",
          orientation: "mirror",
          borderStyle: "double",
          borderThickness: 5,
          editVersion: 3,
        },
      },
    ],
  };
}
