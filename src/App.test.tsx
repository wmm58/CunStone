import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import App from "./App";
import { FIXED_TEST_CODE } from "./features/auth/authService";
import { APP_STORAGE_KEY } from "./lib/storage/appStorage";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/login";
  });

  it("requires a local account before entering the editor route", async () => {
    window.location.hash = "#/editor/new";

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "登录 / 注册" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/login");
  });

  it("enters the P2 editor shell after successful local login", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("手机号"), "13800138000");
    await user.type(screen.getByLabelText("验证码"), FIXED_TEST_CODE);
    await user.click(screen.getByRole("button", { name: "登录 / 注册" }));

    expect(
      await screen.findByRole("heading", { name: "创作编辑" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/editor/new");
  });

  it("shows a safe notice when local data is corrupt", async () => {
    window.localStorage.setItem(APP_STORAGE_KEY, "{broken");

    render(<App />);

    expect(
      await screen.findByText("本地数据无法读取，已使用空数据启动。"),
    ).toBeVisible();
  });

  it("shows a safe notice when the stored data version is unsupported", async () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({ version: 999, activeUserId: null, users: [], works: [] }),
    );

    render(<App />);

    expect(
      await screen.findByText("本地数据版本不兼容，已使用空数据启动。"),
    ).toBeVisible();
    expect(window.localStorage.getItem(APP_STORAGE_KEY)).toContain('"version":999');
  });
});
