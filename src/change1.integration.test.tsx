import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import * as imageInput from "./features/editor/imageInput";
import { readAppState } from "./lib/storage/appStorage";

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
  width: 2,
  height: 2,
  dataUrl: "data:image/png;base64,Y2hhbmdlMQ==",
  raster: {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]),
  },
};

async function uploadImage() {
  fireEvent.change(screen.getByLabelText("上传图片"), {
    target: {
      files: [new File([new Uint8Array([1])], "sample.png", { type: "image/png" })],
    },
  });
  await screen.findByLabelText("编辑画布");
  await waitFor(() =>
    expect(screen.queryByText("正在处理本地图片…")).not.toBeInTheDocument(),
  );
}

describe("Change 1 integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/editor/new";
    vi.mocked(imageInput.prepareSourceFile).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(prepared);
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(prepared);
  });

  it("creates a draft without login and restores it in the same browser", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "创作编辑" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("手机号")).not.toBeInTheDocument();

    const nameInput = screen.getByLabelText("作品名称");
    await user.clear(nameInput);
    await user.type(nameInput, "跨页面恢复作品");
    await uploadImage();
    await user.click(screen.getByRole("button", { name: "草稿" }));
    await screen.findByRole("dialog", { name: "草稿已保存" });
    await user.click(screen.getByRole("button", { name: "知道了" }));

    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));
    const work = readAppState().state.works[0];
    const workHash = `#/editor/${work.id}`;

    await user.click(screen.getByRole("button", { name: "作品列表" }));
    expect(await screen.findByText("跨页面恢复作品")).toBeVisible();

    act(() => {
      window.location.hash = workHash;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(await screen.findByDisplayValue("跨页面恢复作品")).toBeVisible();
    expect(readAppState().state.works[0]).not.toHaveProperty("ownerId");
  });

  it("shows a local not-found page for an unknown work id", async () => {
    window.location.hash = "#/editor/missing-work";
    render(<App />);

    expect(await screen.findByText("作品不存在")).toBeVisible();
    expect(screen.queryByText("切换账号")).not.toBeInTheDocument();
  });

  it("starts with a blank editor after local site data is cleared", async () => {
    const firstRender = render(<App />);
    await screen.findByRole("heading", { name: "创作编辑" });

    firstRender.unmount();
    window.localStorage.clear();
    act(() => {
      window.location.hash = "#/editor/new";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "创作编辑" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/editor/new");
    expect(readAppState().state.works).toEqual([]);
  });
});
