import {
  MAX_BACKGROUND_RULES,
  MAX_BORDER_MARGIN_MM,
  MAX_BORDER_THICKNESS,
  MAX_IMAGE_ERASER_SIZE,
  MAX_OUTLINE_THICKNESS,
  MAX_OUTER_MARGIN_MM,
  MAX_SHARPEN_AMOUNT,
  MIN_BORDER_THICKNESS,
  MIN_IMAGE_ERASER_SIZE,
  MIN_OUTLINE_THICKNESS,
  MIN_SHARPEN_AMOUNT,
  type WorkBinaryEditState,
  type WorkImageState,
  type WorkRecord,
} from "../../domain/types";
import { isValidPackedOverlay } from "../binary/overlayCodec";

export const APP_STORAGE_KEY = "cunstone:v0.1:app-state";
export const APP_STORAGE_VERSION = 8 as const;

export interface AppState {
  version: typeof APP_STORAGE_VERSION;
  works: WorkRecord[];
}

export type StorageRecovery =
  | "none"
  | "corrupt"
  | "reset-old-version";

export interface ReadAppStateResult {
  state: AppState;
  recovery: StorageRecovery;
}

export function createEmptyAppState(): AppState {
  return {
    version: APP_STORAGE_VERSION,
    works: [],
  };
}

export function readAppState(
  storage: Storage = window.localStorage,
): ReadAppStateResult {
  const raw = storage.getItem(APP_STORAGE_KEY);
  if (!raw) {
    return { state: createEmptyAppState(), recovery: "none" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    storage.removeItem(APP_STORAGE_KEY);
    return { state: createEmptyAppState(), recovery: "corrupt" };
  }

  if (isAppState(parsed)) {
    return { state: parsed, recovery: "none" };
  }

  storage.removeItem(APP_STORAGE_KEY);
  return {
    state: createEmptyAppState(),
    recovery:
      isRecord(parsed) &&
      typeof parsed.version === "number" &&
      parsed.version !== APP_STORAGE_VERSION
        ? "reset-old-version"
        : "corrupt",
  };
}

export function writeAppState(
  state: AppState,
  storage: Storage = window.localStorage,
): void {
  storage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
}

export function clearAppState(storage: Storage = window.localStorage): void {
  storage.removeItem(APP_STORAGE_KEY);
}

function isAppState(value: unknown): value is AppState {
  return (
    isRecord(value) &&
    value.version === APP_STORAGE_VERSION &&
    hasOnlyKeys(value, ["version", "works"]) &&
    Array.isArray(value.works) &&
    value.works.every(isWorkRecord)
  );
}

function isWorkRecord(value: unknown): value is WorkRecord {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "name",
      "status",
      "createdAt",
      "lastSavedAt",
      "imageState",
      "binaryState",
    ]) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
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
    (value.sourceKind === null || value.sourceKind === "upload") &&
    (value.sourceDataUrl === null || typeof value.sourceDataUrl === "string") &&
    (value.shape === "square" ||
      value.shape === "rectangle" ||
      value.shape === "circle") &&
    typeof value.widthMm === "number" &&
    Number.isFinite(value.widthMm) &&
    typeof value.heightMm === "number" &&
    Number.isFinite(value.heightMm) &&
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
    (value.borderStyle === "none" ||
      value.borderStyle === "single" ||
      value.borderStyle === "double") &&
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}
