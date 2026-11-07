import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { createDefaultWorkImageState } from "./domain/types";
import { FIXED_TEST_CODE } from "./features/auth/authService";
import * as imageInput from "./features/editor/imageInput";
import { APP_STORAGE_KEY, readAppState } from "./lib/storage/appStorage";
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
        return inSubject
          ? [0, 0, 0, 255]
          : [255, 255, 255, 255];
      }).flat(),
    ),
  },
};

function mockCanvasRect(canvas: HTMLCanvasElement) {
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

async function loginWithUi() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.type(screen.getByLabelText("验证码"), FIXED_TEST_CODE);
  await user.click(screen.getByRole("button", { name: "登录 / 注册" }));
  return user;
}

describe("Change 2 integration", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/login";
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

  it("uploads, removes background, edits effect, saves, and reopens the work", async () => {
    const firstRender = render(<App />);
    const user = await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });

    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([1])], "sample.png", { type: "image/png" })],
      },
    });

    const canvas = await screen.findByLabelText("编辑画布");
    mockCanvasRect(canvas as HTMLCanvasElement);
    fireEvent.click(canvas, { clientX: 10, clientY: 10 });

    const tolerance = screen.getByLabelText("背景容差");
    await waitFor(() => expect(tolerance).toBeEnabled());
    fireEvent.change(tolerance, { target: { value: "55" } });
    await user.click(screen.getByRole("button", { name: "圆形" }));
    await user.click(screen.getByRole("button", { name: "实心剪影" }));
    await user.click(screen.getByRole("button", { name: "草稿" }));

    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));
    const work = readAppState().state.works[0];
    expect(work.imageState).toMatchObject({
      sourceKind: "upload",
      sourceDataUrl: prepared.dataUrl,
      backgroundColor: "#ffffff",
      tolerance: 55,
      shape: "circle",
      widthMm: 25,
      heightMm: 25,
      effectMode: "silhouette",
    });

    firstRender.unmount();
    window.location.hash = `#/editor/${work.id}`;
    render(<App />);

    expect(await screen.findByDisplayValue("未命名作品")).toBeVisible();
    expect(
      await screen.findByRole("button", { name: "实心剪影" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("背景容差")).toHaveValue("55");
    expect(screen.getByText("#ffffff")).toBeVisible();
    expect(await screen.findByLabelText("编辑画布")).toBeVisible();
    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await user.click(binaryButton);
    expect(await screen.findByLabelText("黑白稿编辑画布")).toBeVisible();
  });

  it("draws a complete input, saves it, and persists drawing as source kind", async () => {
    const firstRender = render(<App />);
    const user = await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });

    await user.click(screen.getByRole("button", { name: "手绘画布" }));
    const drawingCanvas = screen.getByLabelText("手绘画布");
    mockCanvasRect(drawingCanvas as HTMLCanvasElement);
    fireEvent.pointerDown(drawingCanvas, {
      clientX: 20,
      clientY: 20,
      pointerId: 1,
    });
    fireEvent.pointerUp(drawingCanvas, {
      clientX: 20,
      clientY: 20,
      pointerId: 1,
    });
    await user.click(screen.getByRole("button", { name: "使用手绘稿" }));

    expect(await screen.findByLabelText("编辑画布")).toBeVisible();
    await user.clear(screen.getByLabelText("作品名称"));
    await user.type(screen.getByLabelText("作品名称"), "手绘作品");
    await user.click(screen.getByRole("button", { name: "长方形" }));
    await user.click(screen.getByRole("button", { name: "轮廓线稿" }));
    await user.click(screen.getByRole("button", { name: "保存（已完成）" }));

    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));
    const work = readAppState().state.works[0];
    expect(work).toMatchObject({
      name: "手绘作品",
      status: "completed",
    });
    expect(work.imageState).toMatchObject({
      sourceKind: "drawing",
      sourceDataUrl: prepared.dataUrl,
      shape: "rectangle",
      widthMm: 20,
      heightMm: 30,
      effectMode: "outline",
    });

    firstRender.unmount();
    window.location.hash = `#/editor/${work.id}`;
    render(<App />);

    expect(await screen.findByDisplayValue("手绘作品")).toBeVisible();
    expect(screen.getByRole("button", { name: "轮廓线稿" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("宽 (mm)")).toHaveValue("20");
    expect(screen.getByLabelText("高 (mm)")).toHaveValue("30");
    expect(await screen.findByLabelText("编辑画布")).toBeVisible();
    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await user.click(binaryButton);
    expect(await screen.findByLabelText("黑白稿编辑画布")).toBeVisible();
  });

  it("opens a migrated v1 work with an empty image state and stores no derived image", async () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        activeUserId: "user-1",
        users: [
          {
            id: "user-1",
            phone: "13800138000",
            createdAt: "2026-11-02T10:00:00.000Z",
          },
        ],
        works: [
          {
            id: "work-1",
            ownerId: "user-1",
            name: "旧版作品",
            status: "draft",
            createdAt: "2026-11-02T10:01:00.000Z",
            lastSavedAt: "2026-11-02T10:02:00.000Z",
          },
        ],
      }),
    );
    window.location.hash = "#/editor/work-1";

    render(<App />);

    expect(await screen.findByDisplayValue("旧版作品")).toBeVisible();
    expect(screen.getByText("请上传图片或完成手绘")).toBeVisible();
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem(APP_STORAGE_KEY) ?? "{}")).toMatchObject({
        version: 3,
        works: [
          {
            id: "work-1",
            name: "旧版作品",
            imageState: {
              sourceKind: null,
              sourceDataUrl: null,
              shape: "square",
              widthMm: 25,
              heightMm: 25,
              tolerance: 20,
              effectMode: "silhouette",
            },
            binaryState: {
              overlayData: null,
              overlayWidth: null,
              overlayHeight: null,
              generationSignature: null,
              brushSize: 6,
              carvingMode: "yang",
              orientation: "normal",
              borderStyle: "none",
              editVersion: 1,
            },
          },
        ],
      }),
    );
    expect(window.localStorage.getItem(APP_STORAGE_KEY)).not.toMatch(
      /finalBinary|blackWhitePng|historySnapshot/i,
    );
  });

  it("migrates a v2 work and adds the default binary editing state", async () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        activeUserId: "user-1",
        users: [
          {
            id: "user-1",
            phone: "13800138000",
            createdAt: "2026-11-02T10:00:00.000Z",
          },
        ],
        works: [
          {
            id: "work-2",
            ownerId: "user-1",
            name: "第二版作品",
            status: "completed",
            createdAt: "2026-11-02T10:01:00.000Z",
            lastSavedAt: "2026-11-02T10:02:00.000Z",
            imageState: {
              ...createDefaultWorkImageState(),
              sourceKind: "upload",
              sourceDataUrl: prepared.dataUrl,
              backgroundColor: "#ffffff",
              tolerance: 35,
              effectMode: "outline",
            },
          },
        ],
      }),
    );
    window.location.hash = "#/editor/work-2";

    render(<App />);

    expect(await screen.findByDisplayValue("第二版作品")).toBeVisible();
    expect(screen.getByRole("button", { name: "轮廓线稿" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("背景容差")).toHaveValue("35");
    expect(screen.getByRole("button", { name: "阳刻" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("画笔线宽")).toHaveValue("6");

    await waitFor(() => {
      const saved = readAppState().state.works[0];
      expect(saved.binaryState).toMatchObject({
        overlayData: null,
        brushSize: 6,
        carvingMode: "yang",
        orientation: "normal",
        borderStyle: "none",
        editVersion: 1,
      });
    });
  });

  it("autosaves image settings and restores the work after signing out and back in", async () => {
    const firstRender = render(<App />);
    const user = await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });
    await user.clear(screen.getByLabelText("作品名称"));
    await user.type(screen.getByLabelText("作品名称"), "自动恢复作品");

    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([1])], "sample.png", { type: "image/png" })],
      },
    });
    await screen.findByLabelText("编辑画布");
    await user.click(screen.getByRole("button", { name: "草稿" }));
    await waitFor(() => expect(readAppState().state.works).toHaveLength(1));
    const workId = readAppState().state.works[0].id;

    await user.click(screen.getByRole("button", { name: "轮廓线稿" }));
    const tolerance = screen.getByLabelText("背景容差");
    await waitFor(() => expect(tolerance).toBeEnabled());
    fireEvent.change(tolerance, { target: { value: "65" } });
    await waitFor(() =>
      expect(readAppState().state.works[0].imageState).toMatchObject({
        effectMode: "outline",
        tolerance: 65,
      }),
    );

    await user.click(screen.getByRole("button", { name: "切换账号" }));
    expect(await screen.findByLabelText("手机号")).toBeVisible();
    await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });

    firstRender.unmount();
    window.location.hash = `#/editor/${workId}`;
    render(<App />);

    expect(await screen.findByDisplayValue("自动恢复作品")).toBeVisible();
    expect(screen.getByRole("button", { name: "轮廓线稿" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("背景容差")).toHaveValue("65");
    expect(await screen.findByLabelText("编辑画布")).toBeVisible();
  });

  it("does not expose P3, P4 or PDF capabilities", async () => {
    render(<App />);
    await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });

    for (const name of ["作品列表", "预览", "A4 排版", "下载 PDF", "自动可刻性检查"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText("红印效果")).not.toBeInTheDocument();
  });
});
