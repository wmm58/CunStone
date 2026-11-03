import type { RgbaImage } from "./imageProcessing";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_WORKING_DIMENSION = 1600;
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type ImageInputError =
  | "unsupported-type"
  | "too-large"
  | "decode-failed"
  | "encode-failed";

export interface PreparedSourceImage {
  width: number;
  height: number;
  dataUrl: string;
  raster: RgbaImage;
}

export function validateImageFile(file: Pick<File, "type" | "size">): ImageInputError | null {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return "unsupported-type";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "too-large";
  }
  return null;
}

export function getScaledDimensions(
  width: number,
  height: number,
  maxDimension = MAX_WORKING_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function prepareSourceFile(file: File): Promise<PreparedSourceImage> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  try {
    if ("createImageBitmap" in globalThis) {
      const bitmap = await globalThis.createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      try {
        return rasterizeImage(bitmap, bitmap.width, bitmap.height);
      } finally {
        bitmap.close();
      }
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await loadHtmlImage(objectUrl);
      return rasterizeImage(image, image.naturalWidth, image.naturalHeight);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    if (error instanceof Error && error.message === "encode-failed") {
      throw error;
    }
    throw new Error("decode-failed");
  }
}

export async function prepareSourceDataUrl(dataUrl: string): Promise<PreparedSourceImage> {
  try {
    const image = await loadHtmlImage(dataUrl);
    return rasterizeImage(image, image.naturalWidth, image.naturalHeight);
  } catch {
    throw new Error("decode-failed");
  }
}

async function rasterizeImage(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<PreparedSourceImage> {
  const dimensions = getScaledDimensions(sourceWidth, sourceHeight);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("decode-failed");
  }

  context.clearRect(0, 0, dimensions.width, dimensions.height);
  context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
  const imageData = context.getImageData(0, 0, dimensions.width, dimensions.height);
  const dataUrl = encodeCanvas(canvas);

  return {
    width: dimensions.width,
    height: dimensions.height,
    dataUrl,
    raster: {
      width: dimensions.width,
      height: dimensions.height,
      data: imageData.data,
    },
  };
}

function encodeCanvas(canvas: HTMLCanvasElement): string {
  try {
    const webp = canvas.toDataURL("image/webp", 0.82);
    if (webp.startsWith("data:image/webp")) {
      return webp;
    }
    return canvas.toDataURL("image/png");
  } catch {
    throw new Error("encode-failed");
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode-failed"));
    image.src = src;
  });
}
