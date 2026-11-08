import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { createDefaultWorkImageState } from "./domain/types";
import { FIXED_TEST_CODE } from "./features/auth/authService";
import * as imageInput from "./features/editor/imageInput";
import {
  createWork,
  listActiveUserWorks,
} from "./features/works/workService";
import { installCanvasMock } from "./test/canvasMock";

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
  dataUrl: "data:image/png;base64,Y2hhbmdlNA==",
  raster: {
    width: 4,
    height: 4,
    data: new Uint8ClampedArray(
      Array.from({ length: 16 }, (_, index) => {
        const row = Math.floor(index / 4);
        const column = index % 4;
        const subject = row >= 1 && row <= 2 && column >= 1 && column <= 2;
        return subject ? [0, 0, 0, 255] : [255, 255, 255, 255];
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

describe("Change 4 integration", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/login";
    canvasMock = installCanvasMock();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(prepared);
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("navigates from P2, previews, filters and permanently deletes completed works", async () => {
    render(<App />);
    const user = await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });

    createWork(
      {
        name: "完成作品",
        status: "completed",
        imageState: {
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
        },
      },
      { createId: () => "work-completed" },
    );
    createWork(
      { name: "草稿作品", status: "draft" },
      { createId: () => "work-draft" },
    );

    await user.click(screen.getByRole("button", { name: "作品列表" }));
    expect(await screen.findByRole("heading", { name: "作品列表" })).toBeVisible();

    const completedCard = screen.getByText("完成作品").closest("article");
    expect(completedCard).not.toBeNull();
    await user.click(
      within(completedCard as HTMLElement).getByRole("button", { name: "预览" }),
    );
    const dialog = screen.getByRole("dialog", { name: "作品预览弹窗" });
    expect(
      await within(dialog).findByLabelText("完成作品 红印预览"),
    ).toBeVisible();
    expect(
      await within(dialog).findByLabelText("完成作品 黑白印稿"),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "继续编辑" }));
    expect(await screen.findByDisplayValue("完成作品")).toBeVisible();

    act(() => {
      window.location.hash = "#/works";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await screen.findByRole("heading", { name: "作品列表" });
    await user.click(screen.getByRole("button", { name: "已完成" }));
    expect(screen.queryByText("草稿作品")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "一键全选" }));
    expect(screen.getByText("已选 1 项")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "删除" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "删除作品确认" })).getByRole(
        "button",
        { name: "确认删除" },
      ),
    );

    await waitFor(() =>
      expect(listActiveUserWorks().map((work) => work.name)).toEqual([
        "草稿作品",
      ]),
    );
    await user.click(screen.getByRole("button", { name: "全部作品" }));
    expect(screen.getByText("草稿作品")).toBeVisible();
  });
});
