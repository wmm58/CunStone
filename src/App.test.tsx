import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import App from "./App";
import { FIXED_TEST_CODE } from "./features/auth/authService";

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
});
