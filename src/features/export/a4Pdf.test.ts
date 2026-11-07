import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { A4_HEIGHT_PT, A4_WIDTH_PT, buildA4Pdf, mmToPt } from "./a4Pdf";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0GQAAAAASUVORK5CYII=",
    "base64",
  ),
);

describe("a4Pdf", () => {
  it("converts millimeters to PDF points", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 6);
    expect(A4_WIDTH_PT).toBeCloseTo(mmToPt(210), 6);
    expect(A4_HEIGHT_PT).toBeCloseTo(mmToPt(297), 6);
  });

  it("creates a reloadable multi-page A4 PDF", async () => {
    const bytes = await buildA4Pdf(
      [
        {
          id: "a",
          pageIndex: 0,
          xMm: 12,
          yMm: 12,
          widthMm: 25,
          heightMm: 25,
          rotationDeg: 0,
          dimensionText: "25 x 25 mm",
          imageBytes: PNG,
        },
        {
          id: "b",
          pageIndex: 1,
          xMm: 20,
          yMm: 30,
          widthMm: 30,
          heightMm: 30,
          rotationDeg: 90,
          dimensionText: "30 x 30 mm",
          imageBytes: PNG,
        },
      ],
      2,
    );

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(2);
    expect(document.getPage(0).getWidth()).toBeCloseTo(A4_WIDTH_PT, 5);
    expect(document.getPage(0).getHeight()).toBeCloseTo(A4_HEIGHT_PT, 5);
    expect(document.getTitle()).toBe("CunStone A4 印稿");
    const contents = document.getPage(0).node.Contents();
    expect(contents).toBeInstanceOf(PDFArray);
    if (!(contents instanceof PDFArray)) {
      return;
    }
    const stream = document.context.lookup(contents.get(0));
    expect(stream).toBeInstanceOf(PDFRawStream);
    if (!(stream instanceof PDFRawStream)) {
      return;
    }
    const operators = inflateSync(Buffer.from(stream.getContents())).toString("latin1");
    expect((operators.match(/\sTj\s/g) ?? []).length).toBeGreaterThan(0);
    expect((operators.match(/\sl\s/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });
});
