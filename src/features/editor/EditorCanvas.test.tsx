import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    render(
      <EditorCanvas
        binary={null}
        cutout={null}
        mode="input"
        onBackgroundSample={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("请上传图片或完成手绘")).toBeVisible();
    expect(screen.getByRole("button", { name: "黑白稿" })).toBeDisabled();
  });

  it("switches between input and binary views", async () => {
    canvasMock = installCanvasMock();
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(
      <EditorCanvas
        binary={raster}
        cutout={raster}
        mode="input"
        onBackgroundSample={vi.fn()}
        onModeChange={onModeChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "黑白稿" }));

    expect(onModeChange).toHaveBeenCalledWith("binary");
    expect(screen.getByLabelText("编辑画布")).toBeVisible();
  });

  it("maps input canvas clicks back to source pixel coordinates", () => {
    canvasMock = installCanvasMock();
    const onBackgroundSample = vi.fn();
    render(
      <EditorCanvas
        binary={null}
        cutout={raster}
        mode="input"
        onBackgroundSample={onBackgroundSample}
        onModeChange={vi.fn()}
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
  });

  it("shows transparency in input mode and a white surface in binary mode", () => {
    canvasMock = installCanvasMock();
    const props = {
      binary: raster,
      cutout: raster,
      onBackgroundSample: vi.fn(),
      onModeChange: vi.fn(),
    };
    const { rerender } = render(<EditorCanvas {...props} mode="input" />);

    expect(screen.getByLabelText("编辑画布")).not.toHaveClass("bg-white");

    rerender(<EditorCanvas {...props} mode="binary" />);

    expect(screen.getByLabelText("编辑画布")).toHaveClass("bg-white");
  });
});
