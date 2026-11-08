import type { WorkRecord } from "../../domain/types";
import { decodeOverlay } from "../../lib/binary/overlayCodec";
import {
  createGenerationSignature,
  renderFinalBinary,
} from "../editor/binaryRendering";
import {
  renderBinaryDraft,
  type RgbaImage,
} from "../editor/imageProcessing";

export const RED_IMPRESSION_COLOR = [198, 40, 40, 255] as const;

const sourceRasterCache = new Map<string, Promise<RgbaImage>>();

export function renderWorkBlackWhite(
  work: WorkRecord,
  sourceRaster: RgbaImage,
): RgbaImage {
  const base = renderBinaryDraft(sourceRaster, work.imageState);
  const signature = createGenerationSignature(work.imageState);
  const savedOverlay =
    work.binaryState.overlayData &&
    work.binaryState.generationSignature === signature &&
    work.binaryState.overlayWidth === base.width &&
    work.binaryState.overlayHeight === base.height
      ? decodeOverlay(
          work.binaryState.overlayData,
          work.binaryState.overlayWidth,
          work.binaryState.overlayHeight,
        )
      : null;
  const overlay = savedOverlay ?? new Uint8Array(base.width * base.height);

  return renderFinalBinary(
    base,
    overlay,
    work.binaryState,
    work.imageState.shape,
    work.imageState.widthMm,
    work.imageState.heightMm,
  );
}

export function renderRedImpression(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let offset = 0; offset < image.data.length; offset += 4) {
    data.set(
      image.data[offset] === 0
        ? RED_IMPRESSION_COLOR
        : [255, 255, 255, 255],
      offset,
    );
  }
  return { ...image, data };
}

export function loadWorkSource(
  dataUrl: string,
  prepare: (value: string) => Promise<{ raster: RgbaImage }>,
): Promise<RgbaImage> {
  const cached = sourceRasterCache.get(dataUrl);
  if (cached) {
    return cached;
  }
  const loaded = prepare(dataUrl).then((result) => result.raster);
  sourceRasterCache.set(dataUrl, loaded);
  loaded.catch(() => sourceRasterCache.delete(dataUrl));
  return loaded;
}
