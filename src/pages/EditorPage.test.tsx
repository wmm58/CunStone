import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type WorkBinaryEditState,
} from "../domain/types";
import {
  FIXED_TEST_CODE,
  loginWithFixedCode,
  signOut,
} from "../features/auth/authService";
import * as imageInput from "../features/editor/imageInput";
import { peekExportWorkIds } from "../features/export/exportSession";
import { createGenerationSignature } from "../features/editor/binaryRendering";
import { encodeOverlay } from "../lib/binary/overlayCodec";
import {
  createWork,
  getActiveUserWork,
  listActiveUserWorks,
} from "../features/works/workService";
import { installCanvasMock } from "../test/canvasMock";
import EditorPage from "./EditorPage";

vi.mock("../features/editor/imageInput", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../features/editor/imageInput")>();
  return {
    ...actual,
    prepareSourceFile: vi.fn(),
    prepareSourceDataUrl: vi.fn(),
  };
});

const preparedImage = {
  width: 2,
  height: 2,
  dataUrl: "data:image/png;base64,b2xk",
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

function login(phone = "13800138000", userId = "user-1") {
  loginWithFixedCode(
    { phone, code: FIXED_TEST_CODE },
    { createId: () => userId },
  );
}

function seedImageWork(binaryState: WorkBinaryEditState = createDefaultWorkBinaryState()) {
  return createWork(
    {
      name: "已有图片作品",
      status: "draft",
      imageState: {
        ...createDefaultWorkImageState(),
        sourceKind: "upload",
        sourceDataUrl: preparedImage.dataUrl,
        backgroundRules: [
          { id: "white", color: "#ffffff", tolerance: 0 },
        ],
      },
      binaryState,
    },
    { createId: () => "work-image", now: () => "2026-11-02T10:00:00.000Z" },
  );
}

async function openBinaryMode() {
  const button = screen.getByRole("button", { name: "黑白稿编辑" });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.setup().click(button);
}

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

describe("EditorPage", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(imageInput.prepareSourceFile).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(preparedImage);
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(preparedImage);
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("requires a non-empty work name before save validation", async () => {
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

  it("blocks both draft and completed save for an empty work", async () => {
    const user = userEvent.setup();
    login();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "草稿" }));
    expect(screen.getByRole("alert")).toHaveTextContent("作品为空");
    expect(listActiveUserWorks()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByRole("alert")).toHaveTextContent("作品为空");
    expect(listActiveUserWorks()).toHaveLength(0);
  });

  it("saves a completed work with the simplified save label", async () => {
    const user = userEvent.setup();
    login();
    const onWorkSaved = vi.fn();
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
    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([1])], "sample.png", { type: "image/png" })],
      },
    });
    await screen.findByLabelText("编辑画布");
    await user.click(screen.getByRole("button", { name: "保存" }));

    const dialog = screen.getByRole("dialog", { name: "作品已保存" });
    expect(dialog).toHaveTextContent(
      "作品已保存到当前浏览器，可继续编辑，也可在作品列表中预览或进入 A4 排版。",
    );
    expect(dialog).toHaveTextContent("本地账号仅用于区分作品，不等同于安全隔离。");
    expect(onWorkSaved).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "知道了" }));
    expect(onWorkSaved).toHaveBeenCalledOnce();
    expect(listActiveUserWorks()).toMatchObject([
      {
        name: "第一枚印章",
        status: "completed",
      },
    ]);
  });

  it("reopens a saved work and marks it completed", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );

    expect(await screen.findByDisplayValue("已有图片作品")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("dialog", { name: "作品已保存" })).toBeVisible();
    expect(getActiveUserWork("work-image")?.status).toBe("completed");
  });

  it("autosaves a name change only after valid printable content is available", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );

    const input = await screen.findByDisplayValue("已有图片作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    await user.clear(input);
    await user.type(input, "自动保存后的名字");

    await waitFor(() =>
      expect(getActiveUserWork("work-image")?.name).toBe("自动保存后的名字"),
    );
  });

  it("does not autosave a blank work even when its name changes", async () => {
    const user = userEvent.setup();
    login();
    const work = createWork(
      { name: "旧空作品", status: "draft" },
      { createId: () => "blank-work" },
    );
    expect(work.ok).toBe(true);
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="blank-work"
      />,
    );

    const input = await screen.findByDisplayValue("旧空作品");
    await user.clear(input);
    await user.type(input, "不应自动保存");
    await new Promise((resolve) => window.setTimeout(resolve, 30));

    expect(getActiveUserWork("blank-work")?.name).toBe("旧空作品");
  });

  it("clears all work content without overwriting the last valid saved version", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );

    await screen.findByDisplayValue("已有图片作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    const before = getActiveUserWork("work-image");

    await user.click(screen.getByRole("button", { name: "清除" }));
    expect(screen.queryByText("#FFFFFF")).not.toBeInTheDocument();
    expect(screen.getByLabelText("作品名称")).toHaveValue("已有图片作品");
    await new Promise((resolve) => window.setTimeout(resolve, 30));

    expect(getActiveUserWork("work-image")).toEqual(before);
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByRole("alert")).toHaveTextContent("作品为空");
  });

  it("resumes autosave after a valid replacement image is uploaded following clear", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    const replacement = {
      ...preparedImage,
      dataUrl: "data:image/png;base64,bmV3",
    };
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(replacement);
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );

    await screen.findByDisplayValue("已有图片作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "清除" }));
    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([2])], "replacement.png", {
          type: "image/png",
        })],
      },
    });

    await waitFor(() =>
      expect(getActiveUserWork("work-image")?.imageState.sourceDataUrl).toBe(
        replacement.dataUrl,
      ),
    );
  });

  it("autosaves binary settings and border thickness", async () => {
    login();
    seedImageWork();
    canvasMock = installCanvasMock();
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );

    await screen.findByDisplayValue("已有图片作品");
    await openBinaryMode();
    fireEvent.click(screen.getByRole("button", { name: "阴刻" }));
    fireEvent.click(screen.getByRole("button", { name: "双线" }));
    fireEvent.change(screen.getByLabelText("边框粗细"), {
      target: { value: "8" },
    });

    await waitFor(() =>
      expect(getActiveUserWork("work-image")?.binaryState).toMatchObject({
        carvingMode: "yin",
        borderStyle: "double",
        borderThickness: 8,
      }),
    );
  });

  it("does not autosave image eraser strokes until an explicit save", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    canvasMock = installCanvasMock();
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );

    const canvas = await screen.findByLabelText("编辑画布");
    mockCanvasRect(canvas as HTMLCanvasElement);
    const before = getActiveUserWork("work-image");
    await user.click(screen.getByRole("button", { name: "使用橡皮" }));
    fireEvent.change(screen.getByLabelText("图片橡皮大小"), {
      target: { value: "1" },
    });
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 70, clientY: 70, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 70, clientY: 70, pointerId: 1 });

    await new Promise((resolve) => window.setTimeout(resolve, 40));

    expect(getActiveUserWork("work-image")).toEqual(before);
    expect(screen.getByRole("button", { name: "使用橡皮" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(getActiveUserWork("work-image")?.imageState.sourceDataUrl).toContain(
      "data:image/webp",
    );
  });

  it("keeps a valid work and shows an error when autosave cannot write", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
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
        workId="work-image"
      />,
    );

    const input = await screen.findByDisplayValue("已有图片作品");
    await screen.findByLabelText("编辑画布");
    await user.clear(input);
    await user.type(input, "不会丢失的名字");

    expect(await screen.findByText("保存失败，请重试")).toBeVisible();
    expect(input).toHaveValue("不会丢失的名字");
    setItem.mockRestore();
  });

  it("shows the approved draft-save modal", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );
    await screen.findByDisplayValue("已有图片作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "草稿" }));

    const dialog = screen.getByRole("dialog", { name: "草稿已保存" });
    expect(dialog).toHaveTextContent(
      "作品已保存到当前浏览器。更换浏览器、清除站点数据或更换设备后可能无法恢复。",
    );
    expect(dialog).toHaveTextContent("本地账号仅用于区分作品，不等同于安全隔离。");
  });

  it("protects unsaved changes before leaving the editor", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    const onOpenWorks = vi.fn();
    render(
      <EditorPage
        onOpenWorks={onOpenWorks}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );
    const input = await screen.findByDisplayValue("已有图片作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    await user.clear(input);
    await user.type(input, "未保存的改名");

    await user.click(screen.getByRole("button", { name: "作品列表" }));
    expect(screen.getByRole("dialog", { name: "当前修改尚未保存" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(onOpenWorks).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "作品列表" }));
    await user.click(screen.getByRole("button", { name: "保存草稿并继续" }));

    expect(onOpenWorks).toHaveBeenCalledOnce();
    expect(getActiveUserWork("work-image")?.name).toBe("未保存的改名");
  });

  it("keeps the editor open when saving before leave fails", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    const onOpenWorks = vi.fn();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
    render(
      <EditorPage
        onOpenWorks={onOpenWorks}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );
    const input = await screen.findByDisplayValue("已有图片作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    await user.clear(input);
    await user.type(input, "保存失败");
    await user.click(screen.getByRole("button", { name: "作品列表" }));
    await user.click(screen.getByRole("button", { name: "保存草稿并继续" }));

    expect(onOpenWorks).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("保存失败，请重试");
    expect(input).toHaveValue("保存失败");
    setItem.mockRestore();
  });

  it("asks before replacing existing content and can cancel or continue", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );
    await screen.findByDisplayValue("已有图片作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "上传图片" }));
    expect(screen.getByRole("dialog", { name: "替换当前作品？" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(inputClick).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "上传图片" }));
    await user.click(screen.getByRole("button", { name: "直接替换" }));
    expect(inputClick).toHaveBeenCalledOnce();
  });

  it("opens the picker without a replacement prompt for an empty canvas", async () => {
    const user = userEvent.setup();
    login();
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "上传图片" }));

    expect(screen.queryByRole("dialog", { name: "替换当前作品？" })).not.toBeInTheDocument();
    expect(inputClick).toHaveBeenCalledOnce();
  });

  it("protects unsaved changes before switching accounts", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    const onSignOut = vi.fn();
    render(
      <EditorPage
        onSignOut={onSignOut}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );
    const input = await screen.findByDisplayValue("已有图片作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    await user.clear(input);
    await user.type(input, "未保存后切号");

    await user.click(screen.getByRole("button", { name: "切换账号" }));
    expect(screen.getByRole("dialog", { name: "当前修改尚未保存" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "直接离开" }));

    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("saves the current draft before opening the replacement picker", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );
    const input = await screen.findByDisplayValue("已有图片作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );
    await user.clear(input);
    await user.type(input, "替换前保存的草稿");

    await user.click(screen.getByRole("button", { name: "上传图片" }));
    await user.click(screen.getByRole("button", { name: "保存草稿并替换" }));

    expect(inputClick).toHaveBeenCalledOnce();
    expect(getActiveUserWork("work-image")).toMatchObject({
      name: "替换前保存的草稿",
      status: "draft",
    });
  });

  it("does not open the replacement picker when drafting before replace fails", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );
    await screen.findByDisplayValue("已有图片作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "上传图片" }));
    await user.click(screen.getByRole("button", { name: "保存草稿并替换" }));

    expect(inputClick).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("保存失败，请重试");
    expect(getActiveUserWork("work-image")?.name).toBe("已有图片作品");
    setItem.mockRestore();
  });

  it("resets image-dependent state after a direct replacement image is chosen", async () => {
    const user = userEvent.setup();
    login();
    const imageState = {
      ...createDefaultWorkImageState(),
      sourceKind: "upload" as const,
      sourceDataUrl: preparedImage.dataUrl,
      backgroundRules: [
        { id: "white", color: "#ffffff", tolerance: 10 },
      ],
      effectMode: "outline" as const,
      outlineThickness: 8,
    };
    const overlay = new Uint8Array(512 * 512);
    overlay[512 * 256 + 256] = 1;
    const binaryState = {
      ...createDefaultWorkBinaryState(),
      overlayData: encodeOverlay(overlay, 512, 512),
      overlayWidth: 512,
      overlayHeight: 512,
      generationSignature: createGenerationSignature(imageState),
    };
    createWork(
      {
        name: "待替换作品",
        status: "draft",
        imageState,
        binaryState,
      },
      { createId: () => "replace-work" },
    );
    const replacement = {
      ...preparedImage,
      dataUrl: "data:image/png;base64,cmVwbGFjZWQ=",
    };
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(replacement);
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="replace-work"
      />,
    );
    await screen.findByDisplayValue("待替换作品");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "黑白稿编辑" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "上传图片" }));
    await user.click(screen.getByRole("button", { name: "直接替换" }));
    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([3])], "replacement.png", {
          type: "image/png",
        })],
      },
    });

    await waitFor(() =>
      expect(getActiveUserWork("replace-work")?.imageState.sourceDataUrl).toBe(
        replacement.dataUrl,
      ),
    );
    expect(getActiveUserWork("replace-work")?.imageState).toMatchObject({
      backgroundRules: [],
      effectMode: "silhouette",
      outlineThickness: 1,
    });
    expect(getActiveUserWork("replace-work")?.binaryState.overlayData).toBeNull();
  });

  it("blocks A4 export for an empty work", async () => {
    const user = userEvent.setup();
    login();
    const onOpenExport = vi.fn();
    render(
      <EditorPage
        onOpenExport={onOpenExport}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "A4 导出" }));

    expect(screen.getByRole("alert")).toHaveTextContent("作品为空");
    expect(onOpenExport).not.toHaveBeenCalled();
  });

  it("auto-saves a new valid work as completed before entering A4", async () => {
    const user = userEvent.setup();
    login();
    const onOpenExport = vi.fn();
    render(
      <EditorPage
        onOpenExport={onOpenExport}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );
    await user.clear(screen.getByLabelText("作品名称"));
    await user.type(screen.getByLabelText("作品名称"), "直接导出作品");
    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [new File([new Uint8Array([1])], "sample.png", { type: "image/png" })],
      },
    });
    await screen.findByLabelText("编辑画布");
    await user.click(screen.getByRole("button", { name: "黑白稿编辑" }));
    await screen.findByLabelText("黑白稿编辑画布");
    await user.click(screen.getByRole("button", { name: "图片编辑" }));

    await user.click(screen.getByRole("button", { name: "A4 导出" }));

    expect(onOpenExport).toHaveBeenCalledOnce();
    const saved = listActiveUserWorks()[0];
    expect(saved).toMatchObject({
      name: "直接导出作品",
      status: "completed",
    });
    expect(peekExportWorkIds()).toEqual([saved.id]);
  });

  it("does not expose a work from another local account", async () => {
    login();
    seedImageWork();
    signOut();
    login("13900139000", "user-2");

    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );

    expect(
      await screen.findByText("作品不存在或不属于当前本地账号"),
    ).toBeVisible();
  });

  it("does not keep draft, unsaved or local-account notices on the page", () => {
    login();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("作品状态")).not.toBeInTheDocument();
    expect(screen.queryByText("未保存")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/本地账号只用于数据区分，不构成安全隔离/),
    ).not.toBeInTheDocument();
  });

  it("locks the desktop editor shell to the viewport", () => {
    login();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );

    const main = screen.getByRole("heading", { name: "创作编辑" }).closest("main");
    expect(main?.className).toContain("xl:h-dvh");
    expect(main?.className).toContain("xl:overflow-hidden");
  });

  it("keeps the work-name label and input on one line", () => {
    login();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("作品名称");
    expect(input.parentElement?.tagName).toBe("LABEL");
    expect(input.parentElement?.className).toContain("flex");
    expect(input.parentElement?.className).toContain("items-center");
  });
});
