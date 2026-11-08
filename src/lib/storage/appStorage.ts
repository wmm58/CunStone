import {
  DEFAULT_BORDER_THICKNESS,
  DEFAULT_BORDER_MARGIN_MM,
  DEFAULT_BINARY_ERASER_SIZE,
  DEFAULT_IMAGE_ERASER_SIZE,
  DEFAULT_OUTLINE_THICKNESS,
  DEFAULT_OUTER_MARGIN_MM,
  DEFAULT_SHARPEN_AMOUNT,
  MAX_BACKGROUND_RULES,
  MAX_BORDER_THICKNESS,
  MAX_BORDER_MARGIN_MM,
  MAX_IMAGE_ERASER_SIZE,
  MAX_OUTLINE_THICKNESS,
  MAX_OUTER_MARGIN_MM,
  MAX_SHARPEN_AMOUNT,
  MIN_BORDER_THICKNESS,
  MIN_IMAGE_ERASER_SIZE,
  MIN_OUTLINE_THICKNESS,
  MIN_SHARPEN_AMOUNT,
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type LocalUser,
  type WorkBinaryEditState,
  type WorkImageState,
  type WorkRecord,
} from "../../domain/types";
import { isValidPackedOverlay } from "../binary/overlayCodec";
import { createGenerationSignature } from "../binary/generationSignature";

export const APP_STORAGE_KEY = "cunstone:v0.1:app-state";
export const APP_STORAGE_VERSION = 7 as const;

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

  if (isRecord(parsed) && parsed.version === 3) {
    if (!isV3AppState(parsed)) {
      return { state: createEmptyAppState(), recovery: "corrupt" };
    }
    return { state: migrateV3State(parsed), recovery: "migrated" };
  }

  if (isRecord(parsed) && parsed.version === 4) {
    if (!isV4AppState(parsed)) {
      return { state: createEmptyAppState(), recovery: "corrupt" };
    }
    return { state: migrateV4State(parsed), recovery: "migrated" };
  }

  if (isRecord(parsed) && parsed.version === 5) {
    if (!isV5AppState(parsed)) {
      return { state: createEmptyAppState(), recovery: "corrupt" };
    }
    return { state: migrateV5State(parsed), recovery: "migrated" };
  }

  if (isRecord(parsed) && parsed.version === 6) {
    if (!isV6AppState(parsed)) {
      return { state: createEmptyAppState(), recovery: "corrupt" };
    }
    return { state: migrateV6State(parsed), recovery: "migrated" };
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
      value.shape === "circle") &&
    typeof value.widthMm === "number" &&
    typeof value.heightMm === "number" &&
    Array.isArray(value.backgroundRules) &&
    value.backgroundRules.length <= MAX_BACKGROUND_RULES &&
    value.backgroundRules.every(isBackgroundRule) &&
    (value.effectMode === "silhouette" || value.effectMode === "outline") &&
    typeof value.outlineThickness === "number" &&
    Number.isInteger(value.outlineThickness) &&
    value.outlineThickness >= MIN_OUTLINE_THICKNESS &&
    value.outlineThickness <= MAX_OUTLINE_THICKNESS &&
    typeof value.sharpenAmount === "number" &&
    Number.isInteger(value.sharpenAmount) &&
    value.sharpenAmount >= MIN_SHARPEN_AMOUNT &&
    value.sharpenAmount <= MAX_SHARPEN_AMOUNT &&
    typeof value.outerMarginMm === "number" &&
    Number.isFinite(value.outerMarginMm) &&
    value.outerMarginMm >= 0 &&
    value.outerMarginMm <= MAX_OUTER_MARGIN_MM &&
    typeof value.imageEraserSize === "number" &&
    Number.isInteger(value.imageEraserSize) &&
    value.imageEraserSize >= MIN_IMAGE_ERASER_SIZE &&
    value.imageEraserSize <= MAX_IMAGE_ERASER_SIZE &&
    value.processingVersion === 5
  );
}

function isBackgroundRule(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    (value.color === null || typeof value.color === "string") &&
    typeof value.tolerance === "number" &&
    Number.isFinite(value.tolerance) &&
    value.tolerance >= 0 &&
    value.tolerance <= 100
  );
}

function isWorkBinaryEditState(value: unknown): value is WorkBinaryEditState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOverlayState(value) &&
    typeof value.brushSize === "number" &&
    Number.isInteger(value.brushSize) &&
    value.brushSize >= 1 &&
    value.brushSize <= 32 &&
    typeof value.eraserSize === "number" &&
    Number.isInteger(value.eraserSize) &&
    value.eraserSize >= 1 &&
    value.eraserSize <= 32 &&
    (value.carvingMode === "yang" || value.carvingMode === "yin") &&
    (value.orientation === "normal" || value.orientation === "mirror") &&
    isCurrentBorderStyle(value.borderStyle) &&
    typeof value.borderThickness === "number" &&
    Number.isInteger(value.borderThickness) &&
    value.borderThickness >= MIN_BORDER_THICKNESS &&
    value.borderThickness <= MAX_BORDER_THICKNESS &&
    typeof value.borderMarginMm === "number" &&
    Number.isFinite(value.borderMarginMm) &&
    value.borderMarginMm >= 0 &&
    value.borderMarginMm <= MAX_BORDER_MARGIN_MM &&
    value.editVersion === 4
  );
}

function isOverlayState(value: Record<string, unknown>): boolean {
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

  return hasOverlay
    ? typeof value.overlayData === "string" &&
        dimensionsValid &&
        typeof value.generationSignature === "string" &&
        value.generationSignature.length > 0 &&
        isValidPackedOverlay(value.overlayData, width as number, height as number)
    : value.overlayData === null &&
        value.overlayWidth === null &&
        value.overlayHeight === null &&
        value.generationSignature === null;
}

function isCurrentBorderStyle(value: unknown): boolean {
  return (
    value === "none" ||
    value === "single" ||
    value === "double" ||
    value === "broken"
  );
}

function isLegacyBorderStyle(value: unknown): boolean {
  return value === "thick" || isCurrentBorderStyle(value);
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

interface LegacyWorkImageState {
  sourceKind: "upload" | "drawing" | null;
  sourceDataUrl: string | null;
  shape: "square" | "rectangle" | "circle" | "custom";
  widthMm: number;
  heightMm: number;
  backgroundColor: string | null;
  tolerance: number;
  effectMode: "silhouette" | "outline";
  processingVersion: 1;
}

interface LegacyWorkBinaryState {
  overlayData: string | null;
  overlayWidth: number | null;
  overlayHeight: number | null;
  generationSignature: string | null;
  brushSize: number;
  carvingMode: "yang" | "yin";
  orientation: "normal" | "mirror";
  borderStyle: "none" | "single" | "thick" | "double" | "broken";
  editVersion: 1;
}

interface V2WorkRecord extends Omit<V1WorkRecord, never> {
  imageState: LegacyWorkImageState;
}

interface V2AppState {
  version: 2;
  activeUserId: string | null;
  users: LocalUser[];
  works: V2WorkRecord[];
}

interface V3WorkRecord extends V2WorkRecord {
  binaryState: LegacyWorkBinaryState;
}

interface V3AppState {
  version: 3;
  activeUserId: string | null;
  users: LocalUser[];
  works: V3WorkRecord[];
}

interface V4WorkImageState {
  sourceKind: "upload" | "drawing" | null;
  sourceDataUrl: string | null;
  shape: "square" | "rectangle" | "circle";
  widthMm: number;
  heightMm: number;
  backgroundRules: Array<{
    id: string;
    color: string | null;
    tolerance: number;
  }>;
  effectMode: "silhouette" | "outline";
  processingVersion: 2;
}

interface V4WorkBinaryState {
  overlayData: string | null;
  overlayWidth: number | null;
  overlayHeight: number | null;
  generationSignature: string | null;
  brushSize: number;
  carvingMode: "yang" | "yin";
  orientation: "normal" | "mirror";
  borderStyle: "none" | "single" | "thick" | "double" | "broken";
  borderThickness: number;
  editVersion: 2;
}

interface V4WorkRecord {
  id: string;
  ownerId: string;
  name: string;
  status: WorkRecord["status"];
  createdAt: string;
  lastSavedAt: string;
  imageState: V4WorkImageState;
  binaryState: V4WorkBinaryState;
}

interface V4AppState {
  version: 4;
  activeUserId: string | null;
  users: LocalUser[];
  works: V4WorkRecord[];
}

interface V5WorkImageState {
  sourceKind: "upload" | "drawing" | null;
  sourceDataUrl: string | null;
  shape: "square" | "rectangle" | "circle";
  widthMm: number;
  heightMm: number;
  backgroundRules: Array<{
    id: string;
    color: string | null;
    tolerance: number;
  }>;
  effectMode: "silhouette" | "outline";
  outlineThickness: number;
  processingVersion: 3;
}

interface V5WorkBinaryState {
  overlayData: string | null;
  overlayWidth: number | null;
  overlayHeight: number | null;
  generationSignature: string | null;
  brushSize: number;
  carvingMode: "yang" | "yin";
  orientation: "normal" | "mirror";
  borderStyle: "none" | "single" | "double" | "broken";
  borderThickness: number;
  editVersion: 2;
}

interface V5WorkRecord {
  id: string;
  ownerId: string;
  name: string;
  status: WorkRecord["status"];
  createdAt: string;
  lastSavedAt: string;
  imageState: V5WorkImageState;
  binaryState: V5WorkBinaryState;
}

interface V5AppState {
  version: 5;
  activeUserId: string | null;
  users: LocalUser[];
  works: V5WorkRecord[];
}

interface V6WorkImageState {
  sourceKind: "upload" | "drawing" | null;
  sourceDataUrl: string | null;
  shape: "square" | "rectangle" | "circle";
  widthMm: number;
  heightMm: number;
  backgroundRules: Array<{
    id: string;
    color: string | null;
    tolerance: number;
  }>;
  effectMode: "silhouette" | "outline";
  outlineThickness: number;
  sharpenAmount: number;
  outerMarginPercent: number;
  imageEraserSize: number;
  processingVersion: 4;
}

interface V6WorkBinaryState {
  overlayData: string | null;
  overlayWidth: number | null;
  overlayHeight: number | null;
  generationSignature: string | null;
  brushSize: number;
  eraserSize: number;
  carvingMode: "yang" | "yin";
  orientation: "normal" | "mirror";
  borderStyle: "none" | "single" | "double" | "broken";
  borderThickness: number;
  editVersion: 3;
}

interface V6WorkRecord {
  id: string;
  ownerId: string;
  name: string;
  status: WorkRecord["status"];
  createdAt: string;
  lastSavedAt: string;
  imageState: V6WorkImageState;
  binaryState: V6WorkBinaryState;
}

interface V6AppState {
  version: 6;
  activeUserId: string | null;
  users: LocalUser[];
  works: V6WorkRecord[];
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
    isV1WorkRecord(value) &&
    isLegacyWorkImageState((value as unknown as Record<string, unknown>).imageState)
  );
}

function isV3AppState(value: unknown): value is V3AppState {
  return (
    isRecord(value) &&
    value.version === 3 &&
    (value.activeUserId === null || typeof value.activeUserId === "string") &&
    Array.isArray(value.users) &&
    value.users.every(isLocalUser) &&
    Array.isArray(value.works) &&
    value.works.every(isV3WorkRecord)
  );
}

function isV3WorkRecord(value: unknown): value is V3WorkRecord {
  return (
    isV2WorkRecord(value) &&
    isLegacyWorkBinaryState((value as unknown as Record<string, unknown>).binaryState)
  );
}

function isV4AppState(value: unknown): value is V4AppState {
  return (
    isRecord(value) &&
    value.version === 4 &&
    (value.activeUserId === null || typeof value.activeUserId === "string") &&
    Array.isArray(value.users) &&
    value.users.every(isLocalUser) &&
    Array.isArray(value.works) &&
    value.works.every(isV4WorkRecord)
  );
}

function isV4WorkRecord(value: unknown): value is V4WorkRecord {
  return (
    isV1WorkRecord(value) &&
    isV4WorkImageState(
      (value as unknown as Record<string, unknown>).imageState,
    ) &&
    isV4WorkBinaryState(
      (value as unknown as Record<string, unknown>).binaryState,
    )
  );
}

function isV4WorkImageState(value: unknown): value is V4WorkImageState {
  return (
    isRecord(value) &&
    (value.sourceKind === null ||
      value.sourceKind === "upload" ||
      value.sourceKind === "drawing") &&
    (value.sourceDataUrl === null || typeof value.sourceDataUrl === "string") &&
    (value.shape === "square" ||
      value.shape === "rectangle" ||
      value.shape === "circle") &&
    typeof value.widthMm === "number" &&
    typeof value.heightMm === "number" &&
    Array.isArray(value.backgroundRules) &&
    value.backgroundRules.length <= MAX_BACKGROUND_RULES &&
    value.backgroundRules.every(isBackgroundRule) &&
    (value.effectMode === "silhouette" || value.effectMode === "outline") &&
    value.processingVersion === 2
  );
}

function isV4WorkBinaryState(value: unknown): value is V4WorkBinaryState {
  return (
    isRecord(value) &&
    isOverlayState(value) &&
    typeof value.brushSize === "number" &&
    Number.isInteger(value.brushSize) &&
    value.brushSize >= 1 &&
    value.brushSize <= 32 &&
    (value.carvingMode === "yang" || value.carvingMode === "yin") &&
    (value.orientation === "normal" || value.orientation === "mirror") &&
    isLegacyBorderStyle(value.borderStyle) &&
    typeof value.borderThickness === "number" &&
    Number.isInteger(value.borderThickness) &&
    value.borderThickness >= MIN_BORDER_THICKNESS &&
    value.borderThickness <= MAX_BORDER_THICKNESS &&
    value.editVersion === 2
  );
}

function isV5AppState(value: unknown): value is V5AppState {
  return (
    isRecord(value) &&
    value.version === 5 &&
    (value.activeUserId === null || typeof value.activeUserId === "string") &&
    Array.isArray(value.users) &&
    value.users.every(isLocalUser) &&
    Array.isArray(value.works) &&
    value.works.every(isV5WorkRecord)
  );
}

function isV5WorkRecord(value: unknown): value is V5WorkRecord {
  return (
    isV1WorkRecord(value) &&
    isV5WorkImageState(
      (value as unknown as Record<string, unknown>).imageState,
    ) &&
    isV5WorkBinaryState(
      (value as unknown as Record<string, unknown>).binaryState,
    )
  );
}

function isV5WorkImageState(value: unknown): value is V5WorkImageState {
  return (
    isRecord(value) &&
    (value.sourceKind === null ||
      value.sourceKind === "upload" ||
      value.sourceKind === "drawing") &&
    (value.sourceDataUrl === null || typeof value.sourceDataUrl === "string") &&
    (value.shape === "square" ||
      value.shape === "rectangle" ||
      value.shape === "circle") &&
    typeof value.widthMm === "number" &&
    typeof value.heightMm === "number" &&
    Array.isArray(value.backgroundRules) &&
    value.backgroundRules.length <= MAX_BACKGROUND_RULES &&
    value.backgroundRules.every(isBackgroundRule) &&
    (value.effectMode === "silhouette" || value.effectMode === "outline") &&
    typeof value.outlineThickness === "number" &&
    Number.isInteger(value.outlineThickness) &&
    value.outlineThickness >= MIN_OUTLINE_THICKNESS &&
    value.outlineThickness <= MAX_OUTLINE_THICKNESS &&
    value.processingVersion === 3
  );
}

function isV5WorkBinaryState(value: unknown): value is V5WorkBinaryState {
  return (
    isRecord(value) &&
    isOverlayState(value) &&
    typeof value.brushSize === "number" &&
    Number.isInteger(value.brushSize) &&
    value.brushSize >= 1 &&
    value.brushSize <= 32 &&
    (value.carvingMode === "yang" || value.carvingMode === "yin") &&
    (value.orientation === "normal" || value.orientation === "mirror") &&
    isCurrentBorderStyle(value.borderStyle) &&
    typeof value.borderThickness === "number" &&
    Number.isInteger(value.borderThickness) &&
    value.borderThickness >= MIN_BORDER_THICKNESS &&
    value.borderThickness <= MAX_BORDER_THICKNESS &&
    value.editVersion === 2
  );
}

function isV6AppState(value: unknown): value is V6AppState {
  return (
    isRecord(value) &&
    value.version === 6 &&
    (value.activeUserId === null || typeof value.activeUserId === "string") &&
    Array.isArray(value.users) &&
    value.users.every(isLocalUser) &&
    Array.isArray(value.works) &&
    value.works.every(isV6WorkRecord)
  );
}

function isV6WorkRecord(value: unknown): value is V6WorkRecord {
  return (
    isV1WorkRecord(value) &&
    isV6WorkImageState(
      (value as unknown as Record<string, unknown>).imageState,
    ) &&
    isV6WorkBinaryState(
      (value as unknown as Record<string, unknown>).binaryState,
    )
  );
}

function isV6WorkImageState(value: unknown): value is V6WorkImageState {
  return (
    isRecord(value) &&
    (value.sourceKind === null ||
      value.sourceKind === "upload" ||
      value.sourceKind === "drawing") &&
    (value.sourceDataUrl === null || typeof value.sourceDataUrl === "string") &&
    (value.shape === "square" ||
      value.shape === "rectangle" ||
      value.shape === "circle") &&
    typeof value.widthMm === "number" &&
    typeof value.heightMm === "number" &&
    Array.isArray(value.backgroundRules) &&
    value.backgroundRules.length <= MAX_BACKGROUND_RULES &&
    value.backgroundRules.every(isBackgroundRule) &&
    (value.effectMode === "silhouette" || value.effectMode === "outline") &&
    typeof value.outlineThickness === "number" &&
    Number.isInteger(value.outlineThickness) &&
    value.outlineThickness >= MIN_OUTLINE_THICKNESS &&
    value.outlineThickness <= MAX_OUTLINE_THICKNESS &&
    typeof value.sharpenAmount === "number" &&
    Number.isInteger(value.sharpenAmount) &&
    value.sharpenAmount >= MIN_SHARPEN_AMOUNT &&
    value.sharpenAmount <= MAX_SHARPEN_AMOUNT &&
    typeof value.outerMarginPercent === "number" &&
    Number.isInteger(value.outerMarginPercent) &&
    value.outerMarginPercent >= 0 &&
    value.outerMarginPercent <= 20 &&
    typeof value.imageEraserSize === "number" &&
    Number.isInteger(value.imageEraserSize) &&
    value.imageEraserSize >= MIN_IMAGE_ERASER_SIZE &&
    value.imageEraserSize <= MAX_IMAGE_ERASER_SIZE &&
    value.processingVersion === 4
  );
}

function isV6WorkBinaryState(value: unknown): value is V6WorkBinaryState {
  return (
    isRecord(value) &&
    isOverlayState(value) &&
    typeof value.brushSize === "number" &&
    Number.isInteger(value.brushSize) &&
    value.brushSize >= 1 &&
    value.brushSize <= 32 &&
    typeof value.eraserSize === "number" &&
    Number.isInteger(value.eraserSize) &&
    value.eraserSize >= 1 &&
    value.eraserSize <= 32 &&
    (value.carvingMode === "yang" || value.carvingMode === "yin") &&
    (value.orientation === "normal" || value.orientation === "mirror") &&
    isCurrentBorderStyle(value.borderStyle) &&
    typeof value.borderThickness === "number" &&
    Number.isInteger(value.borderThickness) &&
    value.borderThickness >= MIN_BORDER_THICKNESS &&
    value.borderThickness <= MAX_BORDER_THICKNESS &&
    value.editVersion === 3
  );
}

function isLegacyWorkImageState(value: unknown): value is LegacyWorkImageState {
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

function isLegacyWorkBinaryState(value: unknown): value is LegacyWorkBinaryState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOverlayState(value) &&
    typeof value.brushSize === "number" &&
    Number.isInteger(value.brushSize) &&
    value.brushSize >= 1 &&
    value.brushSize <= 32 &&
    (value.carvingMode === "yang" || value.carvingMode === "yin") &&
    (value.orientation === "normal" || value.orientation === "mirror") &&
    isLegacyBorderStyle(value.borderStyle) &&
    value.editVersion === 1
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
      imageState: migrateLegacyImageState(work.imageState),
      binaryState: createDefaultWorkBinaryState(),
    })),
  };
}

function migrateV3State(state: V3AppState): AppState {
  return {
    version: APP_STORAGE_VERSION,
    activeUserId: state.activeUserId,
    users: state.users,
    works: state.works.map((work) => {
      const imageState = migrateLegacyImageState(work.imageState);
      return {
        ...work,
        imageState,
        binaryState: migrateLegacyBinaryState(work.binaryState, imageState),
      };
    }),
  };
}

function migrateV4State(state: V4AppState): AppState {
  return {
    version: APP_STORAGE_VERSION,
    activeUserId: state.activeUserId,
    users: state.users,
    works: state.works.map((work) => {
      const imageState = migrateV4ImageState(work.imageState);
      return {
        ...work,
        imageState,
        binaryState: migrateV4BinaryState(work.binaryState, imageState),
      };
    }),
  };
}

function migrateV5State(state: V5AppState): AppState {
  return {
    version: APP_STORAGE_VERSION,
    activeUserId: state.activeUserId,
    users: state.users,
    works: state.works.map((work) => {
      const imageState = migrateV5ImageState(work.imageState);
      return {
        ...work,
        imageState,
        binaryState: migrateV5BinaryState(work.binaryState, imageState),
      };
    }),
  };
}

function migrateV6State(state: V6AppState): AppState {
  return {
    version: APP_STORAGE_VERSION,
    activeUserId: state.activeUserId,
    users: state.users,
    works: state.works.map((work) => {
      const imageState = migrateV6ImageState(work.imageState);
      return {
        ...work,
        imageState,
        binaryState: migrateV6BinaryState(work.binaryState, imageState),
      };
    }),
  };
}

function migrateLegacyImageState(state: LegacyWorkImageState): WorkImageState {
  const shape =
    state.shape === "custom"
      ? state.widthMm === state.heightMm
        ? "square"
        : "rectangle"
      : state.shape;
  return {
    sourceKind: state.sourceKind,
    sourceDataUrl: state.sourceDataUrl,
    shape,
    widthMm: state.widthMm,
    heightMm: state.heightMm,
    backgroundRules:
      state.backgroundColor === null
        ? []
        : [
            {
              id: "legacy-background-1",
              color: state.backgroundColor,
              tolerance: state.tolerance,
            },
          ],
    effectMode: state.effectMode,
    outlineThickness: DEFAULT_OUTLINE_THICKNESS,
    sharpenAmount: DEFAULT_SHARPEN_AMOUNT,
    outerMarginMm: DEFAULT_OUTER_MARGIN_MM,
    imageEraserSize: DEFAULT_IMAGE_ERASER_SIZE,
    processingVersion: 5,
  };
}

function migrateLegacyBinaryState(
  state: LegacyWorkBinaryState,
  imageState: WorkImageState,
): WorkBinaryEditState {
  return {
    overlayData: state.overlayData,
    overlayWidth: state.overlayWidth,
    overlayHeight: state.overlayHeight,
    generationSignature:
      state.overlayData === null
        ? null
        : createGenerationSignature(imageState),
    brushSize: state.brushSize,
    eraserSize: DEFAULT_BINARY_ERASER_SIZE,
    carvingMode: state.carvingMode,
    orientation: state.orientation,
    ...migrateBorder(state.borderStyle, DEFAULT_BORDER_THICKNESS),
    borderMarginMm: DEFAULT_BORDER_MARGIN_MM,
    editVersion: 4,
  };
}

function migrateV4ImageState(state: V4WorkImageState): WorkImageState {
  return {
    sourceKind: state.sourceKind,
    sourceDataUrl: state.sourceDataUrl,
    shape: state.shape,
    widthMm: state.widthMm,
    heightMm: state.heightMm,
    backgroundRules: state.backgroundRules,
    effectMode: state.effectMode,
    outlineThickness: DEFAULT_OUTLINE_THICKNESS,
    sharpenAmount: DEFAULT_SHARPEN_AMOUNT,
    outerMarginMm: DEFAULT_OUTER_MARGIN_MM,
    imageEraserSize: DEFAULT_IMAGE_ERASER_SIZE,
    processingVersion: 5,
  };
}

function migrateV4BinaryState(
  state: V4WorkBinaryState,
  imageState: WorkImageState,
): WorkBinaryEditState {
  return {
    overlayData: state.overlayData,
    overlayWidth: state.overlayWidth,
    overlayHeight: state.overlayHeight,
    generationSignature:
      state.overlayData === null
        ? null
        : createGenerationSignature(imageState),
    brushSize: state.brushSize,
    eraserSize: DEFAULT_BINARY_ERASER_SIZE,
    carvingMode: state.carvingMode,
    orientation: state.orientation,
    ...migrateBorder(state.borderStyle, state.borderThickness),
    borderMarginMm: DEFAULT_BORDER_MARGIN_MM,
    editVersion: 4,
  };
}

function migrateV5ImageState(state: V5WorkImageState): WorkImageState {
  return {
    sourceKind: state.sourceKind,
    sourceDataUrl: state.sourceDataUrl,
    shape: state.shape,
    widthMm: state.widthMm,
    heightMm: state.heightMm,
    backgroundRules: state.backgroundRules,
    effectMode: state.effectMode,
    outlineThickness: state.outlineThickness,
    sharpenAmount: DEFAULT_SHARPEN_AMOUNT,
    outerMarginMm: DEFAULT_OUTER_MARGIN_MM,
    imageEraserSize: DEFAULT_IMAGE_ERASER_SIZE,
    processingVersion: 5,
  };
}

function migrateV5BinaryState(
  state: V5WorkBinaryState,
  imageState: WorkImageState,
): WorkBinaryEditState {
  return {
    overlayData: state.overlayData,
    overlayWidth: state.overlayWidth,
    overlayHeight: state.overlayHeight,
    generationSignature:
      state.overlayData === null
        ? null
        : createGenerationSignature(imageState),
    brushSize: state.brushSize,
    eraserSize: DEFAULT_BINARY_ERASER_SIZE,
    carvingMode: state.carvingMode,
    orientation: state.orientation,
    borderStyle: state.borderStyle,
    borderThickness: state.borderThickness,
    borderMarginMm: DEFAULT_BORDER_MARGIN_MM,
    editVersion: 4,
  };
}

function migrateV6ImageState(state: V6WorkImageState): WorkImageState {
  const shortEdgeMm = Math.min(state.widthMm, state.heightMm);
  const outerMarginMm =
    Math.round(
      shortEdgeMm * (state.outerMarginPercent / 100) * 10,
    ) / 10;
  return {
    sourceKind: state.sourceKind,
    sourceDataUrl: state.sourceDataUrl,
    shape: state.shape,
    widthMm: state.widthMm,
    heightMm: state.heightMm,
    backgroundRules: state.backgroundRules,
    effectMode: state.effectMode,
    outlineThickness: state.outlineThickness,
    sharpenAmount: state.sharpenAmount,
    outerMarginMm,
    imageEraserSize: state.imageEraserSize,
    processingVersion: 5,
  };
}

function migrateV6BinaryState(
  state: V6WorkBinaryState,
  imageState: WorkImageState,
): WorkBinaryEditState {
  return {
    overlayData: state.overlayData,
    overlayWidth: state.overlayWidth,
    overlayHeight: state.overlayHeight,
    generationSignature:
      state.overlayData === null
        ? null
        : createGenerationSignature(imageState),
    brushSize: state.brushSize,
    eraserSize: state.eraserSize,
    carvingMode: state.carvingMode,
    orientation: state.orientation,
    borderStyle: state.borderStyle,
    borderThickness: state.borderThickness,
    borderMarginMm: DEFAULT_BORDER_MARGIN_MM,
    editVersion: 4,
  };
}

function migrateBorder(
  style: V4WorkBinaryState["borderStyle"],
  thickness: number,
): Pick<WorkBinaryEditState, "borderStyle" | "borderThickness"> {
  if (style !== "thick") {
    return {
      borderStyle: style,
      borderThickness: thickness,
    };
  }
  return {
    borderStyle: "single",
    borderThickness: Math.min(
      MAX_BORDER_THICKNESS,
      Math.max(MIN_BORDER_THICKNESS, Math.round(thickness * 2)),
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
