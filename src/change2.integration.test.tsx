import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import * as imageInput from "./features/editor/imageInput";
import { readAppState } from "./lib/storage/appStorage";
import { installCanvasMock } from "./test/canvasMock";

vi.mock("./features/editor/imageInput", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./features/editor/imageInput")>();
  return {
    ...actual,
    prepareSourceFile: vi.fn(),
    prepareSourceDataUrl: vi.fn(),
  };
});

const prepared = {
  width: 4,
  height: 4,
  dataUrl: "data:image/png;base64,Y2hhbmdlMg==",
  raster: {
    width: 4,
    height: 4,
    data: new Uint8ClampedArray(
      Array.from({ length: 16 }, (_, index) => {
        const row = Math.floor(index / 4);
        const column = index % 4;
        const inSubject = row >= 1 && row <= 2 && column >= 1 && column <= 2;
        return inSubject ? [0, 0, 0, 255] : [255, 255, 255, 255];
      }).flat(),
    ),
  },
};

function mockCanvasRect(canvas: HTMLElement) {
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

async function startApp() {
  window.location.hash = "#/editor/new";
  return userEvent.setup();
}

async function uploadImage() {
  fireEvent.change(screen.getByLabelText("上传图片"), {
    target: {
      files: [new File([new Uint8Array([1])], "sample.png", { type: "image/png" })],
    },
  });
  return screen.findByLabelText("编辑画布");
}

async function addWhiteBackgroundRule() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "添加待选颜色" }));
  const canvas = await screen.findByLabelText("编辑画布");
  mockCanvasRect(canvas);
  fireEvent.click(canvas, { clientX: 10, clientY: 10 });
  await waitFor(() =>
    expect(screen.getByText("#FFFFFF")).toBeVisible(),
  );
}

describe("Change 2 integration", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/editor/new";
    canvasMock = installCanvasMock();
    vi.mocked(imageInput.prepareSourceFile).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(prepared);
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(prepared);
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("uploads, applies a background rule, edits effect, saves and reopens the work", async () => {
    const firstRender = render(<App />);
    const user = await startApp();
    await screen.findByRole("heading", { name: "创作编辑" });

    await uploadImage();
    await addWhiteBackgroundRule();
    fireEvent.change(screen.getByLabelText("颜色 1 容差"), {
      target: { value: "55" },
    });

    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await user.click(binaryButton);
    await user.click(screen.getByRole("button", { name: "圆形" }));
    await user.click(screen.getByRole("button", { name: "实心剪影" }));
    await user.click(screen.getByRole("button", { name: "草稿" }));

    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));
    const work = readAppState().state.works[0];
    expect(work.imageState).toMatchObject({
      sourceKind: "upload",
      sourceDataUrl: prepared.dataUrl,
      shape: "circle",
      widthMm: 25,
      heightMm: 25,
      effectMode: "silhouette",
      outlineThickness: 1,
      sharpenAmount: 1,
      outerMarginMm: 0,
      imageEraserSize: 24,
      processingVersion: 5,
      backgroundRules: [
        {
          color: "#ffffff",
          tolerance: 55,
        },
      ],
    });

    firstRender.unmount();
    window.location.hash = `#/editor/${work.id}`;
    render(<App />);

    expect(await screen.findByDisplayValue("未命名作品")).toBeVisible();
    expect(screen.getByLabelText("颜色 1 容差")).toHaveValue("55");
    expect(screen.getByText("#FFFFFF")).toBeVisible();
    expect(await screen.findByLabelText("编辑画布")).toBeVisible();
    const reopenedBinary = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(reopenedBinary).toBeEnabled());
    await user.click(reopenedBinary);
    expect(screen.getByRole("button", { name: "实心剪影" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByLabelText("黑白稿编辑画布")).toBeVisible();
  }, 30_000);

  it("autosaves multiple background rules and binary settings after content is ready", async () => {
    const firstRender = render(<App />);
    const user = await startApp();
    await screen.findByRole("heading", { name: "创作编辑" });
    await user.clear(screen.getByLabelText("作品名称"));
    await user.type(screen.getByLabelText("作品名称"), "自动恢复作品");

    await uploadImage();
    await addWhiteBackgroundRule();
    await user.click(screen.getByRole("button", { name: "草稿" }));
    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));
    const workId = readAppState().state.works[0].id;

    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await user.click(binaryButton);
    await user.click(screen.getByRole("button", { name: "轮廓线稿" }));
    await waitFor(() =>
      expect(readAppState().state.works[0].imageState).toMatchObject({
        effectMode: "outline",
        backgroundRules: [expect.objectContaining({ color: "#ffffff" })],
      }),
    );

    firstRender.unmount();
    window.location.hash = `#/editor/${workId}`;
    render(<App />);

    expect(await screen.findByDisplayValue("自动恢复作品")).toBeVisible();
    expect(screen.getByText("#FFFFFF")).toBeVisible();
    const reopenedBinary = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(reopenedBinary).toBeEnabled());
    await user.click(reopenedBinary);
    expect(screen.getByRole("button", { name: "轮廓线稿" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not expose P4, PDF, red-preview or carving-check content from P2", async () => {
    render(<App />);
    await startApp();
    await screen.findByRole("heading", { name: "创作编辑" });

    for (const name of ["预览", "A4 排版", "下载 PDF", "自动可刻性检查"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText("红印效果")).not.toBeInTheDocument();
  });
});
