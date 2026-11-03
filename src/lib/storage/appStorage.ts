import {
  createDefaultWorkImageState,
  type LocalUser,
  type WorkImageState,
  type WorkRecord,
} from "../../domain/types";

export const APP_STORAGE_KEY = "cunstone:v0.1:app-state";
export const APP_STORAGE_VERSION = 2 as const;

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
    isWorkImageState(value.imageState)
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

function migrateV1State(state: V1AppState): AppState {
  return {
    version: APP_STORAGE_VERSION,
    activeUserId: state.activeUserId,
    users: state.users,
    works: state.works.map((work) => ({
      ...work,
      imageState: createDefaultWorkImageState(),
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
