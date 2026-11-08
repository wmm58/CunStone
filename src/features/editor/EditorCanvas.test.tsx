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

  it("opens the upload picker from the empty canvas", async () => {
    const onRequestUpload = vi.fn();
    render(
      <EditorCanvas
        cutout={null}
        eraserSize={24}
        onBackgroundSample={vi.fn()}
        onCommitRaster={vi.fn()}
        onRequestUpload={onRequestUpload}
        tool="sample"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "点击画布中心上传图片" }),
    );
    expect(onRequestUpload).toHaveBeenCalledOnce();
    expect(screen.queryByText("点击背景区域指定要移除的颜色")).not.toBeInTheDocument();
  });

  it("maps input canvas clicks back to source pixel coordinates", () => {
    canvasMock = installCanvasMock();
    const onBackgroundSample = vi.fn();
    render(
      <EditorCanvas
        cutout={raster}
        eraserSize={24}
        onBackgroundSample={onBackgroundSample}
        onCommitRaster={vi.fn()}
        onRequestUpload={vi.fn()}
        tool="sample"
      />,
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
    render(
      <EditorCanvas
        cutout={raster}
        eraserSize={24}
        onBackgroundSample={vi.fn()}
        onCommitRaster={vi.fn()}
        onRequestUpload={vi.fn()}
        tool="sample"
      />,
    );

    expect(screen.getByLabelText("编辑画布")).toBeVisible();
  });

  it("commits a dragged rectangle crop", () => {
    canvasMock = installCanvasMock();
    const onCommitRaster = vi.fn();
    render(
      <EditorCanvas
        cutout={raster}
        eraserSize={24}
        onBackgroundSample={vi.fn()}
        onCommitRaster={onCommitRaster}
        onRequestUpload={vi.fn()}
        tool="crop"
      />,
    );
    const canvas = screen.getByLabelText("编辑画布");
    mockCanvasRect(canvas);

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 90, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 90, clientY: 90, pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "应用裁剪" }));

    expect(onCommitRaster).toHaveBeenCalledOnce();
  });

  it("commits a four-point perspective crop", () => {
    canvasMock = installCanvasMock();
    const onCommitRaster = vi.fn();
    render(
      <EditorCanvas
        cutout={raster}
        eraserSize={24}
        onBackgroundSample={vi.fn()}
        onCommitRaster={onCommitRaster}
        onRequestUpload={vi.fn()}
        tool="perspective"
      />,
    );
    const canvas = screen.getByLabelText("编辑画布");
    mockCanvasRect(canvas);

    for (const [clientX, clientY] of [
      [10, 10],
      [90, 10],
      [90, 90],
      [10, 90],
    ]) {
      fireEvent.click(canvas, { clientX, clientY });
    }
    fireEvent.click(screen.getByRole("button", { name: "应用透视裁剪" }));

    expect(onCommitRaster).toHaveBeenCalledOnce();
  });

  it("shows the eraser size and commits an erased source", () => {
    canvasMock = installCanvasMock();
    const onCommitRaster = vi.fn();
    render(
      <EditorCanvas
        cutout={raster}
        eraserSize={12}
        onBackgroundSample={vi.fn()}
        onCommitRaster={onCommitRaster}
        onRequestUpload={vi.fn()}
        tool="eraser"
      />,
    );
    const canvas = screen.getByLabelText("编辑画布");
    mockCanvasRect(canvas);

    expect(
      screen.getByText("橡皮大小 12px · 在画布拖拽擦除"),
    ).toBeVisible();
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 50, pointerId: 1 });
    expect(screen.getByTestId("image-eraser-cursor")).toHaveAttribute("r", "6");
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 50, pointerId: 1 });

    expect(onCommitRaster).toHaveBeenCalledOnce();
  });
});

function mockCanvasRect(canvas: HTMLElement) {
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}
