import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type LocalUser,
  type WorkBinaryEditState,
  type WorkImageState,
  type WorkRecord,
} from "../../domain/types";
import { isValidPackedOverlay } from "../binary/overlayCodec";

export const APP_STORAGE_KEY = "cunstone:v0.1:app-state";
export const APP_STORAGE_VERSION = 3 as const;

export interface AppState {
  version: typeof APP_STORAGE_VERSION;
  activeUserId: string | null;
  users: LocalUser[];
  works: WorkRecord[];
}

export type StorageRecovery =
  | "none"
  | "migrated"
  | "corrupt"
  | "unsupported-version";

export interface ReadAppStateResult {
  state: AppState;
  recovery: StorageRecovery;
}

export function createEmptyAppState(): AppState {
  return {
    version: APP_STORAGE_VERSION,
    activeUserId: null,
    users: [],
    works: [],
  };
}

export function readAppState(storage: Storage = window.localStorage): ReadAppStateResult {
  const raw = storage.getItem(APP_STORAGE_KEY);

  if (!raw) {
    return { state: createEmptyAppState(), recovery: "none" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: createEmptyAppState(), recovery: "corrupt" };
  }

  if (isRecord(parsed) && parsed.version === 1) {
    if (!isV1AppState(parsed)) {
      return { state: createEmptyAppState(), recovery: "corrupt" };
    }
    return { state: migrateV1State(parsed), recovery: "migrated" };
  }

  if (isRecord(parsed) && parsed.version === 2) {
    if (!isV2AppState(parsed)) {
      return { state: createEmptyAppState(), recovery: "corrupt" };
    }
    return { state: migrateV2State(parsed), recovery: "migrated" };
  }

  if (
    isRecord(parsed) &&
    "version" in parsed &&
    parsed.version !== APP_STORAGE_VERSION
  ) {
    return { state: createEmptyAppState(), recovery: "unsupported-version" };
  }

  if (!isAppState(parsed)) {
    return { state: createEmptyAppState(), recovery: "corrupt" };
  }

  return { state: parsed, recovery: "none" };
}

export function writeAppState(state: AppState, storage: Storage = window.localStorage): void {
  storage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
}

export function clearAppState(storage: Storage = window.localStorage): void {
  storage.removeItem(APP_STORAGE_KEY);
}

function isAppState(value: unknown): value is AppState {
  return (
    isRecord(value) &&
    value.version === APP_STORAGE_VERSION &&
    (value.activeUserId === null || typeof value.activeUserId === "string") &&
    Array.isArray(value.users) &&
    value.users.every(isLocalUser) &&
    Array.isArray(value.works) &&
    value.works.every(isWorkRecord)
  );
}

function isLocalUser(value: unknown): value is LocalUser {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.phone === "string" &&
    typeof value.createdAt === "string"
  );
}

function isWorkRecord(value: unknown): value is WorkRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.ownerId === "string" &&
    typeof value.name === "string" &&
    (value.status === "draft" || value.status === "completed") &&
    typeof value.createdAt === "string" &&
    typeof value.lastSavedAt === "string" &&
    isWorkImageState(value.imageState) &&
    isWorkBinaryEditState(value.binaryState)
  );
}

function isWorkImageState(value: unknown): value is WorkImageState {
  return (
    isRecord(value) &&
    (value.sourceKind === null ||
      value.sourceKind === "upload" ||
      value.sourceKind === "drawing") &&
    (value.sourceDataUrl === null || typeof value.sourceDataUrl === "string") &&
    (value.shape === "square" ||
      value.shape === "rectangle" ||
      value.shape === "circle" ||
      value.shape === "custom") &&
    typeof value.widthMm === "number" &&
    typeof value.heightMm === "number" &&
    (value.backgroundColor === null ||
      typeof value.backgroundColor === "string") &&
    typeof value.tolerance === "number" &&
    value.tolerance >= 0 &&
    value.tolerance <= 100 &&
    (value.effectMode === "silhouette" || value.effectMode === "outline") &&
    value.processingVersion === 1
  );
}

function isWorkBinaryEditState(value: unknown): value is WorkBinaryEditState {
  if (!isRecord(value)) {
    return false;
  }

  const hasOverlay = value.overlayData !== null;
  const width = value.overlayWidth;
  const height = value.overlayHeight;
  const dimensionsValid =
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    (width as number) > 0 &&
    (height as number) > 0 &&
    (width as number) <= 512 &&
    (height as number) <= 512;

  const overlayValid = hasOverlay
    ? typeof value.overlayData === "string" &&
      dimensionsValid &&
      typeof value.generationSignature === "string" &&
      value.generationSignature.length > 0 &&
      isValidPackedOverlay(value.overlayData, width as number, height as number)
    : value.overlayData === null &&
      value.overlayWidth === null &&
      value.overlayHeight === null &&
      value.generationSignature === null;

  return (
    overlayValid &&
    typeof value.brushSize === "number" &&
    Number.isInteger(value.brushSize) &&
    value.brushSize >= 1 &&
    value.brushSize <= 32 &&
    (value.carvingMode === "yang" || value.carvingMode === "yin") &&
    (value.orientation === "normal" || value.orientation === "mirror") &&
    (value.borderStyle === "none" ||
      value.borderStyle === "single" ||
      value.borderStyle === "thick" ||
      value.borderStyle === "double" ||
      value.borderStyle === "broken") &&
    value.editVersion === 1
  );
}

interface V1WorkRecord {
  id: string;
  ownerId: string;
  name: string;
  status: WorkRecord["status"];
  createdAt: string;
  lastSavedAt: string;
}

interface V1AppState {
  version: 1;
  activeUserId: string | null;
  users: LocalUser[];
  works: V1WorkRecord[];
}

interface V2WorkRecord extends Omit<WorkRecord, "binaryState"> {}

interface V2AppState {
  version: 2;
  activeUserId: string | null;
  users: LocalUser[];
  works: V2WorkRecord[];
}

function isV1AppState(value: unknown): value is V1AppState {
  return (
    isRecord(value) &&
    value.version === 1 &&
    (value.activeUserId === null || typeof value.activeUserId === "string") &&
    Array.isArray(value.users) &&
    value.users.every(isLocalUser) &&
    Array.isArray(value.works) &&
    value.works.every(isV1WorkRecord)
  );
}

function isV1WorkRecord(value: unknown): value is V1WorkRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.ownerId === "string" &&
    typeof value.name === "string" &&
    (value.status === "draft" || value.status === "completed") &&
    typeof value.createdAt === "string" &&
    typeof value.lastSavedAt === "string"
  );
}

function isV2AppState(value: unknown): value is V2AppState {
  return (
    isRecord(value) &&
    value.version === 2 &&
    (value.activeUserId === null || typeof value.activeUserId === "string") &&
    Array.isArray(value.users) &&
    value.users.every(isLocalUser) &&
    Array.isArray(value.works) &&
    value.works.every(isV2WorkRecord)
  );
}

function isV2WorkRecord(value: unknown): value is V2WorkRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.ownerId === "string" &&
    typeof value.name === "string" &&
    (value.status === "draft" || value.status === "completed") &&
    typeof value.createdAt === "string" &&
    typeof value.lastSavedAt === "string" &&
    isWorkImageState(value.imageState)
  );
}

function migrateV1State(state: V1AppState): AppState {
  return {
    version: APP_STORAGE_VERSION,
    activeUserId: state.activeUserId,
    users: state.users,
    works: state.works.map((work) => ({
      ...work,
      imageState: createDefaultWorkImageState(),
      binaryState: createDefaultWorkBinaryState(),
    })),
  };
}

function migrateV2State(state: V2AppState): AppState {
  return {
    version: APP_STORAGE_VERSION,
    activeUserId: state.activeUserId,
    users: state.users,
    works: state.works.map((work) => ({
      ...work,
      binaryState: createDefaultWorkBinaryState(),
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
