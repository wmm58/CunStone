import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { createDefaultWorkImageState } from "./domain/types";
import { FIXED_TEST_CODE } from "./features/auth/authService";
import { setExportWorkIds } from "./features/export/exportSession";
import { createWork } from "./features/works/workService";

const { downloadPdfMock } = vi.hoisted(() => ({
  downloadPdfMock: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
}));

vi.mock("./features/export/pdfExport", () => ({
  downloadA4Pdf: downloadPdfMock,
}));

async function loginWithUi() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.type(screen.getByLabelText("验证码"), FIXED_TEST_CODE);
  await user.click(screen.getByRole("button", { name: "登录 / 注册" }));
  return user;
}

function seedCompleted(
  id: string,
  name: string,
  widthMm = 30,
  heightMm = 30,
) {
  createWork(
    {
      name,
      status: "completed",
      imageState: {
        ...createDefaultWorkImageState(),
        shape: widthMm === heightMm ? "square" : "rectangle",
        widthMm,
        heightMm,
      },
    },
    { createId: () => id },
  );
}

describe("Change 5 integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/login";
    setExportWorkIds([]);
    downloadPdfMock.mockClear();
    downloadPdfMock.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  });

  it("adds P3 selected works to P4, auto-paginates and downloads through the PDF action", async () => {
    render(<App />);
    const user = await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });

    for (let index = 0; index < 8; index += 1) {
      seedCompleted(`large-${index}`, `大作品 ${index + 1}`, 80, 80);
    }
    seedCompleted("extra-1", "待添加作品", 40, 40);

    await user.click(screen.getByRole("button", { name: "作品列表" }));
    await screen.findByRole("heading", { name: "作品列表" });
    await user.click(screen.getByRole("button", { name: "已完成" }));
    for (let index = 1; index <= 8; index += 1) {
      await user.click(screen.getByLabelText(`选择作品 大作品 ${index}`));
    }
    await user.click(screen.getByRole("button", { name: "A4 导出" }));

    expect(await screen.findByRole("heading", { name: "A4 导出" })).toBeVisible();
    expect(screen.getByText("共添加 8 件作品")).toBeVisible();
    expect(screen.getByText(/第 1 \/ 2 页/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "添加作品" }));
    const dialog = screen.getByRole("dialog", { name: "添加已完成作品弹窗" });
    await user.click(within(dialog).getByLabelText("选择作品 待添加作品"));
    await user.click(within(dialog).getByRole("button", { name: "确定" }));
    expect(screen.getByText("共添加 9 件作品")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "旋转 90°" }));
    expect(screen.queryByLabelText(/缩放/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "下载 PDF" }));
    expect(await screen.findByText("PDF 已生成并开始下载。")).toBeVisible();
    expect(downloadPdfMock).toHaveBeenCalledOnce();
  });

  it("allows a completed P2 work to enter P4 directly", async () => {
    render(<App />);

    const user = await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });
    seedCompleted("completed-direct", "直接导出作品", 40, 40);

    act(() => {
      window.location.hash = "#/editor/completed-direct";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await screen.findByDisplayValue("直接导出作品");
    await user.click(screen.getByRole("button", { name: "A4 导出" }));

    expect(await screen.findByRole("heading", { name: "A4 导出" })).toBeVisible();
    await waitFor(() => expect(screen.getByText("共添加 1 件作品")).toBeVisible());
  });
});
