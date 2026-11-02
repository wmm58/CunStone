import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FIXED_TEST_CODE } from "../features/auth/authService";
import LoginPage from "./LoginPage";

describe("LoginPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows an error for an invalid phone number", async () => {
    const user = userEvent.setup();
    render(<LoginPage onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("手机号"), "123");
    await user.type(screen.getByLabelText("验证码"), FIXED_TEST_CODE);
    await user.click(screen.getByRole("button", { name: "登录 / 注册" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请输入有效的 11 位手机号");
  });

  it("shows an error for an incorrect verification code", async () => {
    const user = userEvent.setup();
    render(<LoginPage onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("手机号"), "13800138000");
    await user.type(screen.getByLabelText("验证码"), "000000");
    await user.click(screen.getByRole("button", { name: "登录 / 注册" }));

    expect(screen.getByRole("alert")).toHaveTextContent("验证码错误");
  });

  it("fills the local test verification code without sending SMS", async () => {
    const user = userEvent.setup();
    render(<LoginPage onSuccess={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "获取测试验证码" }));

    expect(screen.getByLabelText("验证码")).toHaveValue(FIXED_TEST_CODE);
    expect(screen.getByText("测试模式：验证码已填入，未发送短信")).toBeVisible();
  });

  it("calls onSuccess after a valid local login", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<LoginPage onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("手机号"), "13800138000");
    await user.type(screen.getByLabelText("验证码"), FIXED_TEST_CODE);
    await user.click(screen.getByRole("button", { name: "登录 / 注册" }));

    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
