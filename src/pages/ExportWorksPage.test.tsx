import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FIXED_TEST_CODE, loginWithFixedCode } from "../features/auth/authService";
import { createDefaultWorkImageState } from "../domain/types";
import { createWork } from "../features/works/workService";
import { setExportWorkIds } from "../features/export/exportSession";
import ExportWorksPage from "./ExportWorksPage";

const { downloadPdfMock } = vi.hoisted(() => ({
  downloadPdfMock: vi.fn(),
}));

vi.mock("../features/works/WorkPreviewCanvas", () => ({
  default: ({ work }: { work: { name: string } }) => (
    <div data-testid="work-preview">{work.name}</div>
  ),
}));

vi.mock("../features/export/pdfExport", () => ({
  downloadA4Pdf: downloadPdfMock,
}));

function login() {
  loginWithFixedCode(
    { phone: "13800138000", code: FIXED_TEST_CODE },
    { createId: () => "user-1" },
  );
}

function seed(
  id: string,
  name: string,
  status: "draft" | "completed",
  widthMm = 30,
  heightMm = 30,
) {
  createWork(
    {
      name,
      status,
      imageState: {
        ...createDefaultWorkImageState(),
        widthMm,
        heightMm,
        shape: widthMm === heightMm ? "square" : "rectangle",
      },
    },
    { createId: () => id },
  );
}

function props() {
  return {
    onBack: vi.fn(),
    onSignOut: vi.fn(),
  };
}

describe("ExportWorksPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    login();
    downloadPdfMock.mockReset();
    downloadPdfMock.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  });

  it("shows added works, count and adds completed works from the modal", async () => {
    const user = userEvent.setup();
    seed("work-1", "作品一", "completed");
    seed("work-2", "作品二", "completed");
    seed("draft-1", "草稿一", "draft");
    setExportWorkIds(["work-1"]);
    render(<ExportWorksPage {...props()} />);

    expect(screen.getByRole("heading", { name: "已添加作品列表" })).toBeVisible();
    expect(screen.getByText("共添加 1 件作品")).toBeVisible();
    expect(screen.getByTestId("placed-work-work-1")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "添加作品" }));
    const dialog = screen.getByRole("dialog", { name: "添加已完成作品弹窗" });
    expect(within(dialog).queryByText("草稿一")).not.toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("选择作品 作品二"));
    await user.click(within(dialog).getByRole("button", { name: "确定" }));

    expect(screen.getByText("共添加 2 件作品")).toBeVisible();
    expect(screen.getByTestId("placed-work-work-2")).toBeVisible();
  });

  it("supports drag, rotate and spacing without scaling controls", async () => {
    const user = userEvent.setup();
    seed("work-1", "作品一", "completed", 30, 30);
    setExportWorkIds(["work-1"]);
    render(<ExportWorksPage {...props()} />);

    const placed = screen.getByTestId("placed-work-work-1");
    expect(placed).toHaveStyle({ left: "36px", top: "36px" });
    fireEvent.pointerDown(placed, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerMove(placed, {
      clientX: 130,
      clientY: 120,
      pointerId: 1,
    });
    fireEvent.pointerUp(placed, {
      clientX: 130,
      clientY: 120,
      pointerId: 1,
    });
    await waitFor(() =>
      expect(screen.getByTestId("placed-work-work-1")).toHaveStyle({
        left: "66px",
        top: "56px",
      }),
    );

    fireEvent.click(screen.getByTestId("placed-work-work-1"));
    await user.click(screen.getByRole("button", { name: "旋转 90°" }));
    expect(screen.getByTestId("placed-work-work-1-inner")).toHaveStyle({
      transform: "rotate(90deg)",
    });

    fireEvent.change(screen.getByLabelText("水平间距"), {
      target: { value: "12" },
    });
    expect(screen.getByLabelText("水平间距")).toHaveValue("12");
    expect(screen.queryByLabelText(/缩放/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /缩放/ })).not.toBeInTheDocument();
  });

  it("paginates large works and downloads the generated PDF", async () => {
    const user = userEvent.setup();
    const ids = Array.from({ length: 8 }, (_, index) => `large-${index}`);
    ids.forEach((id, index) => seed(id, `大作品 ${index + 1}`, "completed", 80, 80));
    setExportWorkIds(ids);
    render(<ExportWorksPage {...props()} />);

    expect(screen.getByText(/第 1 \/ 2 页/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(screen.getByText(/第 2 \/ 2 页/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "下载 PDF" }));
    expect(await screen.findByText("PDF 已生成并开始下载。")).toBeVisible();
    expect(downloadPdfMock).toHaveBeenCalledOnce();
  });

  it("does not generate an empty PDF and reports export failures", async () => {
    const user = userEvent.setup();
    setExportWorkIds([]);
    const { unmount } = render(<ExportWorksPage {...props()} />);

    await user.click(screen.getByRole("button", { name: "下载 PDF" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请先添加至少一件作品");
    expect(downloadPdfMock).not.toHaveBeenCalled();

    seed("work-1", "作品一", "completed");
    setExportWorkIds(["work-1"]);
    unmount();
    render(<ExportWorksPage {...props()} />);
    downloadPdfMock.mockRejectedValueOnce(new Error("failed"));
    await user.click(screen.getByRole("button", { name: "下载 PDF" }));
    expect(await screen.findByText("PDF 生成失败，请重试。")).toBeVisible();
  });
});
