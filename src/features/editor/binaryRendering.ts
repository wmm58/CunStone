import type {
  BorderStyle,
  SealShape,
  WorkBinaryEditState,
} from "../../domain/types";
import {
  MAX_BORDER_THICKNESS,
  MIN_BORDER_THICKNESS,
} from "../../domain/types";
import { createGenerationSignature } from "../../lib/binary/generationSignature";
import { applyManualOverlay } from "./binaryEditing";
import type { RgbaImage } from "./imageProcessing";

export { createGenerationSignature };

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
  borderThickness = 2,
  borderMarginMm = 0,
  widthMm = 20,
  heightMm = 20,
): RgbaImage {
  if (style === "none") {
    return { ...image, data: new Uint8ClampedArray(image.data) };
  }

  const result = { ...image, data: new Uint8ClampedArray(image.data) };
  const minDimension = Math.min(image.width, image.height);
  const insetX = Math.max(
    0,
    Math.round((borderMarginMm / Math.max(1, widthMm)) * image.width),
  );
  const insetY = Math.max(
    0,
    Math.round((borderMarginMm / Math.max(1, heightMm)) * image.height),
  );
  const circleInset = Math.max(
    0,
    Math.round((borderMarginMm / Math.max(1, widthMm)) * minDimension),
  );
  const requestedThickness = Math.min(
    MAX_BORDER_THICKNESS,
    Math.max(MIN_BORDER_THICKNESS, Math.round(borderThickness)),
  );
  const unit = Math.max(1, Math.round(minDimension * 0.00625));
  const baseThickness = Math.max(1, unit * requestedThickness);
  const lineThickness = baseThickness;
  const gap = Math.max(1, Math.round(lineThickness * 0.75));

  if (shape === "circle") {
    drawCircleBands(result, style, circleInset, lineThickness, gap);
    return result;
  }

  if (style === "double") {
    drawRectangleBand(
      result,
      insetX,
      insetY,
      lineThickness,
    );
    drawRectangleBand(
      result,
      insetX + lineThickness + gap,
      insetY + lineThickness + gap,
      lineThickness,
    );
    return result;
  }

  drawRectangleBand(
    result,
    insetX,
    insetY,
    lineThickness,
  );
  return result;
}

export function renderFinalBinary(
  base: RgbaImage,
  overlay: Uint8Array,
  binaryState: WorkBinaryEditState,
  shape: SealShape,
  widthMm: number,
  heightMm: number,
): RgbaImage {
  const combined = applyManualOverlay(base, overlay);
  const bordered = applyBorder(
    combined,
    binaryState.borderStyle,
    shape,
    binaryState.borderThickness,
    binaryState.borderMarginMm,
    widthMm,
    heightMm,
  );
  const carved =
    binaryState.carvingMode === "yin" ? invertBinary(bordered) : bordered;
  const oriented =
    binaryState.orientation === "mirror" ? mirrorBinary(carved) : carved;
  return ensurePureBlackWhite(oriented);
}

function drawRectangleBand(
  image: RgbaImage,
  insetX: number,
  insetY: number,
  thickness: number,
): void {
  const startX = insetX;
  const endX = image.width - insetX - 1;
  const startY = insetY;
  const endY = image.height - insetY - 1;
  if (startX > endX || startY > endY) {
    return;
  }

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

      setBlack(image, x, y);
    }
  }
}

function drawCircleBands(
  image: RgbaImage,
  style: BorderStyle,
  outerInset: number,
  thickness: number,
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
          { inset: outerInset, thickness },
          { inset: outerInset + thickness + gap, thickness },
        ]
      : [
          {
            inset: outerInset,
            thickness,
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

      setBlack(image, x, y);
    }
  }
}

function setBlack(image: RgbaImage, x: number, y: number): void {
  image.data.set([0, 0, 0, 255], (y * image.width + x) * 4);
}

function ensurePureBlackWhite(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const value = image.data[offset] < 128 ? 0 : 255;
    data.set([value, value, value, 255], offset);
  }
  return { ...image, data };
}
