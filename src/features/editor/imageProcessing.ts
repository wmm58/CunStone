import type { EffectMode, SealShape, WorkImageState } from "../../domain/types";

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface MaskBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BinaryMask {
  width: number;
  height: number;
  mask: Uint8Array;
}

const MAX_RGB_DISTANCE = Math.sqrt(3) * 255;

export function parseHexColor(input: string): RgbColor | null {
  const value = input.trim().replace(/^#/, "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${[r, g, b]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function colorDistance(left: RgbColor, right: RgbColor): number {
  return Math.sqrt(
    (left.r - right.r) ** 2 +
      (left.g - right.g) ** 2 +
      (left.b - right.b) ** 2,
  );
}

export function toleranceToDistance(tolerance: number): number {
  return (Math.min(100, Math.max(0, tolerance)) / 100) * MAX_RGB_DISTANCE;
}

export function createSubjectMask(
  source: RgbaImage,
  backgroundColor: string | null,
  tolerance: number,
): Uint8Array {
  const background = backgroundColor ? parseHexColor(backgroundColor) : null;
  const threshold = toleranceToDistance(tolerance);
  const mask = new Uint8Array(source.width * source.height);

  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const alpha = source.data[offset + 3];
    if (alpha === 0) {
      continue;
    }

    if (background) {
      const distance = colorDistance(
        {
          r: source.data[offset],
          g: source.data[offset + 1],
          b: source.data[offset + 2],
        },
        background,
      );
      if (distance <= threshold) {
        continue;
      }
    }

    mask[index] = 1;
  }

  return mask;
}

export function findMaskBounds(
  mask: Uint8Array,
  width: number,
  height: number,
): MaskBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] === 0) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function cropMask(
  mask: Uint8Array,
  width: number,
  _height: number,
  bounds: MaskBounds,
): BinaryMask {
  const cropped = new Uint8Array(bounds.width * bounds.height);
  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      cropped[y * bounds.width + x] =
        mask[(bounds.y + y) * width + bounds.x + x];
    }
  }
  return { width: bounds.width, height: bounds.height, mask: cropped };
}

export function sharpenMask(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const center = mask[y * width + x];
      const top = y > 0 ? mask[(y - 1) * width + x] : 0;
      const bottom = y < height - 1 ? mask[(y + 1) * width + x] : 0;
      const left = x > 0 ? mask[y * width + x - 1] : 0;
      const right = x < width - 1 ? mask[y * width + x + 1] : 0;
      result[y * width + x] =
        center * 5 - top - bottom - left - right >= 1 ? 1 : 0;
    }
  }
  return result;
}

export function fitMaskToShape(
  mask: Uint8Array,
  width: number,
  height: number,
  shape: SealShape,
  widthMm: number,
  heightMm: number,
  maxDimension = 512,
): BinaryMask {
  const dimensions = getDraftDimensions(shape, widthMm, heightMm, maxDimension);
  const output = new Uint8Array(dimensions.width * dimensions.height);
  const inner = getInnerFitSize(shape, dimensions.width, dimensions.height);
  const scale = Math.min(inner.width / width, inner.height / height);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const offsetX = Math.floor((dimensions.width - targetWidth) / 2);
  const offsetY = Math.floor((dimensions.height - targetHeight) / 2);

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor((y / targetHeight) * height));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x / targetWidth) * width));
      if (mask[sourceY * width + sourceX] === 0) {
        continue;
      }
      const outputX = offsetX + x;
      const outputY = offsetY + y;
      if (insideShape(outputX, outputY, shape, dimensions.width, dimensions.height)) {
        output[outputY * dimensions.width + outputX] = 1;
      }
    }
  }

  return {
    width: dimensions.width,
    height: dimensions.height,
    mask: output,
  };
}

export function createCutoutImage(
  source: RgbaImage,
  backgroundColor: string | null,
  tolerance: number,
): RgbaImage {
  const background = backgroundColor ? parseHexColor(backgroundColor) : null;
  const threshold = toleranceToDistance(tolerance);
  const data = new Uint8ClampedArray(source.data);

  if (!background) {
    return { ...source, data };
  }

  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) {
      continue;
    }
    const distance = colorDistance(
      { r: data[offset], g: data[offset + 1], b: data[offset + 2] },
      background,
    );
    if (distance <= threshold) {
      data[offset + 3] = 0;
    }
  }

  return { ...source, data };
}

export function renderBinaryDraft(
  source: RgbaImage,
  state: WorkImageState,
): RgbaImage {
  const mask = sharpenMask(
    createSubjectMask(source, state.backgroundColor, state.tolerance),
    source.width,
    source.height,
  );
  const bounds = findMaskBounds(mask, source.width, source.height);

  if (!bounds) {
    return createBlankDraft(state.shape, state.widthMm, state.heightMm);
  }

  const cropped = cropMask(mask, source.width, source.height, bounds);
  const fitted = fitMaskToShape(
    cropped.mask,
    cropped.width,
    cropped.height,
    state.shape,
    state.widthMm,
    state.heightMm,
  );
  return renderBinaryMask(fitted, state.effectMode);
}

export function isBinaryBlackWhite(image: RgbaImage): boolean {
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] !== 255) {
      return false;
    }
    const isBlack =
      image.data[offset] === 0 &&
      image.data[offset + 1] === 0 &&
      image.data[offset + 2] === 0;
    const isWhite =
      image.data[offset] === 255 &&
      image.data[offset + 1] === 255 &&
      image.data[offset + 2] === 255;
    if (!isBlack && !isWhite) {
      return false;
    }
  }
  return true;
}

function createBlankDraft(
  shape: SealShape,
  widthMm: number,
  heightMm: number,
): RgbaImage {
  const { width, height } = getDraftDimensions(shape, widthMm, heightMm);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.set([255, 255, 255, 255], offset);
  }
  return { width, height, data };
}

function renderBinaryMask(mask: BinaryMask, effectMode: EffectMode): RgbaImage {
  const data = new Uint8ClampedArray(mask.width * mask.height * 4);

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const black =
        effectMode === "silhouette"
          ? mask.mask[y * mask.width + x] === 1
          : isOutlinePixel(mask.mask, mask.width, mask.height, x, y);
      data.set(black ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * mask.width + x) * 4);
    }
  }

  return { width: mask.width, height: mask.height, data };
}

function isOutlinePixel(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  if (mask[y * width + x] === 0) {
    return false;
  }
  return (
    x === 0 ||
    y === 0 ||
    x === width - 1 ||
    y === height - 1 ||
    mask[y * width + x - 1] === 0 ||
    mask[y * width + x + 1] === 0 ||
    mask[(y - 1) * width + x] === 0 ||
    mask[(y + 1) * width + x] === 0
  );
}

function getDraftDimensions(
  shape: SealShape,
  widthMm: number,
  heightMm: number,
  maxDimension = 512,
): { width: number; height: number } {
  if (shape === "square" || shape === "circle") {
    return { width: maxDimension, height: maxDimension };
  }

  if (widthMm >= heightMm) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round(maxDimension * (heightMm / widthMm))),
    };
  }

  return {
    width: Math.max(1, Math.round(maxDimension * (widthMm / heightMm))),
    height: maxDimension,
  };
}

function getInnerFitSize(
  shape: SealShape,
  width: number,
  height: number,
): { width: number; height: number } {
  if (shape === "circle") {
    const side = (Math.min(width, height) * 0.95) / Math.SQRT2;
    return { width: side, height: side };
  }
  return { width: width * 0.9, height: height * 0.9 };
}

function insideShape(
  x: number,
  y: number,
  shape: SealShape,
  width: number,
  height: number,
): boolean {
  if (shape !== "circle") {
    return true;
  }
  const radiusX = width / 2;
  const radiusY = height / 2;
  return ((x + 0.5 - radiusX) / radiusX) ** 2 + ((y + 0.5 - radiusY) / radiusY) ** 2 <= 1;
}
