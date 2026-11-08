import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import * as imageInput from "./features/editor/imageInput";
import { setExportWorkIds } from "./features/export/exportSession";
import { readAppState } from "./lib/storage/appStorage";
import { installCanvasMock } from "./test/canvasMock";

const { downloadPdfMock } = vi.hoisted(() => ({
  downloadPdfMock: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
}));

vi.mock("./features/export/pdfExport", () => ({
  downloadA4Pdf: downloadPdfMock,
}));

vi.mock("./features/editor/imageInput", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./features/editor/imageInput")>();
  return {
    ...actual,
    prepareSourceFile: vi.fn(),
    prepareSourceDataUrl: vi.fn(),
  };
});

const multicolor = {
  width: 3,
  height: 1,
  dataUrl: "data:image/png;base64,bXVsdGk=",
  raster: {
    width: 3,
    height: 1,
    data: new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 255, 255,
      220, 20, 20, 255,
    ]),
  },
};

const replacement = {
  width: 2,
  height: 2,
  dataUrl: "data:image/png;base64,cmVwbGFjZQ==",
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

function mockCanvasRect(canvas: HTMLElement) {
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 90,
    height: 90,
    right: 90,
    bottom: 90,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

async function startApp() {
  window.location.hash = "#/editor/new";
  return userEvent.setup();
}

async function uploadPrepared() {
  fireEvent.change(screen.getByLabelText("上传图片"), {
    target: {
      files: [new File([new Uint8Array([1])], "sample.png", { type: "image/png" })],
    },
  });
  return screen.findByLabelText("编辑画布");
}

describe("Change 7 integration", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/editor/new";
    setExportWorkIds([]);
    downloadPdfMock.mockClear();
    downloadPdfMock.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    canvasMock = installCanvasMock();
    vi.mocked(imageInput.prepareSourceFile).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(multicolor);
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(multicolor);
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("runs a two-background sample through save, P3 preview, A4 and PDF", async () => {
    render(<App />);
    const user = await startApp();
    await screen.findByRole("heading", { name: "创作编辑" });

    const inputCanvas = await uploadPrepared();
    mockCanvasRect(inputCanvas);
    await user.click(screen.getByRole("button", { name: "添加待选颜色" }));
    fireEvent.click(inputCanvas, { clientX: 10, clientY: 10 });
    await waitFor(() => expect(screen.getByText("#FFFFFF")).toBeVisible());
    await user.click(screen.getByRole("button", { name: "添加待选颜色" }));
    fireEvent.click(inputCanvas, { clientX: 40, clientY: 10 });
    await waitFor(() => expect(screen.getByText("#0000FF")).toBeVisible());
    fireEvent.change(screen.getByLabelText("颜色 2 容差"), {
      target: { value: "30" },
    });

    await user.clear(screen.getByLabelText("作品名称"));
    await user.type(screen.getByLabelText("作品名称"), "多背景印章");
    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await user.click(binaryButton);
    await user.click(screen.getByRole("button", { name: "双线" }));
    fireEvent.change(screen.getByLabelText("边框粗细"), {
      target: { value: "8" },
    });
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));
    const work = readAppState().state.works[0];
    expect(work.status).toBe("completed");
    expect(work.imageState.backgroundRules).toEqual([
      expect.objectContaining({ color: "#ffffff", tolerance: 20 }),
      expect.objectContaining({ color: "#0000ff", tolerance: 30 }),
    ]);
    expect(work.binaryState).toMatchObject({
      borderStyle: "double",
      borderThickness: 8,
    });

    await user.click(screen.getByRole("button", { name: "作品列表" }));
    await screen.findByRole("heading", { name: "作品列表" });
    await user.click(screen.getByRole("button", { name: "已完成" }));
    const card = screen.getByText("多背景印章").closest("article");
    expect(card).not.toBeNull();
    await user.click(within(card as HTMLElement).getByRole("button", { name: "预览" }));
    const dialog = screen.getByRole("dialog", { name: "作品预览弹窗" });
    expect(await within(dialog).findByLabelText("多背景印章 黑白印稿")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "关闭" }));

    await user.click(screen.getByLabelText("选择作品 多背景印章"));
    await user.click(screen.getByRole("button", { name: "A4 导出" }));
    await screen.findByRole("heading", { name: "A4 导出" });
    await user.click(screen.getByRole("button", { name: "下载 PDF" }));
    expect(await screen.findByText("PDF 已生成并开始下载。")).toBeVisible();
    expect(downloadPdfMock).toHaveBeenCalledOnce();
  }, 30_000);

  it("does not overwrite the last valid work after clear and resumes after re-upload", async () => {
    render(<App />);
    const user = await startApp();
    await screen.findByRole("heading", { name: "创作编辑" });
    await user.clear(screen.getByLabelText("作品名称"));
    await user.type(screen.getByLabelText("作品名称"), "清除恢复作品");
    await uploadPrepared();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "草稿" }));
    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));
    const before = readAppState().state.works[0];
    await user.click(screen.getByRole("button", { name: "知道了" }));
    await waitFor(() =>
      expect(window.location.hash).toBe(`#/editor/${before.id}`),
    );

    await user.click(screen.getByRole("button", { name: "清除" }));
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expect(readAppState().state.works[0]).toEqual(before);
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByRole("alert")).toHaveTextContent("作品为空");

    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(replacement);
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(replacement);
    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([2])], "replacement.png", {
          type: "image/png",
        })],
      },
    });
    await screen.findByLabelText("编辑画布");
    await waitFor(
      () =>
        expect(readAppState().state.works[0].imageState.sourceDataUrl).toBe(
          replacement.dataUrl,
        ),
      { timeout: 3000 },
    );
  }, 30_000);

  it("auto-saves a new P2 work as completed and opens it in P4", async () => {
    render(<App />);
    const user = await startApp();
    await screen.findByRole("heading", { name: "创作编辑" });
    await user.clear(screen.getByLabelText("作品名称"));
    await user.type(screen.getByLabelText("作品名称"), "P2 直接导出");
    await uploadPrepared();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "A4 导出" }));

    expect(await screen.findByRole("heading", { name: "A4 导出" })).toBeVisible();
    expect(screen.getByText("共添加 1 件作品")).toBeVisible();
    const saved = readAppState().state.works[0];
    expect(saved).toMatchObject({
      name: "P2 直接导出",
      status: "completed",
      imageState: { sourceDataUrl: multicolor.dataUrl },
    });
    await user.click(screen.getByRole("button", { name: "下载 PDF" }));
    expect(await screen.findByText("PDF 已生成并开始下载。")).toBeVisible();
    expect(downloadPdfMock).toHaveBeenCalledOnce();
  }, 30_000);

});
