import type { WorkRecord } from "../../domain/types";
import { renderWorkBlackWhite } from "../works/workPreview";
import type { RgbaImage } from "../editor/imageProcessing";
import { normalizeRotation } from "./a4Layout";

export interface PreparedWorkPng {
  bytes: Uint8Array;
  widthMm: number;
  heightMm: number;
}

export function normalizeExportRotation(rotationDeg: number): number {
  return normalizeRotation(rotationDeg);
}

export function getRotatedDimensions(
  widthMm: number,
  heightMm: number,
  rotationDeg: number,
): { widthMm: number; heightMm: number } {
  const rotation = normalizeExportRotation(rotationDeg);
  return rotation === 90 || rotation === 270
    ? { widthMm: heightMm, heightMm: widthMm }
    : { widthMm, heightMm };
}

export function createWorkPng(
  work: WorkRecord,
  sourceRaster: RgbaImage,
  rotationDeg: number,
): PreparedWorkPng {
  const binary = renderWorkBlackWhite(work, sourceRaster);
  const sourceCanvas = rasterToCanvas(binary);
  const rotation = normalizeExportRotation(rotationDeg);
  const rotatedDimensions = getRotatedDimensions(
    work.imageState.widthMm,
    work.imageState.heightMm,
    rotation,
  );

  if (rotation === 0) {
    return {
      bytes: canvasToPngBytes(sourceCanvas),
      ...rotatedDimensions,
    };
  }

  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width =
    rotation === 90 || rotation === 270 ? sourceCanvas.height : sourceCanvas.width;
  rotatedCanvas.height =
    rotation === 90 || rotation === 270 ? sourceCanvas.width : sourceCanvas.height;
  const context = rotatedCanvas.getContext("2d");
  if (!context) {
    throw new Error("canvas-unavailable");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, rotatedCanvas.width, rotatedCanvas.height);
  context.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(
    sourceCanvas,
    -sourceCanvas.width / 2,
    -sourceCanvas.height / 2,
  );

  return {
    bytes: canvasToPngBytes(rotatedCanvas),
    ...rotatedDimensions,
  };
}

function rasterToCanvas(raster: RgbaImage): HTMLCanvasElement {
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
  return canvas;
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",", 2)[1];
  if (!base64) {
    throw new Error("png-encode-failed");
  }
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
