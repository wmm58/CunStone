import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installCanvasMock } from "../../test/canvasMock";
import EditorCanvas from "./EditorCanvas";
import type { RgbaImage } from "./imageProcessing";

const raster: RgbaImage = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    255, 255, 255, 255,
    0, 0, 0, 255,
    0, 0, 0, 255,
    255, 255, 255, 255,
  ]),
};

describe("EditorCanvas", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("shows an empty state before an image is available", () => {
    render(<EditorCanvas cutout={null} onBackgroundSample={vi.fn()} />);

    expect(screen.getByText("请上传图片或完成手绘")).toBeVisible();
  });

  it("maps input canvas clicks back to source pixel coordinates", () => {
    canvasMock = installCanvasMock();
    const onBackgroundSample = vi.fn();
    render(
      <EditorCanvas cutout={raster} onBackgroundSample={onBackgroundSample} />,
    );
    const canvas = screen.getByLabelText("编辑画布");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 10,
      top: 10,
      width: 100,
      height: 100,
      right: 110,
      bottom: 110,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    });

    fireEvent.click(canvas, { clientX: 60, clientY: 35 });

    expect(onBackgroundSample).toHaveBeenCalledWith(1, 0);
    expect(canvas).toHaveClass("bg-transparent");
  });

  it("does not crash when Canvas 2D is unavailable", () => {
    render(<EditorCanvas cutout={raster} onBackgroundSample={vi.fn()} />);

    expect(screen.getByLabelText("编辑画布")).toBeVisible();
  });
});
