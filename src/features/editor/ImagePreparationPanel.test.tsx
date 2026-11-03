import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultWorkImageState, type WorkImageState } from "../../domain/types";
import { installCanvasMock } from "../../test/canvasMock";
import ImagePreparationPanel from "./ImagePreparationPanel";
import * as imageInput from "./imageInput";

vi.mock("./imageInput", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./imageInput")>();
  return {
    ...actual,
    prepareSourceFile: vi.fn(),
    prepareSourceDataUrl: vi.fn(),
  };
});

function Harness({ initial = createDefaultWorkImageState() }: { initial?: WorkImageState }) {
  const [state, setState] = useState(initial);
  return (
    <>
      <output data-testid="image-state">{JSON.stringify(state)}</output>
      <ImagePreparationPanel imageState={state} onChange={setState} />
    </>
  );
}

function readState(): WorkImageState {
  return JSON.parse(screen.getByTestId("image-state").textContent ?? "{}") as WorkImageState;
}

const prepared = {
  width: 2,
  height: 2,
  dataUrl: "data:image/png;base64,c2FtcGxl",
  raster: {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]),
  },
};

describe("ImagePreparationPanel", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    canvasMock = installCanvasMock();
    vi.mocked(imageInput.prepareSourceFile).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(prepared);
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("renders the P2 01-04 sections and empty canvas", () => {
    render(<Harness />);

    expect(screen.getByRole("heading", { name: "01 外形与实际尺寸" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "02 输入完整画面" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "03 纯色背景去除" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "04 效果与适配" })).toBeVisible();
    expect(screen.getByText("请上传图片或完成手绘")).toBeVisible();
    expect(screen.getByText("未选择")).toBeVisible();
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

  it("rejects a dimension outside 10-100 mm", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const width = screen.getByLabelText("宽 (mm)");

    await user.clear(width);
    await user.type(width, "5");
    await user.tab();

    expect(screen.getByRole("alert")).toHaveTextContent("尺寸需在 10–100 mm 之间");
    expect(readState().widthMm).toBe(25);
  });

  it("changes the effect and tolerance", async () => {
    const user = userEvent.setup();
    const initial = {
      ...createDefaultWorkImageState(),
      sourceKind: "upload" as const,
      sourceDataUrl: prepared.dataUrl,
      backgroundColor: "#ffffff",
    };
    render(<Harness initial={initial} />);

    await user.click(screen.getByRole("button", { name: "轮廓线稿" }));
    expect(readState().effectMode).toBe("outline");

    const slider = await screen.findByLabelText("背景容差");
    await waitFor(() => expect(slider).toBeEnabled());
    fireEvent.change(slider, { target: { value: "55" } });
    await waitFor(() => expect(readState().tolerance).toBe(55));
  });

  it("shows a readable error for unsupported files", async () => {
    const user = userEvent.setup();
    vi.mocked(imageInput.prepareSourceFile).mockRejectedValue(
      new Error("unsupported-type"),
    );
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([1])], "sample.gif", { type: "image/gif" })],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "仅支持 PNG、JPEG 或 WebP",
    );
  });

  it("stores a valid uploaded source and resets background selection", async () => {
    const user = userEvent.setup();
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(prepared);
    render(
      <Harness
        initial={{
          ...createDefaultWorkImageState(),
          backgroundColor: "#ffffff",
        }}
      />,
    );

    await user.upload(
      screen.getByLabelText("上传图片"),
      new File([new Uint8Array([1])], "sample.png", { type: "image/png" }),
    );

    await waitFor(() =>
      expect(readState()).toMatchObject({
        sourceKind: "upload",
        sourceDataUrl: prepared.dataUrl,
        backgroundColor: null,
      }),
    );
    expect(screen.getByText("当前文件：sample.png")).toBeVisible();
  });

  it("shows a decode error without taking down the editor", async () => {
    vi.mocked(imageInput.prepareSourceDataUrl).mockRejectedValue(
      new Error("decode-failed"),
    );
    render(
      <Harness
        initial={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
        }}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "图片无法读取，请重新上传或手绘",
    );
    expect(screen.getByRole("heading", { name: "01 外形与实际尺寸" })).toBeVisible();
    expect(screen.getByText("请上传图片或完成手绘")).toBeVisible();
  });

  it("shows a processing state while a saved source is decoded", async () => {
    let resolveSource: (value: typeof prepared) => void = () => undefined;
    vi.mocked(imageInput.prepareSourceDataUrl).mockReturnValue(
      new Promise((resolve) => {
        resolveSource = resolve;
      }),
    );
    render(
      <Harness
        initial={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
        }}
      />,
    );

    expect(await screen.findByText("正在处理本地图片…")).toBeVisible();

    resolveSource(prepared);

    expect(await screen.findByLabelText("编辑画布")).toBeVisible();
  });

  it("samples a clicked background color from the source image", async () => {
    const initial = {
      ...createDefaultWorkImageState(),
      sourceKind: "upload" as const,
      sourceDataUrl: prepared.dataUrl,
    };
    render(<Harness initial={initial} />);
    const canvas = await screen.findByLabelText("编辑画布");
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

    fireEvent.click(canvas, { clientX: 10, clientY: 10 });

    await waitFor(() => expect(readState().backgroundColor).toBe("#ffffff"));
  });

  it("resets the old background selection when a drawing is committed", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          ...createDefaultWorkImageState(),
          backgroundColor: "#ffffff",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "手绘画布" }));
    const drawingCanvas = screen.getByLabelText("手绘画布");
    vi.spyOn(drawingCanvas, "getBoundingClientRect").mockReturnValue({
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
    fireEvent.pointerDown(drawingCanvas, {
      clientX: 20,
      clientY: 20,
      pointerId: 1,
    });
    fireEvent.pointerUp(drawingCanvas, {
      clientX: 20,
      clientY: 20,
      pointerId: 1,
    });
    await user.click(screen.getByRole("button", { name: "使用手绘稿" }));

    await waitFor(() =>
      expect(readState()).toMatchObject({
        sourceKind: "drawing",
        sourceDataUrl: prepared.dataUrl,
        backgroundColor: null,
      }),
    );
  });
});
