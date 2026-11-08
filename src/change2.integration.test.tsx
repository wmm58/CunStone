import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { FIXED_TEST_CODE } from "./features/auth/authService";
import * as imageInput from "./features/editor/imageInput";
import { APP_STORAGE_KEY, readAppState } from "./lib/storage/appStorage";
import { installCanvasMock } from "./test/canvasMock";
import { createV3MigrationFixtures } from "./test/migrationFixtures";

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

async function loginWithUi() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.type(screen.getByLabelText("验证码"), FIXED_TEST_CODE);
  await user.click(screen.getByRole("button", { name: "登录 / 注册" }));
  return user;
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

  it("uploads, applies a background rule, edits effect, saves and reopens the work", async () => {
    const firstRender = render(<App />);
    const user = await loginWithUi();
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

  it("keeps historical drawing works readable without exposing a new drawing entry", async () => {
    const fixtures = createV3MigrationFixtures();
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        ...fixtures,
        works: fixtures.works.filter((work) => work.id === "legacy-drawing"),
      }),
    );
    window.location.hash = "#/editor/legacy-drawing";

    render(<App />);

    expect(await screen.findByDisplayValue("legacy-drawing")).toBeVisible();
    expect(screen.queryByRole("button", { name: "手绘画布" })).not.toBeInTheDocument();
    expect(await screen.findByLabelText("编辑画布")).toBeVisible();
    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    userEvent.setup().click(binaryButton);
    expect(await screen.findByLabelText("黑白稿编辑画布")).toBeVisible();
  });

  it("opens a migrated v1 work with an empty v5 image state", async () => {
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
    expect(
      screen.getByRole("button", { name: "点击画布中心上传图片" }),
    ).toBeVisible();
    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(APP_STORAGE_KEY) ?? "{}",
      );
      expect(stored).toMatchObject({
        version: 7,
        works: [
          {
            id: "work-1",
            imageState: {
              backgroundRules: [],
              outlineThickness: 1,
              sharpenAmount: 1,
              outerMarginMm: 0,
              imageEraserSize: 24,
              processingVersion: 5,
            },
            binaryState: {
              borderThickness: 2,
              borderMarginMm: 0,
              eraserSize: 6,
              editVersion: 4,
            },
          },
        ],
      });
    });
  });

  it("migrates a v2 single background into a v7 rule and default binary state", async () => {
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
              sourceKind: "upload",
              sourceDataUrl: prepared.dataUrl,
              shape: "square",
              widthMm: 25,
              heightMm: 25,
              backgroundColor: "#ffffff",
              tolerance: 35,
              effectMode: "outline",
              processingVersion: 1,
            },
          },
        ],
      }),
    );
    window.location.hash = "#/editor/work-2";

    render(<App />);

    expect(await screen.findByDisplayValue("第二版作品")).toBeVisible();
    expect(screen.getByLabelText("颜色 1 容差")).toHaveValue("35");
    const binaryButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(binaryButton).toBeEnabled());
    await userEvent.setup().click(binaryButton);
    expect(screen.getByRole("button", { name: "轮廓线稿" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("画笔大小")).toHaveValue("6");
    expect(screen.getByLabelText("边框粗细")).toHaveValue("2");

    await waitFor(() => {
      const saved = readAppState().state.works[0];
      expect(saved.imageState.backgroundRules).toEqual([
        expect.objectContaining({ color: "#ffffff", tolerance: 35 }),
      ]);
      expect(saved.binaryState).toMatchObject({
        borderStyle: "none",
        borderThickness: 2,
        borderMarginMm: 0,
        eraserSize: 6,
        editVersion: 4,
      });
    });
  });

  it("autosaves multiple background rules and binary settings after content is ready", async () => {
    const firstRender = render(<App />);
    const user = await loginWithUi();
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

    await user.click(screen.getByRole("button", { name: "切换账号" }));
    expect(await screen.findByLabelText("手机号")).toBeVisible();
    await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });

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
    await loginWithUi();
    await screen.findByRole("heading", { name: "创作编辑" });

    for (const name of ["预览", "A4 排版", "下载 PDF", "自动可刻性检查"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText("红印效果")).not.toBeInTheDocument();
  });
});
