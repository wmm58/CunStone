import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FIXED_TEST_CODE,
  loginWithFixedCode,
  signOut,
} from "../features/auth/authService";
import {
  createWork,
  getActiveUserWork,
  listActiveUserWorks,
} from "../features/works/workService";
import EditorPage from "./EditorPage";

function login(phone = "13800138000", userId = "user-1") {
  loginWithFixedCode(
    { phone, code: FIXED_TEST_CODE },
    { createId: () => userId },
  );
}

function seedWork(name = "已有草稿", status: "draft" | "completed" = "draft") {
  return createWork(
    { name, status },
    { createId: () => "work-1", now: () => "2026-11-02T10:00:00.000Z" },
  );
}

describe("EditorPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates a new draft and notifies the route owner", async () => {
    const user = userEvent.setup();
    const onWorkSaved = vi.fn();
    login();
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={onWorkSaved}
      />,
    );

    await user.clear(screen.getByLabelText("作品名称"));
    await user.type(screen.getByLabelText("作品名称"), "第一枚印章");
    await user.click(screen.getByRole("button", { name: "草稿" }));

    expect(onWorkSaved).toHaveBeenCalledOnce();
    const savedWorkId = onWorkSaved.mock.calls[0][0];
    expect(listActiveUserWorks()).toMatchObject([
      { id: savedWorkId, name: "第一枚印章", status: "draft" },
    ]);
  });

  it("requires a non-empty work name", async () => {
    const user = userEvent.setup();
    login();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText("作品名称"));
    await user.click(screen.getByRole("button", { name: "草稿" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请输入作品名称");
  });

  it("reopens a saved draft and can mark it completed", async () => {
    const user = userEvent.setup();
    login();
    seedWork();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-1"
      />,
    );

    expect(await screen.findByDisplayValue("已有草稿")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存（已完成）" }));

    expect(screen.getByText("已完成")).toBeVisible();
    expect(getActiveUserWork("work-1")?.status).toBe("completed");
  });

  it("autosaves a name change in an existing work", async () => {
    const user = userEvent.setup();
    login();
    seedWork();
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-1"
      />,
    );

    const input = await screen.findByDisplayValue("已有草稿");
    await user.clear(input);
    await user.type(input, "自动保存后的名字");

    expect(await screen.findByText(/已保存/)).toBeVisible();
    expect(getActiveUserWork("work-1")?.name).toBe("自动保存后的名字");
  });

  it("keeps input and shows an error when autosave cannot write", async () => {
    const user = userEvent.setup();
    login();
    seedWork();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-1"
      />,
    );

    const input = await screen.findByDisplayValue("已有草稿");
    await user.clear(input);
    await user.type(input, "不会丢失的名字");

    expect(await screen.findByText("保存失败，请重试")).toBeVisible();
    expect(input).toHaveValue("不会丢失的名字");
    setItem.mockRestore();
  });

  it("does not expose a work from another local account", async () => {
    login();
    seedWork();
    signOut();
    login("13900139000", "user-2");

    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-1"
      />,
    );

    expect(
      await screen.findByText("作品不存在或不属于当前本地账号"),
    ).toBeVisible();
    expect(screen.queryByLabelText("作品名称")).not.toBeInTheDocument();
  });

  it("states that local accounts are not a security boundary", () => {
    login();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/本地账号只用于数据区分，不构成安全隔离/),
    ).toBeVisible();
  });
});
