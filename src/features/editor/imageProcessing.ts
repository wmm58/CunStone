import type {
  BackgroundRemovalRule,
  EffectMode,
  SealShape,
  WorkImageState,
} from "../../domain/types";

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

interface ParsedBackgroundRule {
  color: RgbColor;
  threshold: number;
}

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
  backgroundRules: readonly BackgroundRemovalRule[],
): Uint8Array {
  const parsedRules = parseBackgroundRules(backgroundRules);
  const mask = new Uint8Array(source.width * source.height);

  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const alpha = source.data[offset + 3];
    if (alpha === 0) {
      continue;
    }

    const color = {
      r: source.data[offset],
      g: source.data[offset + 1],
      b: source.data[offset + 2],
    };
    if (isBackgroundColor(color, parsedRules)) {
      continue;
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
  amount = 1,
): Uint8Array {
  let result = new Uint8Array(mask);
  const iterations = Math.max(0, Math.min(8, Math.round(amount)));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const current = result;
    result = new Uint8Array(mask.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (current[index] === 1) {
          result[index] = 1;
          continue;
        }
        const hasBlackNeighbor =
          (x > 0 && current[index - 1] === 1) ||
          (x < width - 1 && current[index + 1] === 1) ||
          (y > 0 && current[index - width] === 1) ||
          (y < height - 1 && current[index + width] === 1);
        if (hasBlackNeighbor) {
          result[index] = 1;
        }
      }
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
  outerMarginMm = 0,
): BinaryMask {
  const dimensions = getDraftDimensions(shape, widthMm, heightMm, maxDimension);
  const output = new Uint8Array(dimensions.width * dimensions.height);
  const inner = getInnerFitSize(
    shape,
    dimensions.width,
    dimensions.height,
    widthMm,
    heightMm,
    outerMarginMm,
  );
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
  backgroundRules: readonly BackgroundRemovalRule[],
): RgbaImage {
  const parsedRules = parseBackgroundRules(backgroundRules);
  const data = new Uint8ClampedArray(source.data);

  if (parsedRules.length === 0) {
    return { ...source, data };
  }

  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) {
      continue;
    }
    const color = {
      r: data[offset],
      g: data[offset + 1],
      b: data[offset + 2],
    };
    if (isBackgroundColor(color, parsedRules)) {
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
    createSubjectMask(source, state.backgroundRules),
    source.width,
    source.height,
    state.sharpenAmount,
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
    512,
    state.outerMarginMm,
  );
  return renderBinaryMaskWithOutline(
    fitted,
    state.effectMode,
    state.outlineThickness,
  );
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
  return renderBinaryMaskWithOutline(mask, effectMode, 1);
}

export function renderBinaryMaskWithOutline(
  mask: BinaryMask,
  effectMode: EffectMode,
  outlineThickness: number,
): RgbaImage {
  const data = new Uint8ClampedArray(mask.width * mask.height * 4);
  const outline =
    effectMode === "outline"
      ? createThickOutline(mask.mask, mask.width, mask.height, outlineThickness)
      : null;

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const black =
        effectMode === "silhouette"
          ? mask.mask[y * mask.width + x] === 1
          : outline?.[y * mask.width + x] === 1;
      data.set(black ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * mask.width + x) * 4);
    }
  }

  return { width: mask.width, height: mask.height, data };
}

function createThickOutline(
  mask: Uint8Array,
  width: number,
  height: number,
  thickness: number,
): Uint8Array {
  let outline = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isOutlinePixel(mask, width, height, x, y)) {
        outline[y * width + x] = 1;
      }
    }
  }

  const levels = Math.max(1, Math.min(8, Math.round(thickness)));
  for (let level = 1; level < levels; level += 1) {
    const next = new Uint8Array(outline);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (mask[index] === 0 || outline[index] === 1) {
          continue;
        }
        if (
          (x > 0 && outline[index - 1] === 1) ||
          (x < width - 1 && outline[index + 1] === 1) ||
          (y > 0 && outline[index - width] === 1) ||
          (y < height - 1 && outline[index + width] === 1)
        ) {
          next[index] = 1;
        }
      }
    }
    outline = next;
  }
  return outline;
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
  _shape: SealShape,
  width: number,
  height: number,
  widthMm: number,
  heightMm: number,
  outerMarginMm: number,
): { width: number; height: number } {
  const margin = Math.max(0, outerMarginMm);
  const horizontalMargin = (margin / Math.max(1, widthMm)) * width;
  const verticalMargin = (margin / Math.max(1, heightMm)) * height;
  return {
    width: Math.max(1, width - horizontalMargin * 2),
    height: Math.max(1, height - verticalMargin * 2),
  };
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

function parseBackgroundRules(
  rules: readonly BackgroundRemovalRule[],
): ParsedBackgroundRule[] {
  const parsed: ParsedBackgroundRule[] = [];
  for (const rule of rules) {
    if (!rule.color) {
      continue;
    }
    const color = parseHexColor(rule.color);
    if (color) {
      parsed.push({
        color,
        threshold: toleranceToDistance(rule.tolerance),
      });
    }
  }
  return parsed;
}

function isBackgroundColor(
  color: RgbColor,
  rules: readonly ParsedBackgroundRule[],
): boolean {
  for (const rule of rules) {
    if (colorDistance(color, rule.color) <= rule.threshold) {
      return true;
    }
  }
  return false;
}
