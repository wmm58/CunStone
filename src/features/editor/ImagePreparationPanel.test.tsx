import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  createDefaultWorkImageState,
  type WorkImageState,
} from "../../domain/types";
import ImagePreparationPanel from "./ImagePreparationPanel";

function Harness({
  initial = createDefaultWorkImageState(),
  sourceAvailable = false,
  onUploadFile = vi.fn(),
  onStartDrawing = vi.fn(),
}: {
  initial?: WorkImageState;
  sourceAvailable?: boolean;
  onUploadFile?: (file: File) => void;
  onStartDrawing?: () => void;
}) {
  const [state, setState] = useState(initial);
  return (
    <>
      <output data-testid="image-state">{JSON.stringify(state)}</output>
      <ImagePreparationPanel
        busy={false}
        fileName="sample.png"
        imageState={state}
        onRequestChange={setState}
        onStartDrawing={onStartDrawing}
        onUploadFile={onUploadFile}
        sourceAvailable={sourceAvailable}
      />
    </>
  );
}

function readState(): WorkImageState {
  return JSON.parse(screen.getByTestId("image-state").textContent ?? "{}");
}

describe("ImagePreparationPanel", () => {
  it("renders only the 01-04 preparation controls", () => {
    render(<Harness />);

    expect(screen.getByRole("heading", { name: "01 外形与实际尺寸" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "02 输入完整画面" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "03 纯色背景去除" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "04 效果与适配" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "05 黑白稿编辑" })).not.toBeInTheDocument();
    expect(screen.getByText("当前文件：sample.png")).toBeVisible();
    expect(screen.getByLabelText("背景容差")).toBeDisabled();
  });

  it("changes shape and applies a recommended size", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "长方形" }));
    expect(readState()).toMatchObject({ shape: "rectangle", widthMm: 20, heightMm: 30 });

    await user.click(screen.getByRole("button", { name: "15×30 mm" }));
    expect(readState()).toMatchObject({ widthMm: 15, heightMm: 30 });
  });

  it("rejects dimensions outside 10-100 mm", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const width = screen.getByLabelText("宽 (mm)");

    await user.clear(width);
    await user.type(width, "5");
    await user.tab();

    expect(screen.getByRole("alert")).toHaveTextContent("尺寸需在 10–100 mm 之间");
    expect(readState().widthMm).toBe(25);
  });

  it("changes effect and tolerance when a source exists", async () => {
    const user = userEvent.setup();
    render(<Harness sourceAvailable />);

    await user.click(screen.getByRole("button", { name: "轮廓线稿" }));
    expect(readState().effectMode).toBe("outline");
    const slider = screen.getByLabelText("背景容差");
    expect(slider).toBeEnabled();
    fireEvent.change(slider, { target: { value: "55" } });
    expect(readState().tolerance).toBe(55);
  });

  it("forwards uploads and drawing start without parsing files itself", async () => {
    const user = userEvent.setup();
    const onUploadFile = vi.fn();
    const onStartDrawing = vi.fn();
    render(
      <Harness onStartDrawing={onStartDrawing} onUploadFile={onUploadFile} />,
    );
    const file = new File([new Uint8Array([1])], "sample.png", {
      type: "image/png",
    });

    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: { files: [file] },
    });
    await user.click(screen.getByRole("button", { name: "手绘画布" }));

    expect(onUploadFile).toHaveBeenCalledWith(file);
    expect(onStartDrawing).toHaveBeenCalledOnce();
  });
});
