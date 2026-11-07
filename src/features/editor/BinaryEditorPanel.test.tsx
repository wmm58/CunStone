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
  it("renders 05 and 06 controls with current selection", () => {
    render(<BinaryEditorPanel {...props()} />);

    expect(screen.getByRole("heading", { name: "05 黑白稿编辑" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "06 阴 / 阳刻与边框" })).toBeVisible();
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
    render(<BinaryEditorPanel {...callbacks} />);

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

    const width = screen.getByLabelText("画笔线宽");
    fireEvent.change(width, { target: { value: "18" } });
    expect(callbacks.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ brushSize: 18 }),
    );
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
    expect(screen.getByLabelText("画笔线宽")).toBeDisabled();
    expect(screen.getByRole("button", { name: "单线" })).toBeDisabled();
    expect(screen.getByText("请先生成黑白稿，再使用编辑工具")).toBeVisible();
  });
});
