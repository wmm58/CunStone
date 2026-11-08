import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { FIXED_TEST_CODE } from "./features/auth/authService";
import { setExportWorkIds } from "./features/export/exportSession";
import * as imageInput from "./features/editor/imageInput";
import { APP_STORAGE_KEY, readAppState } from "./lib/storage/appStorage";
import { installCanvasMock } from "./test/canvasMock";
import { createV3MigrationFixtures } from "./test/migrationFixtures";

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

const prepared = {
  width: 4,
  height: 4,
  dataUrl: "data:image/png;base64,Y2hhbmdlNg==",
  raster: {
    width: 4,
    height: 4,
    data: new Uint8ClampedArray(
      Array.from({ length: 16 }, (_, index) => {
        const row = Math.floor(index / 4);
        const column = index % 4;
        return row >= 1 && row <= 2 && column >= 1 && column <= 2
          ? [0, 0, 0, 255]
          : [255, 255, 255, 255];
      }).flat(),
    ),
  },
};

async function loginWithUi() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.type(screen.getByLabelText("验证码"), FIXED_TEST_CODE);
  await user.click(screen.getByRole("button", { name: "登录 / 注册" }));
  return user;
}

function mockRect(canvas: HTMLElement) {
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

async function finishThroughPdf(name: string) {
  const user = userEvent.setup();
  await screen.findByRole("heading", { name: "创作编辑" });
  await user.click(screen.getByRole("button", { name: "作品列表" }));
  await screen.findByRole("heading", { name: "作品列表" });
  await user.click(screen.getByRole("button", { name: "已完成" }));
  await user.click(screen.getByLabelText(`选择作品 ${name}`));
  await user.click(screen.getByRole("button", { name: "A4 导出" }));
  await screen.findByRole("heading", { name: "A4 导出" });
  expect(screen.getByText("共添加 1 件作品")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "下载 PDF" }));
  expect(await screen.findByText("PDF 已生成并开始下载。")).toBeVisible();
  expect(downloadPdfMock).toHaveBeenCalledOnce();
}

describe("Change 6 integration", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/login";
    setExportWorkIds([]);
    downloadPdfMock.mockClear();
    downloadPdfMock.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
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

  it("runs the fixed upload sample from login to PDF download", async () => {
    render(<App />);
    const user = await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });
    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([1])], "upload.png", { type: "image/png" })],
      },
    });
    await screen.findByLabelText("编辑画布");
    await user.clear(screen.getByLabelText("作品名称"));
    await user.type(screen.getByLabelText("作品名称"), "固定上传样本");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));

    await finishThroughPdf("固定上传样本");
  }, 15_000);

  it("keeps a historical hand-drawn sample previewable and exportable to PDF", async () => {
    const fixtures = createV3MigrationFixtures();
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        ...fixtures,
        works: fixtures.works.filter((work) => work.id === "legacy-drawing"),
      }),
    );
    window.location.hash = "#/editor/legacy-drawing";

    render(<App />);
    const user = userEvent.setup();

    expect(await screen.findByDisplayValue("legacy-drawing")).toBeVisible();
    expect(screen.queryByRole("button", { name: "手绘画布" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "作品列表" }));
    await screen.findByRole("heading", { name: "作品列表" });
    await user.click(screen.getByRole("button", { name: "已完成" }));
    const card = screen.getByText("legacy-drawing").closest("article");
    expect(card).not.toBeNull();
    await user.click(within(card as HTMLElement).getByRole("button", { name: "预览" }));
    expect(
      await screen.findByLabelText("legacy-drawing 红印预览"),
    ).toBeVisible();
    await user.click(
      within(screen.getByRole("dialog", { name: "作品预览弹窗" })).getByRole(
        "button",
        { name: "关闭" },
      ),
    );
    await user.click(screen.getByLabelText("选择作品 legacy-drawing"));
    await user.click(screen.getByRole("button", { name: "A4 导出" }));
    await screen.findByRole("heading", { name: "A4 导出" });
    expect(screen.getByText("共添加 1 件作品")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "下载 PDF" }));
    expect(await screen.findByText("PDF 已生成并开始下载。")).toBeVisible();
    expect(downloadPdfMock).toHaveBeenCalledOnce();
  }, 15_000);
});
