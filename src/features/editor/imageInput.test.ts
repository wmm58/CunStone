import { afterEach, describe, expect, it, vi } from "vitest";

import { installCanvasMock } from "../../test/canvasMock";
import {
  MAX_UPLOAD_BYTES,
  getScaledDimensions,
  prepareSourceFile,
  validateImageFile,
} from "./imageInput";

describe("imageInput", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.unstubAllGlobals();
  });

  it("validates supported file types and the 10 MB limit", () => {
    expect(validateImageFile({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateImageFile({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validateImageFile({ type: "image/webp", size: 1024 })).toBeNull();
    expect(validateImageFile({ type: "image/gif", size: 1024 })).toBe("unsupported-type");
    expect(
      validateImageFile({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 }),
    ).toBe("too-large");
  });

  it("preserves aspect ratio while limiting the longest side", () => {
    expect(getScaledDimensions(3200, 1600, 1600)).toEqual({
      width: 1600,
      height: 800,
    });
    expect(getScaledDimensions(500, 900, 1600)).toEqual({
      width: 500,
      height: 900,
    });
  });

  it("decodes, downscales, and encodes an uploaded image locally", async () => {
    canvasMock = installCanvasMock({ width: 2, height: 1 });
    const close = vi.fn();
    const createBitmap = vi.fn(async () => ({
      width: 3200,
      height: 1600,
      close,
    }));
    vi.stubGlobal("createImageBitmap", createBitmap);
    const file = new File([new Uint8Array([1, 2, 3])], "sample.png", {
      type: "image/png",
    });

    const result = await prepareSourceFile(file);

    expect(result).toMatchObject({
      width: 1600,
      height: 800,
      dataUrl: "data:image/webp;base64,c2FtcGxl",
    });
    expect(createBitmap).toHaveBeenCalledWith(file, {
      imageOrientation: "from-image",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("rejects invalid files before invoking image decode", async () => {
    const bitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", bitmap);
    const file = new File([new Uint8Array([1])], "sample.gif", {
      type: "image/gif",
    });

    await expect(prepareSourceFile(file)).rejects.toThrow("unsupported-type");
    expect(bitmap).not.toHaveBeenCalled();
  });

  it("falls back to PNG when WebP encoding is unavailable", async () => {
    canvasMock = installCanvasMock({
      dataUrl: "data:image/png;base64,ZmFsbGJhY2s=",
    });
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 2, height: 2, close: vi.fn() })),
    );
    const file = new File([new Uint8Array([1])], "sample.jpg", {
      type: "image/jpeg",
    });

    const result = await prepareSourceFile(file);

    expect(result.dataUrl).toBe("data:image/png;base64,ZmFsbGJhY2s=");
  });

  it("reports a decode failure without throwing an implementation error", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("bitmap failed");
      }),
    );
    const file = new File([new Uint8Array([1])], "sample.png", {
      type: "image/png",
    });

    await expect(prepareSourceFile(file)).rejects.toThrow("decode-failed");
  });
});
