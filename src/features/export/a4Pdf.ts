import type { PDFFont, PDFPage, RGB } from "pdf-lib";

import { A4_PAGE } from "./a4Layout";

export const MM_TO_PT = 72 / 25.4;
export const A4_WIDTH_PT = mmToPt(A4_PAGE.widthMm);
export const A4_HEIGHT_PT = mmToPt(A4_PAGE.heightMm);

export interface PdfPlacement {
  id: string;
  pageIndex: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  dimensionText: string;
  imageBytes: Uint8Array;
}

export function mmToPt(value: number): number {
  return value * MM_TO_PT;
}

export async function buildA4Pdf(
  placements: readonly PdfPlacement[],
  pageCount: number,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  document.setTitle("CunStone A4 印稿");
  document.setCreator("CunStone");

  const pages: PDFPage[] = [];
  for (let index = 0; index < Math.max(1, pageCount); index += 1) {
    pages.push(document.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]));
  }

  const black = rgb(0, 0, 0);
  for (const placement of placements) {
    const page = pages[placement.pageIndex] ?? pages[0];
    const image = await document.embedPng(placement.imageBytes);
    const width = mmToPt(placement.widthMm);
    const height = mmToPt(placement.heightMm);
    const x = mmToPt(placement.xMm);
    const y = A4_HEIGHT_PT - mmToPt(placement.yMm + placement.heightMm);

    page.drawImage(image, { x, y, width, height });
    drawCropMarks(page, x, y, width, height, black);
    drawDimensionText(
      page,
      font,
      placement.dimensionText,
      x + width / 2,
      Math.max(4, y - mmToPt(3)),
      black,
    );
  }

  return document.save();
}

function drawCropMarks(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  black: RGB,
): void {
  const mark = mmToPt(3);
  const gap = mmToPt(1);

  for (const [cornerX, cornerY, directionX, directionY] of [
    [x, y + height, -1, 1],
    [x + width, y + height, 1, 1],
    [x, y, -1, -1],
    [x + width, y, 1, -1],
  ] as const) {
    page.drawLine({
      start: { x: cornerX + directionX * gap, y: cornerY },
      end: { x: cornerX + directionX * (gap + mark), y: cornerY },
      thickness: 0.5,
      color: black,
    });
    page.drawLine({
      start: { x: cornerX, y: cornerY + directionY * gap },
      end: { x: cornerX, y: cornerY + directionY * (gap + mark) },
      thickness: 0.5,
      color: black,
    });
  }
}

function drawDimensionText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  centerX: number,
  y: number,
  black: RGB,
): void {
  const fontSize = 7;
  const width = font.widthOfTextAtSize(text, fontSize);
  page.drawText(text, {
    x: centerX - width / 2,
    y,
    size: fontSize,
    font,
    color: black,
  });
}
