import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createDefaultWorkBinaryState } from "../../domain/types";
import BinaryEditorPanel from "./BinaryEditorPanel";

function props(overrides: Partial<React.ComponentProps<typeof BinaryEditorPanel>> = {}) {
  return {
    binaryState: createDefaultWorkBinaryState(),
    disabled: false,
    tool: "brush" as const,
    canUndo: true,
    canRedo: true,
    zoom: 100,
    onChange: vi.fn(),
    onToolChange: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomFit: vi.fn(),
    ...overrides,
  };
}

describe("BinaryEditorPanel", () => {
  it("renders black-white and seal controls with current selection", () => {
    render(<BinaryEditorPanel {...props()} />);

    expect(screen.getByRole("heading", { name: "手绘" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "阴 / 阳刻与边框" })).toBeVisible();
    expect(screen.getByRole("button", { name: "画笔" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "阳刻" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "正常方向" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "无边框" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("changes tools, line width, carving, orientation and border", async () => {
    const user = userEvent.setup();
    const callbacks = props();
    const { rerender } = render(<BinaryEditorPanel {...callbacks} />);

    await user.click(screen.getByRole("button", { name: "橡皮" }));
    expect(callbacks.onToolChange).toHaveBeenCalledWith("eraser");
    await user.click(screen.getByRole("button", { name: "阴刻" }));
    expect(callbacks.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ carvingMode: "yin" }),
    );
    await user.click(screen.getByRole("button", { name: "左右镜像" }));
    expect(callbacks.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ orientation: "mirror" }),
    );
    await user.click(screen.getByRole("button", { name: "双线" }));
    expect(callbacks.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ borderStyle: "double" }),
    );

    const borderThickness = screen.getByLabelText("边框粗细");
    expect(borderThickness).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "单线" }));
    expect(callbacks.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ borderStyle: "single" }),
    );

    const width = screen.getByLabelText("画笔大小");
    fireEvent.change(width, { target: { value: "18" } });
    expect(callbacks.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ brushSize: 18 }),
    );
  });

  it("shows separate brush and eraser size sliders", async () => {
    const user = userEvent.setup();
    const callbacks = props();
    const { rerender } = render(<BinaryEditorPanel {...callbacks} />);

    expect(screen.getByLabelText("画笔大小")).toHaveValue("6");
    expect(screen.queryByLabelText("橡皮大小")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "橡皮" }));
    expect(callbacks.onToolChange).toHaveBeenCalledWith("eraser");
    rerender(<BinaryEditorPanel {...callbacks} tool="eraser" />);
    expect(screen.queryByLabelText("画笔大小")).not.toBeInTheDocument();
    const eraser = screen.getByLabelText("橡皮大小");
    expect(eraser).toHaveValue("6");
    fireEvent.change(eraser, { target: { value: "18" } });
    expect(callbacks.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ eraserSize: 18 }),
    );
  });

  it("offers three new border choices, thickness and millimetre margin", async () => {
    const user = userEvent.setup();
    const callbacks = props({
      binaryState: {
        ...createDefaultWorkBinaryState(),
        borderStyle: "single",
      },
    });
    render(<BinaryEditorPanel {...callbacks} />);

    for (const name of ["无边框", "单线", "双线"]) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }
    expect(screen.queryByRole("button", { name: "粗线" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "残破边" })).not.toBeInTheDocument();

    const thickness = screen.getByLabelText("边框粗细");
    expect(thickness).toHaveValue("2");
    fireEvent.change(thickness, { target: { value: "8" } });
    expect(callbacks.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ borderThickness: 8 }),
    );

    const margin = screen.getByLabelText("边框外边距");
    expect(margin).toHaveValue("0");
    expect(margin).toHaveAttribute("step", "0.1");
    expect(screen.getByText("外边距 0 mm")).toBeVisible();
    fireEvent.change(margin, { target: { value: "5.7" } });
    expect(callbacks.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ borderMarginMm: 5.7 }),
    );
  });

  it("shows a read-only marker for a legacy broken border", () => {
    render(
      <BinaryEditorPanel
        {...props({
          binaryState: {
            ...createDefaultWorkBinaryState(),
            borderStyle: "broken",
          },
        })}
      />,
    );

    expect(screen.getByText("历史残破边（只读兼容）")).toBeVisible();
    expect(screen.getByLabelText("边框粗细")).toBeDisabled();
    expect(screen.getByLabelText("边框外边距")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "残破边" })).not.toBeInTheDocument();
  });

  it("wires undo, redo and zoom actions", async () => {
    const user = userEvent.setup();
    const callbacks = props();
    render(<BinaryEditorPanel {...callbacks} />);

    await user.click(screen.getByRole("button", { name: "撤销" }));
    await user.click(screen.getByRole("button", { name: "重做" }));
    await user.click(screen.getByRole("button", { name: "放大" }));
    await user.click(screen.getByRole("button", { name: "缩小" }));
    await user.click(screen.getByRole("button", { name: "适应视图" }));

    expect(callbacks.onUndo).toHaveBeenCalledOnce();
    expect(callbacks.onRedo).toHaveBeenCalledOnce();
    expect(callbacks.onZoomIn).toHaveBeenCalledOnce();
    expect(callbacks.onZoomOut).toHaveBeenCalledOnce();
    expect(callbacks.onZoomFit).toHaveBeenCalledOnce();
  });

  it("disables editing tools when no base draft exists", () => {
    render(<BinaryEditorPanel {...props({ disabled: true, canUndo: false, canRedo: false })} />);

    expect(screen.getByRole("button", { name: "画笔" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
    expect(screen.getByLabelText("画笔大小")).toBeDisabled();
    expect(screen.getByRole("button", { name: "单线" })).toBeDisabled();
    expect(screen.getByLabelText("边框粗细")).toBeDisabled();
    expect(screen.getByText("请先生成黑白稿，再使用编辑工具")).toBeVisible();
  });
});
