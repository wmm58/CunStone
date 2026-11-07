import type { WorkRecord } from "../../domain/types";
import { prepareSourceDataUrl } from "../editor/imageInput";
import { loadWorkSource } from "../works/workPreview";
import { buildA4Pdf, type PdfPlacement } from "./a4Pdf";
import type { PlacedWork } from "./a4Layout";
import { createWorkPng, type PreparedWorkPng } from "./workPng";

export interface ExportLayoutPdfOptions {
  works: readonly WorkRecord[];
  layout: readonly PlacedWork[];
  pageCount: number;
}

export function buildPdfPlacements(
  works: readonly WorkRecord[],
  layout: readonly PlacedWork[],
  images: ReadonlyMap<string, PreparedWorkPng>,
): PdfPlacement[] {
  const worksById = new Map(works.map((work) => [work.id, work]));
  return layout.flatMap((item) => {
    const work = worksById.get(item.id);
    const image = images.get(item.id);
    if (!work || !image) {
      return [];
    }
    const centerX = item.xMm + item.widthMm / 2;
    const centerY = item.yMm + item.heightMm / 2;
    return [
      {
        id: item.id,
        pageIndex: item.pageIndex,
        xMm: centerX - image.widthMm / 2,
        yMm: centerY - image.heightMm / 2,
        widthMm: image.widthMm,
        heightMm: image.heightMm,
        rotationDeg: item.rotationDeg,
        dimensionText: workDimensionText(work),
        imageBytes: image.bytes,
      },
    ];
  });
}

export async function buildPdfFromWorks(
  options: ExportLayoutPdfOptions,
): Promise<Uint8Array> {
  if (options.works.length === 0) {
    throw new Error("empty-layout");
  }

  const images = new Map<string, PreparedWorkPng>();
  for (const item of options.layout) {
    const work = options.works.find((candidate) => candidate.id === item.id);
    if (!work?.imageState.sourceDataUrl) {
      throw new Error("missing-source");
    }
    const source = await loadWorkSource(
      work.imageState.sourceDataUrl,
      prepareSourceDataUrl,
    );
    images.set(item.id, createWorkPng(work, source, item.rotationDeg));
  }

  return buildA4Pdf(
    buildPdfPlacements(options.works, options.layout, images),
    options.pageCount,
  );
}

export async function downloadA4Pdf(
  options: ExportLayoutPdfOptions,
): Promise<Uint8Array> {
  const bytes = await buildPdfFromWorks(options);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cunstone-a4-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return bytes;
}

function workDimensionText(work: WorkRecord): string {
  return work.imageState.shape === "circle"
    ? `Dia ${work.imageState.widthMm} mm`
    : `${work.imageState.widthMm} x ${work.imageState.heightMm} mm`;
}
