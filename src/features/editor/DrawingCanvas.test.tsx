import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installCanvasMock } from "../../test/canvasMock";
import DrawingCanvas from "./DrawingCanvas";

describe("DrawingCanvas", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("draws with a fixed-width black stroke and clears the canvas", async () => {
    canvasMock = installCanvasMock();
    const user = userEvent.setup();
    render(<DrawingCanvas onCancel={vi.fn()} onCommit={vi.fn()} />);
    const canvas = screen.getByLabelText("手绘画布");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 80, clientY: 80, pointerId: 1 });

    expect(canvasMock.context.stroke).toHaveBeenCalled();
    expect(canvasMock.context.strokeStyle).toBe("#000000");
    expect(canvasMock.context.lineWidth).toBe(3);

    await user.click(screen.getByRole("button", { name: "清空重画" }));
    expect(canvasMock.context.clearRect).toHaveBeenCalled();
    expect(canvasMock.context.fillRect).toHaveBeenCalled();
  });

  it("commits the current drawing as a PNG data URL", async () => {
    canvasMock = installCanvasMock({
      dataUrl: "data:image/png;base64,ZHJhd2luZw==",
    });
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<DrawingCanvas onCancel={vi.fn()} onCommit={onCommit} />);
    const canvas = screen.getByLabelText("手绘画布");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    await user.click(screen.getByRole("button", { name: "使用手绘稿" }));

    expect(onCommit).toHaveBeenCalledWith("data:image/png;base64,ZHJhd2luZw==");
  });

  it("can be cancelled without committing", async () => {
    canvasMock = installCanvasMock();
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    render(<DrawingCanvas onCancel={onCancel} onCommit={onCommit} />);

    await user.click(screen.getByRole("button", { name: "取消手绘" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
