import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installCanvasMock } from "../../test/canvasMock";
import BinaryEditorCanvas from "./BinaryEditorCanvas";
import type { RgbaImage } from "./imageProcessing";

const raster: RgbaImage = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    0, 0, 0, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
    0, 0, 0, 255,
  ]),
};

describe("BinaryEditorCanvas", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    canvasMock = installCanvasMock();
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("renders the final raster with non-destructive CSS zoom", () => {
    const props = {
      disabled: false,
      tool: "brush" as const,
      onStrokeStart: vi.fn(),
      onStrokeMove: vi.fn(),
      onStrokeEnd: vi.fn(),
    };
    const { rerender } = render(
      <BinaryEditorCanvas {...props} raster={raster} zoom={100} />,
    );
    const canvas = screen.getByLabelText("黑白稿编辑画布");
    expect(canvas).toHaveStyle({ width: "2px", height: "2px" });

    rerender(<BinaryEditorCanvas {...props} raster={raster} zoom={200} />);
    expect(screen.getByLabelText("黑白稿编辑画布")).toHaveStyle({
      width: "4px",
      height: "4px",
    });
  });

  it("maps scaled pointer coordinates and emits a continuous stroke", () => {
    const onStrokeStart = vi.fn();
    const onStrokeMove = vi.fn();
    const onStrokeEnd = vi.fn();
    render(
      <BinaryEditorCanvas
        disabled={false}
        onStrokeEnd={onStrokeEnd}
        onStrokeMove={onStrokeMove}
        onStrokeStart={onStrokeStart}
        raster={raster}
        tool="brush"
        zoom={400}
      />,
    );
    const canvas = screen.getByLabelText("黑白稿编辑画布");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 8,
      height: 8,
      right: 8,
      bottom: 8,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(canvas, { clientX: 2, clientY: 2, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 6, clientY: 2, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 6, clientY: 2, pointerId: 1 });

    expect(onStrokeStart).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(onStrokeMove).toHaveBeenCalledWith({ x: 1, y: 0 });
    expect(onStrokeEnd).toHaveBeenCalledOnce();
  });

  it("does not emit strokes while disabled", () => {
    const onStrokeStart = vi.fn();
    render(
      <BinaryEditorCanvas
        disabled
        onStrokeEnd={vi.fn()}
        onStrokeMove={vi.fn()}
        onStrokeStart={onStrokeStart}
        raster={raster}
        tool="eraser"
        zoom={100}
      />,
    );
    const canvas = screen.getByLabelText("黑白稿编辑画布");

    fireEvent.pointerDown(canvas, { clientX: 1, clientY: 1, pointerId: 1 });

    expect(onStrokeStart).not.toHaveBeenCalled();
    expect(canvas).toHaveAttribute("aria-disabled", "true");
  });
});
