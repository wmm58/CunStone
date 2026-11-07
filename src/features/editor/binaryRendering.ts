import type {
  BorderStyle,
  SealShape,
  WorkBinaryEditState,
  WorkImageState,
} from "../../domain/types";
import { applyManualOverlay } from "./binaryEditing";
import type { RgbaImage } from "./imageProcessing";

export function createGenerationSignature(state: WorkImageState): string {
  const source = [
    state.sourceDataUrl ?? "",
    state.shape,
    state.widthMm,
    state.heightMm,
    state.backgroundColor ?? "",
    state.tolerance,
    state.effectMode,
    state.processingVersion,
  ].join("\u001f");

  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }

  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export function invertBinary(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data);
  for (let offset = 0; offset < data.length; offset += 4) {
    const value = data[offset] < 128 ? 255 : 0;
    data.set([value, value, value, 255], offset);
  }
  return { ...image, data };
}

export function mirrorBinary(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sourceOffset = (y * image.width + x) * 4;
      const targetOffset = (y * image.width + (image.width - 1 - x)) * 4;
      data.set(image.data.subarray(sourceOffset, sourceOffset + 4), targetOffset);
    }
  }
  return { ...image, data };
}

export function applyBorder(
  image: RgbaImage,
  style: BorderStyle,
  shape: SealShape,
): RgbaImage {
  if (style === "none") {
    return { ...image, data: new Uint8ClampedArray(image.data) };
  }

  const result = { ...image, data: new Uint8ClampedArray(image.data) };
  const minDimension = Math.min(image.width, image.height);
  const outerInset = Math.max(1, Math.round(minDimension * 0.04));
  const thinThickness = Math.max(1, Math.round(minDimension * 0.0125));
  const thickThickness = Math.max(2, Math.round(minDimension * 0.04));
  const gap = Math.max(1, Math.round(minDimension * 0.015));

  if (shape === "circle") {
    drawCircleBands(result, style, outerInset, thinThickness, thickThickness, gap);
    return result;
  }

  if (style === "double") {
    drawRectangleBand(result, outerInset, thinThickness, false);
    drawRectangleBand(result, outerInset + thinThickness + gap, thinThickness, false);
    return result;
  }

  const thickness = style === "thick" ? thickThickness : thinThickness;
  drawRectangleBand(result, outerInset, thickness, style === "broken");
  return result;
}

export function renderFinalBinary(
  base: RgbaImage,
  overlay: Uint8Array,
  binaryState: WorkBinaryEditState,
  shape: SealShape,
): RgbaImage {
  const combined = applyManualOverlay(base, overlay);
  const bordered = applyBorder(combined, binaryState.borderStyle, shape);
  const carved =
    binaryState.carvingMode === "yin" ? invertBinary(bordered) : bordered;
  const oriented =
    binaryState.orientation === "mirror" ? mirrorBinary(carved) : carved;
  return ensurePureBlackWhite(oriented);
}

function drawRectangleBand(
  image: RgbaImage,
  inset: number,
  thickness: number,
  broken: boolean,
): void {
  const startX = inset;
  const endX = image.width - inset - 1;
  const startY = inset;
  const endY = image.height - inset - 1;
  if (startX > endX || startY > endY) {
    return;
  }

  const blockSize = Math.max(3, Math.round(Math.min(image.width, image.height) * 0.12));

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const vertical =
        (x >= startX && x < startX + thickness) ||
        (x <= endX && x > endX - thickness);
      const horizontal =
        (y >= startY && y < startY + thickness) ||
        (y <= endY && y > endY - thickness);
      if (!vertical && !horizontal) {
        continue;
      }

      if (broken) {
        const side = horizontal ? (y < image.height / 2 ? 0 : 1) : x < image.width / 2 ? 2 : 3;
        const coordinate = side < 2 ? x : y;
        const block = Math.floor(coordinate / blockSize) + side * 97;
        if (stableHash(block, image.width, image.height) % 6 === 0) {
          continue;
        }
      }

      setBlack(image, x, y);
    }
  }
}

function drawCircleBands(
  image: RgbaImage,
  style: BorderStyle,
  outerInset: number,
  thinThickness: number,
  thickThickness: number,
  gap: number,
): void {
  const centerX = image.width / 2;
  const centerY = image.height / 2;
  const radiusX = image.width / 2;
  const radiusY = image.height / 2;
  const minRadius = Math.min(radiusX, radiusY);
  const definitions =
    style === "double"
      ? [
          { inset: outerInset, thickness: thinThickness },
          { inset: outerInset + thinThickness + gap, thickness: thinThickness },
        ]
      : [
          {
            inset: outerInset,
            thickness: style === "thick" ? thickThickness : thinThickness,
          },
        ];

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const nx = (x + 0.5 - centerX) / radiusX;
      const ny = (y + 0.5 - centerY) / radiusY;
      const distance = Math.sqrt(nx * nx + ny * ny);
      const matchesBand = definitions.some(({ inset, thickness }) => {
        const outer = 1 - inset / minRadius;
        const inner = outer - thickness / minRadius;
        return distance <= outer && distance >= inner;
      });
      if (!matchesBand) {
        continue;
      }

      if (style === "broken") {
        const angle = Math.atan2(ny, nx) + Math.PI;
        const segment = Math.floor((angle / (Math.PI * 2)) * 48);
        if (stableHash(segment, image.width, image.height) % 5 === 0) {
          continue;
        }
      }

      setBlack(image, x, y);
    }
  }
}

function setBlack(image: RgbaImage, x: number, y: number): void {
  image.data.set([0, 0, 0, 255], (y * image.width + x) * 4);
}

function stableHash(value: number, width: number, height: number): number {
  let hash = Math.imul(value + 1, 0x45d9f3b);
  hash ^= Math.imul(width, 0x27d4eb2d);
  hash ^= Math.imul(height, 0x165667b1);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function ensurePureBlackWhite(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const value = image.data[offset] < 128 ? 0 : 255;
    data.set([value, value, value, 255], offset);
  }
  return { ...image, data };
}
