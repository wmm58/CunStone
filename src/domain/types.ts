export type WorkStatus = "draft" | "completed";
export type SealShape = "square" | "rectangle" | "circle";
export type EffectMode = "silhouette" | "outline";
export type ImageSourceKind = "upload";
export type CarvingMode = "yang" | "yin";
export type SealOrientation = "normal" | "mirror";
export type BorderStyle = "none" | "single" | "double";

export const MAX_BACKGROUND_RULES = 10;
export const DEFAULT_BACKGROUND_TOLERANCE = 20;
export const DEFAULT_BORDER_THICKNESS = 2;
export const MIN_BORDER_THICKNESS = 1;
export const MAX_BORDER_THICKNESS = 8;
export const DEFAULT_OUTLINE_THICKNESS = 1;
export const MIN_OUTLINE_THICKNESS = 1;
export const MAX_OUTLINE_THICKNESS = 8;
export const DEFAULT_SHARPEN_AMOUNT = 1;
export const MIN_SHARPEN_AMOUNT = 0;
export const MAX_SHARPEN_AMOUNT = 8;
export const DEFAULT_OUTER_MARGIN_MM = 0;
export const MIN_OUTER_MARGIN_MM = 0;
export const MAX_OUTER_MARGIN_MM = 20;
export const OUTER_MARGIN_STEP_MM = 0.1;
export const DEFAULT_BORDER_MARGIN_MM = 0;
export const MIN_BORDER_MARGIN_MM = 0;
export const MAX_BORDER_MARGIN_MM = 20;
export const BORDER_MARGIN_STEP_MM = 0.1;
export const DEFAULT_IMAGE_ERASER_SIZE = 24;
export const MIN_IMAGE_ERASER_SIZE = 1;
export const MAX_IMAGE_ERASER_SIZE = 80;
export const DEFAULT_BINARY_ERASER_SIZE = 6;

export interface BackgroundRemovalRule {
  id: string;
  color: string | null;
  tolerance: number;
}

export interface WorkImageState {
  sourceKind: ImageSourceKind | null;
  sourceDataUrl: string | null;
  shape: SealShape;
  widthMm: number;
  heightMm: number;
  backgroundRules: BackgroundRemovalRule[];
  effectMode: EffectMode;
  outlineThickness: number;
  sharpenAmount: number;
  outerMarginMm: number;
  imageEraserSize: number;
  processingVersion: 5;
}

export function createDefaultWorkImageState(): WorkImageState {
  return {
    sourceKind: null,
    sourceDataUrl: null,
    shape: "square",
    widthMm: 25,
    heightMm: 25,
    backgroundRules: [],
    effectMode: "silhouette",
    outlineThickness: DEFAULT_OUTLINE_THICKNESS,
    sharpenAmount: DEFAULT_SHARPEN_AMOUNT,
    outerMarginMm: DEFAULT_OUTER_MARGIN_MM,
    imageEraserSize: DEFAULT_IMAGE_ERASER_SIZE,
    processingVersion: 5,
  };
}

export interface WorkBinaryEditState {
  overlayData: string | null;
  overlayWidth: number | null;
  overlayHeight: number | null;
  generationSignature: string | null;
  brushSize: number;
  eraserSize: number;
  carvingMode: CarvingMode;
  orientation: SealOrientation;
  borderStyle: BorderStyle;
  borderThickness: number;
  borderMarginMm: number;
  editVersion: 4;
}

export function createDefaultWorkBinaryState(): WorkBinaryEditState {
  return {
    overlayData: null,
    overlayWidth: null,
    overlayHeight: null,
    generationSignature: null,
    brushSize: 6,
    eraserSize: DEFAULT_BINARY_ERASER_SIZE,
    carvingMode: "yang",
    orientation: "normal",
    borderStyle: "none",
    borderThickness: DEFAULT_BORDER_THICKNESS,
    borderMarginMm: DEFAULT_BORDER_MARGIN_MM,
    editVersion: 4,
  };
}

export interface WorkRecord {
  id: string;
  name: string;
  status: WorkStatus;
  createdAt: string;
  lastSavedAt: string;
  imageState: WorkImageState;
  binaryState: WorkBinaryEditState;
}
