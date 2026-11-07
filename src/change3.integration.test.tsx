import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { FIXED_TEST_CODE } from "./features/auth/authService";
import { decodeOverlay } from "./lib/binary/overlayCodec";
import { renderFinalBinary } from "./features/editor/binaryRendering";
import * as imageInput from "./features/editor/imageInput";
import { renderBinaryDraft } from "./features/editor/imageProcessing";
import type {
  WorkBinaryEditState,
  WorkImageState,
} from "./domain/types";
import { APP_STORAGE_KEY, readAppState } from "./lib/storage/appStorage";
import { installCanvasMock } from "./test/canvasMock";

vi.mock("./features/editor/imageInput", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./features/editor/imageInput")>();
  return {
    ...actual,
    prepareSourceFile: vi.fn(),
    prepareSourceDataUrl: vi.fn(),
  };
});

const prepared = {
  width: 8,
  height: 8,
  dataUrl: "data:image/png;base64,Y2hhbmdlMw==",
  raster: {
    width: 8,
    height: 8,
    data: new Uint8ClampedArray(
      Array.from({ length: 64 }, (_, index) => {
        const row = Math.floor(index / 8);
        const column = index % 8;
        const inSubject = row >= 2 && row <= 5 && column >= 2 && column <= 5;
        return inSubject ? [0, 0, 0, 255] : [255, 255, 255, 255];
      }).flat(),
    ),
  },
};

function mockCanvasRect(canvas: HTMLCanvasElement) {
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 512,
    height: 512,
    right: 512,
    bottom: 512,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

async function loginWithUi() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.type(screen.getByLabelText("验证码"), FIXED_TEST_CODE);
  await user.click(screen.getByRole("button", { name: "登录 / 注册" }));
  return user;
}

function finalPixels(
  imageState: WorkImageState,
  binaryState: WorkBinaryEditState,
): Uint8ClampedArray {
  const base = renderBinaryDraft(prepared.raster, imageState);
  const overlay = binaryState.overlayData
    ? decodeOverlay(
        binaryState.overlayData,
        binaryState.overlayWidth ?? base.width,
        binaryState.overlayHeight ?? base.height,
      )
    : new Uint8Array(base.width * base.height);
  if (!overlay) {
    throw new Error("overlay should decode");
  }
  return renderFinalBinary(base, overlay, binaryState, imageState.shape).data;
}

describe("Change 3 integration", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/login";
    canvasMock = installCanvasMock();
    vi.mocked(imageInput.prepareSourceFile).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(prepared);
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(prepared);
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("edits, saves and restores the final black-white state", async () => {
    const firstRender = render(<App />);
    const user = await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });

    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([1])], "sample.png", { type: "image/png" })],
      },
    });
    const inputCanvas = await screen.findByLabelText("编辑画布");
    mockCanvasRect(inputCanvas as HTMLCanvasElement);
    fireEvent.click(inputCanvas, { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole("button", { name: "草稿" }));
    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));
    const workId = readAppState().state.works[0].id;

    const editButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(editButton).toBeEnabled());
    await user.click(editButton);
    const binaryCanvas = await screen.findByLabelText("黑白稿编辑画布");
    mockCanvasRect(binaryCanvas as HTMLCanvasElement);

    fireEvent.change(screen.getByLabelText("画笔线宽"), {
      target: { value: "12" },
    });
    fireEvent.pointerDown(binaryCanvas, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerMove(binaryCanvas, {
      clientX: 200,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerUp(binaryCanvas, {
      clientX: 200,
      clientY: 100,
      pointerId: 1,
    });

    await user.click(screen.getByRole("button", { name: "橡皮" }));
    fireEvent.pointerDown(binaryCanvas, {
      clientX: 130,
      clientY: 110,
      pointerId: 2,
    });
    fireEvent.pointerUp(binaryCanvas, {
      clientX: 130,
      clientY: 110,
      pointerId: 2,
    });
    await user.click(screen.getByRole("button", { name: "撤销" }));
    await user.click(screen.getByRole("button", { name: "重做" }));
    await user.click(screen.getByRole("button", { name: "阴刻" }));
    await user.click(screen.getByRole("button", { name: "左右镜像" }));
    await user.click(screen.getByRole("button", { name: "双线" }));
    await user.click(screen.getByRole("button", { name: "保存（已完成）" }));

    await waitFor(() => {
      const saved = readAppState().state.works[0];
      expect(saved.binaryState).toMatchObject({
        brushSize: 12,
        carvingMode: "yin",
        orientation: "mirror",
        borderStyle: "double",
      });
      expect(saved.binaryState.overlayData).not.toBeNull();
    });
    const saved = readAppState().state.works[0];
    const raw = window.localStorage.getItem(APP_STORAGE_KEY) ?? "";
    expect(Object.keys(saved.binaryState).sort()).toEqual(
      [
        "borderStyle",
        "brushSize",
        "carvingMode",
        "editVersion",
        "generationSignature",
        "orientation",
        "overlayData",
        "overlayHeight",
        "overlayWidth",
      ].sort(),
    );
    expect(raw).not.toMatch(/undoHistory|redoHistory|finalBinary|blackWhitePng/);
    expect(saved.binaryState.overlayData?.length ?? 0).toBeLessThan(90_000);
    const pixelsBefore = finalPixels(saved.imageState, saved.binaryState);

    firstRender.unmount();
    window.location.hash = `#/editor/${workId}`;
    render(<App />);

    expect(await screen.findByRole("button", { name: "阴刻" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "左右镜像" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "双线" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("画笔线宽")).toHaveValue("12");

    const reopenedEditButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(reopenedEditButton).toBeEnabled());
    await user.click(reopenedEditButton);
    expect(await screen.findByLabelText("黑白稿编辑画布")).toBeVisible();
    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重做" })).toBeDisabled();

    const reopened = readAppState().state.works[0];
    expect(finalPixels(reopened.imageState, reopened.binaryState)).toEqual(
      pixelsBefore,
    );
  }, 15_000);

  it("protects and resets a hand-drawn manual edit after confirmation", async () => {
    render(<App />);
    const user = await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });

    await user.click(screen.getByRole("button", { name: "手绘画布" }));
    const drawingCanvas = screen.getByLabelText("手绘画布");
    mockCanvasRect(drawingCanvas as HTMLCanvasElement);
    fireEvent.pointerDown(drawingCanvas, {
      clientX: 40,
      clientY: 40,
      pointerId: 1,
    });
    fireEvent.pointerUp(drawingCanvas, {
      clientX: 40,
      clientY: 40,
      pointerId: 1,
    });
    await user.click(screen.getByRole("button", { name: "使用手绘稿" }));
    await screen.findByLabelText("编辑画布");
    await user.click(screen.getByRole("button", { name: "草稿" }));
    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));

    const editButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(editButton).toBeEnabled());
    await user.click(editButton);
    const binaryCanvas = await screen.findByLabelText("黑白稿编辑画布");
    mockCanvasRect(binaryCanvas as HTMLCanvasElement);
    fireEvent.pointerDown(binaryCanvas, {
      clientX: 100,
      clientY: 100,
      pointerId: 2,
    });
    fireEvent.pointerUp(binaryCanvas, {
      clientX: 100,
      clientY: 100,
      pointerId: 2,
    });
    await waitFor(() =>
      expect(readAppState().state.works[0].binaryState.overlayData).not.toBeNull(),
    );

    await user.click(screen.getByRole("button", { name: "圆形" }));
    expect(
      screen.getByRole("dialog", { name: "重置手动修整确认" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(readAppState().state.works[0].imageState.shape).toBe("square");
    expect(readAppState().state.works[0].binaryState.overlayData).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "圆形" }));
    await user.click(screen.getByRole("button", { name: "确认重置" }));
    await waitFor(() =>
      expect(readAppState().state.works[0].imageState.shape).toBe("circle"),
    );
    expect(readAppState().state.works[0].binaryState.overlayData).toBeNull();
  }, 15_000);
});
