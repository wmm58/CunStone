import type { RgbaImage } from "./imageProcessing";

export interface RasterPoint {
  x: number;
  y: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function cropRaster(source: RgbaImage, selection: CropRect): RgbaImage {
  const x = clamp(Math.round(selection.x), 0, source.width - 1);
  const y = clamp(Math.round(selection.y), 0, source.height - 1);
  const width = clamp(
    Math.round(selection.width),
    1,
    source.width - x,
  );
  const height = clamp(
    Math.round(selection.height),
    1,
    source.height - y,
  );
  const data = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * source.width + x) * 4;
    data.set(
      source.data.subarray(sourceStart, sourceStart + width * 4),
      row * width * 4,
    );
  }
  return { width, height, data };
}

export function eraseRasterStroke(
  source: RgbaImage,
  from: RasterPoint,
  to: RasterPoint,
  size: number,
): RgbaImage {
  const next = {
    ...source,
    data: new Uint8ClampedArray(source.data),
  };
  const radius = Math.max(0.5, Math.min(80, size) / 2);
  const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const steps = Math.max(1, Math.ceil(distance));

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    eraseCircle(
      next,
      from.x + (to.x - from.x) * progress,
      from.y + (to.y - from.y) * progress,
      radius,
    );
  }
  return next;
}

export function perspectiveCropRaster(
  source: RgbaImage,
  points: [RasterPoint, RasterPoint, RasterPoint, RasterPoint],
): RgbaImage {
  const width = Math.max(
    1,
    Math.round(
      (distance(points[0], points[1]) + distance(points[3], points[2])) / 2,
    ),
  );
  const height = Math.max(
    1,
    Math.round(
      (distance(points[0], points[3]) + distance(points[1], points[2])) / 2,
    ),
  );
  const transform = solveHomography(
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    points,
  );
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const projected = applyHomography(transform, x + 0.5, y + 0.5);
      const sourceX = clamp(Math.round(projected.x), 0, source.width - 1);
      const sourceY = clamp(Math.round(projected.y), 0, source.height - 1);
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      data.set(
        source.data.subarray(sourceOffset, sourceOffset + 4),
        (y * width + x) * 4,
      );
    }
  }

  return { width, height, data };
}

export function rasterToPngDataUrl(raster: RgbaImage): string {
  const canvas = document.createElement("canvas");
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas-unavailable");
  }
  const imageData = context.createImageData(raster.width, raster.height);
  imageData.data.set(raster.data);
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

interface Homography {
  h11: number;
  h12: number;
  h13: number;
  h21: number;
  h22: number;
  h23: number;
  h31: number;
  h32: number;
}

function solveHomography(
  destination: [RasterPoint, RasterPoint, RasterPoint, RasterPoint],
  source: [RasterPoint, RasterPoint, RasterPoint, RasterPoint],
): Homography {
  const matrix = destination.flatMap((point, index) => {
    const target = source[index];
    return [
      [point.x, point.y, 1, 0, 0, 0, -point.x * target.x, -point.y * target.x, target.x],
      [0, 0, 0, point.x, point.y, 1, -point.x * target.y, -point.y * target.y, target.y],
    ];
  });
  const solution = solveLinearSystem(matrix);
  return {
    h11: solution[0],
    h12: solution[1],
    h13: solution[2],
    h21: solution[3],
    h22: solution[4],
    h23: solution[5],
    h31: solution[6],
    h32: solution[7],
  };
}

function applyHomography(
  transform: Homography,
  x: number,
  y: number,
): RasterPoint {
  const denominator =
    transform.h31 * x + transform.h32 * y + 1;
  return {
    x: (transform.h11 * x + transform.h12 * y + transform.h13) / denominator,
    y: (transform.h21 * x + transform.h22 * y + transform.h23) / denominator,
  };
}

function solveLinearSystem(rows: number[][]): number[] {
  const size = rows.length;
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) {
        pivot = row;
      }
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column] || 1e-12;
    for (let value = column; value <= size; value += 1) {
      rows[column][value] /= divisor;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }
      const factor = rows[row][column];
      for (let value = column; value <= size; value += 1) {
        rows[row][value] -= factor * rows[column][value];
      }
    }
  }
  return rows.map((row) => row[size]);
}

function eraseCircle(
  image: RgbaImage,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(image.width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(image.height - 1, Math.ceil(centerY + radius));
  const radiusSquared = radius ** 2;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radiusSquared) {
        image.data[(y * image.width + x) * 4 + 3] = 0;
      }
    }
  }
}

function distance(left: RasterPoint, right: RasterPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
