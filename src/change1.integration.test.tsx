import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import App from "./App";
import { FIXED_TEST_CODE } from "./features/auth/authService";
import { readAppState } from "./lib/storage/appStorage";

async function loginWithUi(phone: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("手机号"), phone);
  await user.type(screen.getByLabelText("验证码"), FIXED_TEST_CODE);
  await user.click(screen.getByRole("button", { name: "登录 / 注册" }));
  return user;
}

describe("Change 1 integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/login";
  });

  it("completes login, draft creation, account switch, and same-browser resume", async () => {
    render(<App />);
    const user = await loginWithUi("13800138000");

    expect(
      await screen.findByRole("heading", { name: "创作编辑" }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText("作品名称");
    await user.clear(nameInput);
    await user.type(nameInput, "跨页面恢复作品");
    await user.click(screen.getByRole("button", { name: "草稿" }));

    await waitFor(() => {
      expect(readAppState().state.works).toHaveLength(1);
    });
    const work = readAppState().state.works[0];
    const workHash = `#/editor/${work.id}`;

    await waitFor(() => expect(window.location.hash).toBe(workHash));
    expect(await screen.findByLabelText("作品状态")).toHaveTextContent("草稿");

    await user.click(screen.getByRole("button", { name: "切换账号" }));
    await screen.findByRole("heading", { name: "登录 / 注册" });
    await loginWithUi("13800138000");
    await screen.findByRole("heading", { name: "创作编辑" });

    act(() => {
      window.location.hash = workHash;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(await screen.findByDisplayValue("跨页面恢复作品")).toBeVisible();
    expect(screen.getByLabelText("作品状态")).toHaveTextContent("草稿");
    expect(screen.getByText(/已保存/)).toBeVisible();
  });

  it("does not expose one local account's work to another local account", async () => {
    render(<App />);
    const user = await loginWithUi("13800138000");
    await screen.findByRole("heading", { name: "创作编辑" });

    const nameInput = screen.getByLabelText("作品名称");
    await user.clear(nameInput);
    await user.type(nameInput, "账号一的作品");
    await user.click(screen.getByRole("button", { name: "草稿" }));
    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));
    const workHash = `#/editor/${readAppState().state.works[0].id}`;

    await user.click(screen.getByRole("button", { name: "切换账号" }));
    await screen.findByRole("heading", { name: "登录 / 注册" });
    await loginWithUi("13900139000");
    await screen.findByRole("heading", { name: "创作编辑" });

    act(() => {
      window.location.hash = workHash;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(
      await screen.findByText("作品不存在或不属于当前本地账号"),
    ).toBeVisible();
    expect(screen.queryByDisplayValue("账号一的作品")).not.toBeInTheDocument();
  });

  it("returns to login after local site data is cleared", async () => {
    const firstRender = render(<App />);
    await loginWithUi("13800138000");
    await screen.findByRole("heading", { name: "创作编辑" });

    firstRender.unmount();
    window.localStorage.clear();
    act(() => {
      window.location.hash = "#/editor/new";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "登录 / 注册" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/login");
  });
});
