import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import App from "./App";
import { APP_STORAGE_KEY } from "./lib/storage/appStorage";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/editor/new";
  });

  it("opens the editor directly when there is no local data", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "创作编辑" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("手机号")).not.toBeInTheDocument();
  });

  it("redirects the old login route to a new editor", async () => {
    window.location.hash = "#/login";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "创作编辑" }),
    ).toBeVisible();
    expect(window.location.hash).toBe("#/editor/new");
  });

  it("opens works and A4 export without an account", async () => {
    window.location.hash = "#/works";
    const first = render(<App />);
    expect(
      await screen.findByRole("heading", { name: "作品列表" }),
    ).toBeVisible();
    first.unmount();

    window.location.hash = "#/export/a4";
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "A4 导出" }),
    ).toBeVisible();
  });

  it("navigates from the editor to works and back to a new work", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "创作编辑" });

    await user.click(screen.getByRole("button", { name: "作品列表" }));
    expect(await screen.findByRole("heading", { name: "作品列表" })).toBeVisible();
    expect(window.location.hash).toBe("#/works");

    await user.click(screen.getByRole("button", { name: "新建作品" }));
    expect(await screen.findByRole("heading", { name: "创作编辑" })).toBeVisible();
    expect(window.location.hash).toBe("#/editor/new");
  });

  it("clears corrupt data and shows a one-time notice", async () => {
    window.localStorage.setItem(APP_STORAGE_KEY, "{broken");
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByText("本地数据无法读取，已清空并使用空白作品库启动。"),
    ).toBeVisible();
    expect(window.localStorage.getItem(APP_STORAGE_KEY)).toBeNull();
    await user.click(screen.getByRole("button", { name: "知道了" }));
    expect(
      screen.queryByText("本地数据无法读取，已清空并使用空白作品库启动。"),
    ).not.toBeInTheDocument();
  });

  it("clears old account data and starts with an empty library", async () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        version: 7,
        activeUserId: "user-1",
        users: [
          {
            id: "user-1",
            phone: "13800138000",
            createdAt: "2026-11-02T10:00:00.000Z",
          },
        ],
        works: [],
      }),
    );
    render(<App />);

    expect(
      await screen.findByText("旧版本本地数据已清空，已使用空白作品库启动。"),
    ).toBeVisible();
    expect(window.localStorage.getItem(APP_STORAGE_KEY)).toBeNull();
  });
});
