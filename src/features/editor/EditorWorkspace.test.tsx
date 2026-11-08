import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type WorkBinaryEditState,
  type WorkImageState,
} from "../../domain/types";
import { installCanvasMock } from "../../test/canvasMock";
import EditorWorkspace from "./EditorWorkspace";
import { createGenerationSignature } from "./binaryRendering";
import * as imageInput from "./imageInput";
import { encodeOverlay } from "../../lib/binary/overlayCodec";

vi.mock("./imageInput", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./imageInput")>();
  return {
    ...actual,
    prepareSourceFile: vi.fn(),
    prepareSourceDataUrl: vi.fn(),
  };
});

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

function Harness({
  clearRequestId = 0,
  initialImage = createDefaultWorkImageState(),
  initialBinary = createDefaultWorkBinaryState(),
  onContentAvailabilityChange = vi.fn(),
}: {
  clearRequestId?: number;
  initialImage?: WorkImageState;
  initialBinary?: WorkBinaryEditState;
  onContentAvailabilityChange?: (available: boolean) => void;
}) {
  const [imageState, setImageState] = useState(initialImage);
  const [binaryState, setBinaryState] = useState(initialBinary);

  return (
    <>
      <output data-testid="image-state">{JSON.stringify(imageState)}</output>
      <output data-testid="binary-state">{JSON.stringify(binaryState)}</output>
      <EditorWorkspace
        binaryState={binaryState}
        clearRequestId={clearRequestId}
        imageState={imageState}
        onBinaryStateChange={setBinaryState}
        onContentAvailabilityChange={onContentAvailabilityChange}
        onImageStateChange={(next) => setImageState(next)}
      />
    </>
  );
}

function readImageState(): WorkImageState {
  return JSON.parse(screen.getByTestId("image-state").textContent ?? "{}");
}

function readBinaryState(): WorkBinaryEditState {
  return JSON.parse(screen.getByTestId("binary-state").textContent ?? "{}");
}

function mockCanvasRect(canvas: HTMLCanvasElement) {
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

describe("EditorWorkspace", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    canvasMock = installCanvasMock();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(prepared);
    vi.mocked(imageInput.prepareSourceFile).mockReset();
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(prepared);
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("defaults to input editing and allows switching to binary editing before an image exists", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("button", { name: "图片编辑" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("heading", { name: "上传图片" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "纯色背景去除" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "外形与尺寸" })).not.toBeInTheDocument();
    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    expect(binaryButton).toBeEnabled();
    await user.click(binaryButton);
    expect(binaryButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "外形与尺寸" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "效果与适配" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "手绘" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "阴 / 阳刻与边框" })).toBeVisible();
    expect(
      screen.getAllByText("请先生成黑白稿，再使用编辑工具"),
    ).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "图片编辑" }));
    expect(screen.getByRole("heading", { name: "上传图片" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "手绘画布" })).not.toBeInTheDocument();
    expect(
      screen.getAllByText("点击背景区域指定要移除的颜色"),
    ).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([1])], "sample.png", { type: "image/png" })],
      },
    });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await user.click(binaryButton);

    expect(screen.getByRole("heading", { name: "外形与尺寸" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "效果与适配" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "手绘" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "阴 / 阳刻与边框" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "上传图片" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "纯色背景去除" })).not.toBeInTheDocument();
  });

  it("keeps image, binary and background-rule state when switching modes", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialImage={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
          backgroundRules: [
            { id: "white", color: "#ffffff", tolerance: 45 },
          ],
          effectMode: "outline",
        }}
        initialBinary={{
          ...createDefaultWorkBinaryState(),
          carvingMode: "yin",
          orientation: "mirror",
          borderStyle: "double",
          borderThickness: 7,
        }}
      />,
    );

    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await user.click(binaryButton);
    expect(screen.getByRole("button", { name: "轮廓线稿" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "阴刻" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("边框粗细")).toHaveValue("7");

    await user.click(screen.getByRole("button", { name: "图片编辑" }));
    expect(screen.getByLabelText("颜色 1 容差")).toHaveValue("45");
    expect(readImageState().effectMode).toBe("outline");
    expect(readBinaryState()).toMatchObject({
      carvingMode: "yin",
      orientation: "mirror",
      borderThickness: 7,
    });
  });

  it("samples multiple background colors into separate active rules", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialImage={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
        }}
      />,
    );

    await screen.findByLabelText("编辑画布");
    const canvas = screen.getByLabelText("编辑画布");
    mockCanvasRect(canvas as HTMLCanvasElement);
    await user.click(screen.getByRole("button", { name: "添加待选颜色" }));
    fireEvent.click(canvas, { clientX: 10, clientY: 10 });
    await waitFor(() =>
      expect(readImageState().backgroundRules[0]?.color).toBe("#ffffff"),
    );

    await user.click(screen.getByRole("button", { name: "添加待选颜色" }));
    fireEvent.click(canvas, { clientX: 60, clientY: 10 });
    await waitFor(() =>
      expect(readImageState().backgroundRules[1]?.color).toBe("#000000"),
    );
    expect(readImageState().backgroundRules).toHaveLength(2);
  });

  it("reports printable content and ignores border-only or empty states", async () => {
    const onContentAvailabilityChange = vi.fn();
    render(
      <Harness
        onContentAvailabilityChange={onContentAvailabilityChange}
        initialImage={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
        }}
      />,
    );

    await waitFor(() =>
      expect(onContentAvailabilityChange).toHaveBeenLastCalledWith(true),
    );
  });

  it("confirms before an effective background-rule change clears manual edits", async () => {
    const user = userEvent.setup();
    const imageState = {
      ...createDefaultWorkImageState(),
      sourceKind: "upload" as const,
      sourceDataUrl: prepared.dataUrl,
      backgroundRules: [
        { id: "white", color: "#ffffff", tolerance: 20 },
      ],
    };
    const overlay = new Uint8Array(512 * 512);
    overlay[512 * 256 + 256] = 1;
    const binaryState = {
      ...createDefaultWorkBinaryState(),
      overlayData: encodeOverlay(overlay, 512, 512),
      overlayWidth: 512,
      overlayHeight: 512,
      generationSignature: createGenerationSignature(imageState),
    };
    render(
      <Harness initialBinary={binaryState} initialImage={imageState} />,
    );

    await screen.findByLabelText("编辑画布");
    fireEvent.change(screen.getByLabelText("颜色 1 容差"), {
      target: { value: "60" },
    });
    expect(screen.getByRole("dialog", { name: "重置手动修整确认" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(readImageState().backgroundRules[0].tolerance).toBe(20);
    expect(readBinaryState().overlayData).not.toBeNull();

    fireEvent.change(screen.getByLabelText("颜色 1 容差"), {
      target: { value: "60" },
    });
    await user.click(screen.getByRole("button", { name: "确认重置" }));
    expect(readImageState().backgroundRules[0].tolerance).toBe(60);
    expect(readBinaryState().overlayData).toBeNull();
  });

  it("confirms before outline-thickness changes clear manual edits", async () => {
    const user = userEvent.setup();
    const imageState = {
      ...createDefaultWorkImageState(),
      sourceKind: "upload" as const,
      sourceDataUrl: prepared.dataUrl,
      effectMode: "outline" as const,
      outlineThickness: 1,
    };
    const overlay = new Uint8Array(512 * 512);
    overlay[512 * 256 + 256] = 1;
    const binaryState = {
      ...createDefaultWorkBinaryState(),
      overlayData: encodeOverlay(overlay, 512, 512),
      overlayWidth: 512,
      overlayHeight: 512,
      generationSignature: createGenerationSignature(imageState),
    };
    render(<Harness initialBinary={binaryState} initialImage={imageState} />);

    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await user.click(binaryButton);
    fireEvent.change(screen.getByLabelText("轮廓粗细"), {
      target: { value: "4" },
    });
    expect(screen.getByRole("dialog", { name: "重置手动修整确认" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(readImageState().outlineThickness).toBe(1);
    expect(readBinaryState().overlayData).not.toBeNull();

    fireEvent.change(screen.getByLabelText("轮廓粗细"), {
      target: { value: "4" },
    });
    await user.click(screen.getByRole("button", { name: "确认重置" }));
    expect(readImageState().outlineThickness).toBe(4);
    expect(readBinaryState().overlayData).toBeNull();
  });

  it("clears local history and returns to input mode on a clear request", async () => {
    const user = userEvent.setup();
    const imageState = {
      ...createDefaultWorkImageState(),
      sourceKind: "upload" as const,
      sourceDataUrl: prepared.dataUrl,
    };
    const { rerender } = render(<Harness initialImage={imageState} />);

    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await user.click(binaryButton);
    const canvas = await screen.findByLabelText("黑白稿编辑画布");
    mockCanvasRect(canvas as HTMLCanvasElement);
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 40, clientY: 40, pointerId: 1 });
    await waitFor(() => expect(screen.getByRole("button", { name: "撤销" })).toBeEnabled());

    rerender(<Harness clearRequestId={1} initialImage={imageState} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "图片编辑" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(screen.queryByRole("button", { name: "手绘画布" })).not.toBeInTheDocument();
  });

  it("uses a viewport-constrained workspace with an independently scrolling tool column", () => {
    render(<Harness />);

    const workspace = screen.getByTestId("editor-workspace");
    expect(workspace.className).toContain("h-full");
    const tools = screen.getByLabelText("编辑工具");
    expect(tools.className).toContain("overflow-y-auto");
    expect(tools).toContainElement(
      screen.getByRole("button", { name: "图片编辑" }),
    );
    expect(screen.queryByText("涂抹修整后自动保存")).not.toBeInTheDocument();
  });

  it("shows the default square canvas at a 1:1 aspect ratio", async () => {
    render(
      <Harness
        initialImage={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
        }}
      />,
    );

    const inputCanvas = await screen.findByLabelText("编辑画布");
    const inputFrame = screen.getByTestId("editor-canvas-frame");
    expect(inputFrame.style.aspectRatio).toBe("1 / 1");
    expect(inputFrame.style.width).toBe("600px");
    expect(inputFrame.style.height).toBe("600px");

    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await userEvent.setup().click(binaryButton);
    const binaryCanvas = await screen.findByLabelText("黑白稿编辑画布");
    expect(screen.getByTestId("binary-canvas-frame").style.aspectRatio).toBe(
      "1 / 1",
    );
    expect(binaryCanvas).toHaveClass("h-full", "w-full");
  });

  it("applies a rectangle crop and preserves old background rules", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialImage={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
          backgroundRules: [
            { id: "white", color: "#ffffff", tolerance: 20 },
          ],
        }}
      />,
    );
    const canvas = await screen.findByLabelText("编辑画布");
    mockCanvasRect(canvas as HTMLCanvasElement);
    await user.click(screen.getByRole("button", { name: "裁剪" }));
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 80, clientY: 80, pointerId: 1 });
    await user.click(screen.getByRole("button", { name: "应用裁剪" }));

    await waitFor(() =>
      expect(readImageState().sourceDataUrl).toContain("data:image/webp"),
    );
    expect(readImageState().backgroundRules).toEqual([
      { id: "white", color: "#ffffff", tolerance: 20 },
    ]);
    expect(readBinaryState().overlayData).toBeNull();
    await user.click(screen.getByRole("button", { name: "黑白稿编辑" }));
    expect(await screen.findByLabelText("黑白稿编辑画布")).toBeVisible();
  });

  it("keeps the image eraser active across continuous strokes and preserves rules", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialImage={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
          backgroundRules: [
            { id: "white", color: "#ffffff", tolerance: 20 },
          ],
        }}
      />,
    );
    const canvas = await screen.findByLabelText("编辑画布");
    mockCanvasRect(canvas as HTMLCanvasElement);
    await user.click(screen.getByRole("button", { name: "使用橡皮" }));
    fireEvent.change(screen.getByLabelText("图片橡皮大小"), {
      target: { value: "42" },
    });
    expect(readImageState().imageEraserSize).toBe(42);
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 50, pointerId: 1 });

    await waitFor(() =>
      expect(readImageState().sourceDataUrl).toContain("data:image/webp"),
    );
    expect(screen.getByRole("button", { name: "使用橡皮" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(readImageState().backgroundRules).toEqual([
      { id: "white", color: "#ffffff", tolerance: 20 },
    ]);

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 70, pointerId: 2 });
    fireEvent.pointerMove(canvas, { clientX: 70, clientY: 20, pointerId: 2 });
    fireEvent.pointerUp(canvas, { clientX: 70, clientY: 20, pointerId: 2 });
    await user.click(screen.getByRole("button", { name: "黑白稿编辑" }));
    expect(screen.getByLabelText("黑白稿编辑画布")).toBeVisible();
  });

  it("opens the upload picker from the empty canvas", async () => {
    const click = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "点击画布中心上传图片" }));
    expect(click).toHaveBeenCalledOnce();
  });
});
