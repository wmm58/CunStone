import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FIXED_TEST_CODE, loginWithFixedCode } from "../features/auth/authService";
import { createWork, listActiveUserWorks } from "../features/works/workService";
import WorksPage from "./WorksPage";

vi.mock("../features/works/WorkPreviewCanvas", () => ({
  default: ({
    variant,
    work,
  }: {
    variant: "binary" | "red";
    work: { name: string };
  }) => (
    <div data-testid={`preview-${variant}`}>
      {variant}:{work.name}
    </div>
  ),
}));

function login() {
  loginWithFixedCode(
    { phone: "13800138000", code: FIXED_TEST_CODE },
    { createId: () => "user-1" },
  );
}

function seedWorks() {
  createWork(
    { name: "草稿作品", status: "draft" },
    {
      createId: () => "work-draft",
      now: () => "2026-11-07T10:00:00.000Z",
    },
  );
  createWork(
    { name: "完成作品甲", status: "completed" },
    {
      createId: () => "work-completed-1",
      now: () => "2026-11-07T10:01:00.000Z",
    },
  );
  createWork(
    { name: "完成作品乙", status: "completed" },
    {
      createId: () => "work-completed-2",
      now: () => "2026-11-07T10:02:00.000Z",
    },
  );
}

function pageProps() {
  return {
    onEditWork: vi.fn(),
    onNewWork: vi.fn(),
    onOpenExport: vi.fn(),
    onSignOut: vi.fn(),
  };
}

describe("WorksPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    login();
  });

  it("filters works by all, completed and draft", async () => {
    const user = userEvent.setup();
    seedWorks();
    render(<WorksPage {...pageProps()} />);

    expect(screen.getByText("完成作品甲")).toBeVisible();
    expect(screen.getByText("草稿作品")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "已完成" }));
    expect(screen.getByText("完成作品甲")).toBeVisible();
    expect(screen.queryByText("草稿作品")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "草稿" }));
    expect(screen.getByText("草稿作品")).toBeVisible();
    expect(screen.queryByText("完成作品甲")).not.toBeInTheDocument();
  });

  it("shows red and black previews and supports continue editing", async () => {
    const user = userEvent.setup();
    seedWorks();
    const props = pageProps();
    render(<WorksPage {...props} />);

    const completedCard = screen.getByText("完成作品乙").closest("article");
    expect(completedCard).not.toBeNull();
    await user.click(
      within(completedCard as HTMLElement).getByRole("button", { name: "预览" }),
    );

    const dialog = screen.getByRole("dialog", { name: "作品预览弹窗" });
    expect(within(dialog).getByTestId("preview-red")).toHaveTextContent(
      "red:完成作品乙",
    );
    expect(within(dialog).getByTestId("preview-binary")).toHaveTextContent(
      "binary:完成作品乙",
    );

    await user.click(within(dialog).getByRole("button", { name: "继续编辑" }));
    expect(props.onEditWork).toHaveBeenCalledWith("work-completed-2");
  });

  it("selects completed works, shows count below bulk select and deletes after confirmation", async () => {
    const user = userEvent.setup();
    seedWorks();
    render(<WorksPage {...pageProps()} />);
    await user.click(screen.getByRole("button", { name: "已完成" }));
    const selectAll = screen.getByRole("button", { name: "一件全选" });
    const count = screen.getByText("已选 0 项");
    expect(count.previousElementSibling).toBe(selectAll);

    await user.click(selectAll);
    expect(screen.getByText("已选 2 项")).toBeVisible();
    expect(screen.getByLabelText("选择作品 完成作品甲")).toBeChecked();
    expect(screen.getByLabelText("选择作品 完成作品乙")).toBeChecked();

    await user.click(screen.getByRole("button", { name: "删除" }));
    const dialog = screen.getByRole("dialog", { name: "删除作品确认" });
    expect(dialog).toHaveTextContent("2 件");
    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(listActiveUserWorks()).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "删除" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "删除作品确认" })).getByRole(
        "button",
        { name: "确认删除" },
      ),
    );

    await waitFor(() => expect(listActiveUserWorks()).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "全部作品" }));
    expect(screen.getByText("草稿作品")).toBeInTheDocument();
    expect(screen.queryByText("完成作品甲")).not.toBeInTheDocument();
  });

  it("clears selection when leaving completed filter and opens A4 export with selected works", async () => {
    const user = userEvent.setup();
    seedWorks();
    const props = pageProps();
    render(<WorksPage {...props} />);
    await user.click(screen.getByRole("button", { name: "已完成" }));
    await user.click(screen.getByLabelText("选择作品 完成作品甲"));
    expect(screen.getByText("已选 1 项")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "全部作品" }));
    await user.click(screen.getByRole("button", { name: "已完成" }));
    expect(screen.getByText("已选 0 项")).toBeVisible();

    await user.click(screen.getByLabelText("选择作品 完成作品甲"));
    await user.click(screen.getByRole("button", { name: "A4 导出" }));
    expect(props.onOpenExport).toHaveBeenCalledOnce();
  });
});
