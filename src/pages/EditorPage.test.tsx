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

function seedWork(name = "已有草稿", status: "draft" | "completed" = "draft") {
  return createWork(
    { name, status },
    { createId: () => "work-1", now: () => "2026-11-02T10:00:00.000Z" },
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
        backgroundColor: "#ffffff",
      },
      binaryState,
    },
    { createId: () => "work-image", now: () => "2026-11-02T10:00:00.000Z" },
  );
}

describe("EditorPage", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(imageInput.prepareSourceFile).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(preparedImage);
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("creates a new draft and notifies the route owner", async () => {
    const user = userEvent.setup();
    const onWorkSaved = vi.fn();
    login();
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
    await user.click(screen.getByRole("button", { name: "长方形" }));
    await user.click(screen.getByRole("button", { name: "草稿" }));

    expect(onWorkSaved).toHaveBeenCalledOnce();
    const savedWorkId = onWorkSaved.mock.calls[0][0];
    expect(listActiveUserWorks()).toMatchObject([
      {
        id: savedWorkId,
        name: "第一枚印章",
        status: "draft",
        imageState: { shape: "rectangle", widthMm: 20, heightMm: 30 },
      },
    ]);
  });

  it("requires a non-empty work name", async () => {
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

  it("reopens a saved draft and can mark it completed", async () => {
    const user = userEvent.setup();
    login();
    seedWork();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-1"
      />,
    );

    expect(await screen.findByDisplayValue("已有草稿")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存（已完成）" }));

    expect(screen.getByText("已完成")).toBeVisible();
    expect(getActiveUserWork("work-1")?.status).toBe("completed");
  });

  it("autosaves a name change in an existing work", async () => {
    const user = userEvent.setup();
    login();
    seedWork();
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-1"
      />,
    );

    const input = await screen.findByDisplayValue("已有草稿");
    await user.clear(input);
    await user.type(input, "自动保存后的名字");

    expect(await screen.findByText(/已保存/)).toBeVisible();
    expect(getActiveUserWork("work-1")?.name).toBe("自动保存后的名字");
  });

  it("autosaves image processing settings in an existing work", async () => {
    const user = userEvent.setup();
    login();
    seedWork();
    render(
      <EditorPage
        autosaveDelayMs={10}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-1"
      />,
    );

    await screen.findByDisplayValue("已有草稿");
    await user.click(screen.getByRole("button", { name: "圆形" }));

    await waitFor(() => {
      expect(getActiveUserWork("work-1")?.imageState).toMatchObject({
        shape: "circle",
        widthMm: 25,
        heightMm: 25,
      });
    });
  });

  it("autosaves black-white editing settings in an existing work", async () => {
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

    await screen.findByDisplayValue("已有图片作品");
    const editButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(editButton).toBeEnabled());
    await user.click(editButton);
    await user.click(screen.getByRole("button", { name: "阴刻" }));

    await waitFor(() =>
      expect(getActiveUserWork("work-image")?.binaryState.carvingMode).toBe("yin"),
    );
    expect(screen.getByRole("button", { name: "阴刻" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("debounces rapid image setting changes into one storage write", async () => {
    login();
    seedWork();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(
      <EditorPage
        autosaveDelayMs={80}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-1"
      />,
    );

    await screen.findByDisplayValue("已有草稿");
    fireEvent.click(screen.getByRole("button", { name: "长方形" }));
    fireEvent.click(screen.getByRole("button", { name: "圆形" }));
    fireEvent.click(screen.getByRole("button", { name: "轮廓线稿" }));
    fireEvent.click(screen.getByRole("button", { name: "实心剪影" }));

    await waitFor(() =>
      expect(getActiveUserWork("work-1")?.imageState).toMatchObject({
        shape: "circle",
        effectMode: "silhouette",
      }),
    );
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("debounces rapid binary setting changes into one storage write", async () => {
    login();
    seedImageWork();
    canvasMock = installCanvasMock();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(
      <EditorPage
        autosaveDelayMs={80}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-image"
      />,
    );

    await screen.findByDisplayValue("已有图片作品");
    const editButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(editButton).toBeEnabled());
    fireEvent.click(editButton);
    fireEvent.click(screen.getByRole("button", { name: "阴刻" }));
    fireEvent.click(screen.getByRole("button", { name: "阳刻" }));
    fireEvent.click(screen.getByRole("button", { name: "左右镜像" }));
    fireEvent.click(screen.getByRole("button", { name: "正常方向" }));
    fireEvent.click(screen.getByRole("button", { name: "双线" }));
    fireEvent.click(screen.getByRole("button", { name: "残破边" }));

    await waitFor(() =>
      expect(getActiveUserWork("work-image")?.binaryState).toMatchObject({
        carvingMode: "yang",
        orientation: "normal",
        borderStyle: "broken",
      }),
    );
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("keeps input and shows an error when autosave cannot write", async () => {
    const user = userEvent.setup();
    login();
    seedWork();
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
        workId="work-1"
      />,
    );

    const input = await screen.findByDisplayValue("已有草稿");
    await user.clear(input);
    await user.type(input, "不会丢失的名字");

    expect(await screen.findByText("保存失败，请重试")).toBeVisible();
    expect(input).toHaveValue("不会丢失的名字");
    setItem.mockRestore();
  });

  it("keeps a replacement image and shows an error when immediate persistence fails", async () => {
    const user = userEvent.setup();
    login();
    createWork(
      {
        name: "已有图片作品",
        status: "draft",
        imageState: {
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: preparedImage.dataUrl,
        },
      },
      { createId: () => "work-1" },
    );
    canvasMock = installCanvasMock();
    const replacement = {
      ...preparedImage,
      dataUrl: "data:image/png;base64,bmV3",
    };
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(replacement);
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

    render(
      <EditorPage
        autosaveDelayMs={60_000}
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-1"
      />,
    );

    await screen.findByDisplayValue("已有图片作品");
    fireEvent.change(screen.getByLabelText("上传图片"), {
      target: {
        files: [
          new File([new Uint8Array([1])], "replacement.png", {
            type: "image/png",
          }),
        ],
      },
    });

    expect(await screen.findByText("保存失败，请重试")).toBeVisible();
    expect(screen.getByLabelText("编辑画布")).toBeVisible();
    expect(getActiveUserWork("work-1")?.imageState.sourceDataUrl).toBe(
      preparedImage.dataUrl,
    );

    setItem.mockRestore();
    await user.click(screen.getByRole("button", { name: "草稿" }));

    await vi.waitFor(() =>
      expect(getActiveUserWork("work-1")?.imageState.sourceDataUrl).toBe(
        replacement.dataUrl,
      ),
    );
    expect(screen.queryByText("保存失败，请重试")).not.toBeInTheDocument();
  });

  it("keeps binary settings when autosave fails and retries on explicit save", async () => {
    const user = userEvent.setup();
    login();
    seedImageWork();
    canvasMock = installCanvasMock();
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

    await screen.findByDisplayValue("已有图片作品");
    const editButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(editButton).toBeEnabled());
    await user.click(editButton);
    await user.click(screen.getByRole("button", { name: "阴刻" }));

    expect(await screen.findByText("保存失败，请重试")).toBeVisible();
    expect(screen.getByRole("button", { name: "阴刻" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    setItem.mockRestore();
    await user.click(screen.getByRole("button", { name: "草稿" }));
    expect(getActiveUserWork("work-image")?.binaryState.carvingMode).toBe("yin");
  });

  it("prevents unsaved or draft work from entering A4 export", async () => {
    const user = userEvent.setup();
    login();
    const hashBefore = window.location.hash;
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "A4 导出" }));

    expect(
      screen.getByText("请先保存为已完成作品，再进行 A4 导出。"),
    ).toBeVisible();
    expect(window.location.hash).toBe(hashBefore);
    expect(screen.queryByText(/PDF 下载/)).not.toBeInTheDocument();
  });

  it("does not expose a work from another local account", async () => {
    login();
    seedWork();
    signOut();
    login("13900139000", "user-2");

    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
        workId="work-1"
      />,
    );

    expect(
      await screen.findByText("作品不存在或不属于当前本地账号"),
    ).toBeVisible();
    expect(screen.queryByLabelText("作品名称")).not.toBeInTheDocument();
  });

  it("states that local accounts are not a security boundary", () => {
    login();
    render(
      <EditorPage
        onSignOut={vi.fn()}
        onStartNew={vi.fn()}
        onWorkSaved={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/本地账号只用于数据区分，不构成安全隔离/),
    ).toBeVisible();
  });
});
