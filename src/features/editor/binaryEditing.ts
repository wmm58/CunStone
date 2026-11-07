import type {
  CarvingMode,
  WorkBinaryEditState,
} from "../../domain/types";
import type { RgbaImage } from "./imageProcessing";

export type EditTool = "brush" | "eraser";
export type OverlayValue = 0 | 1 | 2;

export interface PixelPoint {
  x: number;
  y: number;
}

export interface OverlayHistory {
  undo: string[];
  redo: string[];
}

export function createEmptyOverlay(width: number, height: number): Uint8Array {
  return new Uint8Array(Math.max(0, width * height));
}

export function hasManualEdits(overlay: Uint8Array | null): boolean {
  return Boolean(overlay?.some((value) => value !== 0));
}

export function applyManualOverlay(
  base: RgbaImage,
  overlay: Uint8Array,
): RgbaImage {
  const data = new Uint8ClampedArray(base.data);
  const pixelCount = base.width * base.height;

  if (overlay.length !== pixelCount) {
    return { ...base, data };
  }

  for (let index = 0; index < pixelCount; index += 1) {
    const value = overlay[index];
    if (value === 0) {
      continue;
    }
    const color = value === 1 ? 0 : 255;
    data.set([color, color, color, 255], index * 4);
  }

  return { ...base, data };
}

export function mapFinalPointToNeutral(
  point: PixelPoint,
  width: number,
  mirrored: boolean,
): PixelPoint {
  const clampedX = Math.min(width - 1, Math.max(0, Math.floor(point.x)));
  return {
    x: mirrored ? width - 1 - clampedX : clampedX,
    y: Math.max(0, Math.floor(point.y)),
  };
}

export function getNeutralOverlayValue(
  tool: EditTool,
  carvingMode: CarvingMode,
): OverlayValue {
  if (tool === "brush") {
    return carvingMode === "yin" ? 2 : 1;
  }
  return carvingMode === "yin" ? 1 : 2;
}

export function paintStroke(
  overlay: Uint8Array,
  width: number,
  height: number,
  from: PixelPoint,
  to: PixelPoint,
  brushSize: number,
  value: OverlayValue,
): Uint8Array {
  const next = new Uint8Array(overlay);
  const radius = Math.max(0.5, Math.min(32, brushSize) / 2);
  const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const steps = Math.max(1, Math.ceil(distance));

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const x = Math.round(from.x + (to.x - from.x) * progress);
    const y = Math.round(from.y + (to.y - from.y) * progress);
    paintCircle(next, width, height, x, y, radius, value);
  }

  return next;
}

export function recordStrokeHistory(
  history: OverlayHistory,
  beforeSnapshot: string,
  maxSnapshots = 20,
): OverlayHistory {
  return {
    undo: [...history.undo, beforeSnapshot].slice(-maxSnapshots),
    redo: [],
  };
}

export function undoOverlay(
  history: OverlayHistory,
  currentSnapshot: string,
  maxSnapshots = 20,
):
  | { snapshot: string; history: OverlayHistory }
  | null {
  const snapshot = history.undo.at(-1);
  if (snapshot === undefined) {
    return null;
  }

  return {
    snapshot,
    history: {
      undo: history.undo.slice(0, -1),
      redo: [...history.redo, currentSnapshot].slice(-maxSnapshots),
    },
  };
}

export function redoOverlay(
  history: OverlayHistory,
  currentSnapshot: string,
  maxSnapshots = 20,
):
  | { snapshot: string; history: OverlayHistory }
  | null {
  const snapshot = history.redo.at(-1);
  if (snapshot === undefined) {
    return null;
  }

  return {
    snapshot,
    history: {
      undo: [...history.undo, currentSnapshot].slice(-maxSnapshots),
      redo: history.redo.slice(0, -1),
    },
  };
}

export function clearManualEdits(
  state: WorkBinaryEditState,
): WorkBinaryEditState {
  return {
    ...state,
    overlayData: null,
    overlayWidth: null,
    overlayHeight: null,
    generationSignature: null,
  };
}

function paintCircle(
  overlay: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
  value: OverlayValue,
): void {
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(height - 1, Math.ceil(centerY + radius));
  const radiusSquared = radius ** 2;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radiusSquared) {
        overlay[y * width + x] = value;
      }
    }
  }
}
