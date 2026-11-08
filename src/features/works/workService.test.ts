import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
} from "../../domain/types";
import { FIXED_TEST_CODE, loginWithFixedCode, signOut } from "../auth/authService";
import {
  createWork,
  deleteActiveUserWorks,
  getActiveUserWork,
  listActiveUserWorks,
  listActiveUserWorksByStatus,
  updateWork,
} from "./workService";

function login(phone: string, userId: string) {
  loginWithFixedCode(
    { phone, code: FIXED_TEST_CODE },
    {
      createId: () => userId,
      now: () => "2026-11-02T10:00:00.000Z",
    },
  );
}

describe("workService", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates a draft work owned by the active local account", () => {
    login("13800138000", "user-1");

    const result = createWork(
      { name: "  第一枚印章  ", status: "draft" },
      {
        createId: () => "work-1",
        now: () => "2026-11-02T10:01:00.000Z",
      },
    );

    expect(result).toEqual({
      ok: true,
      work: {
        id: "work-1",
        ownerId: "user-1",
        name: "第一枚印章",
        status: "draft",
        createdAt: "2026-11-02T10:01:00.000Z",
        lastSavedAt: "2026-11-02T10:01:00.000Z",
        imageState: createDefaultWorkImageState(),
        binaryState: createDefaultWorkBinaryState(),
      },
    });
  });

  it("rejects an empty work name", () => {
    login("13800138000", "user-1");

    expect(createWork({ name: "   ", status: "draft" })).toEqual({
      ok: false,
      error: "invalid-name",
    });
  });

  it("requires an active local account", () => {
    expect(createWork({ name: "作品", status: "draft" })).toEqual({
      ok: false,
      error: "no-active-user",
    });
  });

  it("updates status and last-saved time without changing creation time", () => {
    login("13800138000", "user-1");
    createWork(
      { name: "草稿", status: "draft" },
      {
        createId: () => "work-1",
        now: () => "2026-11-02T10:01:00.000Z",
      },
    );

    const result = updateWork(
      "work-1",
      { name: "已完成作品", status: "completed" },
      { now: () => "2026-11-02T10:05:00.000Z" },
    );

    expect(result).toEqual({
      ok: true,
      work: {
        id: "work-1",
        ownerId: "user-1",
        name: "已完成作品",
        status: "completed",
        createdAt: "2026-11-02T10:01:00.000Z",
        lastSavedAt: "2026-11-02T10:05:00.000Z",
        imageState: createDefaultWorkImageState(),
        binaryState: createDefaultWorkBinaryState(),
      },
    });
  });

  it("persists image processing state on an existing work", () => {
    login("13800138000", "user-1");
    createWork(
      { name: "图片作品", status: "draft" },
      { createId: () => "work-1" },
    );
    const imageState = {
      ...createDefaultWorkImageState(),
      sourceKind: "upload" as const,
      sourceDataUrl: "data:image/png;base64,AAAA",
      shape: "circle" as const,
      widthMm: 30,
      heightMm: 30,
      backgroundRules: [
        { id: "white", color: "#ffffff", tolerance: 35 },
      ],
      effectMode: "outline" as const,
    };

    const result = updateWork(
      "work-1",
      { name: "图片作品", status: "draft", imageState },
      { now: () => "2026-11-02T10:06:00.000Z" },
    );

    expect(result).toMatchObject({
      ok: true,
      work: {
        imageState,
        lastSavedAt: "2026-11-02T10:06:00.000Z",
      },
    });
  });

  it("persists binary editing state on an existing work", () => {
    login("13800138000", "user-1");
    createWork(
      { name: "黑白作品", status: "draft" },
      { createId: () => "work-1" },
    );
    const binaryState = {
      ...createDefaultWorkBinaryState(),
      overlayData: "AA==",
      overlayWidth: 2,
      overlayHeight: 2,
      generationSignature: "signature",
      brushSize: 12,
      eraserSize: 14,
      carvingMode: "yin" as const,
      orientation: "mirror" as const,
      borderStyle: "double" as const,
      borderThickness: 7,
    };

    const result = updateWork(
      "work-1",
      { name: "黑白作品", status: "draft", binaryState },
      { now: () => "2026-11-02T10:07:00.000Z" },
    );

    expect(result).toMatchObject({
      ok: true,
      work: {
        binaryState,
        lastSavedAt: "2026-11-02T10:07:00.000Z",
      },
    });
    expect(getActiveUserWork("work-1")?.binaryState).toEqual(binaryState);
  });

  it("hides works from another active local account", () => {
    login("13800138000", "user-1");
    createWork(
      { name: "账号一的草稿", status: "draft" },
      { createId: () => "work-1" },
    );

    signOut();
    login("13900139000", "user-2");

    expect(getActiveUserWork("work-1")).toBeNull();
    expect(listActiveUserWorks()).toEqual([]);
    expect(updateWork("work-1", { name: "不应更新", status: "draft" })).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it("returns only the active account's works", () => {
    login("13800138000", "user-1");
    createWork(
      { name: "账号一作品", status: "draft" },
      { createId: () => "work-1" },
    );
    login("13900139000", "user-2");
    createWork(
      { name: "账号二作品", status: "completed" },
      { createId: () => "work-2" },
    );

    expect(listActiveUserWorks().map((work) => work.name)).toEqual(["账号二作品"]);
  });

  it("filters active account works by status", () => {
    login("13800138000", "user-1");
    createWork(
      { name: "草稿一", status: "draft" },
      {
        createId: () => "work-1",
        now: () => "2026-11-02T10:01:00.000Z",
      },
    );
    createWork(
      { name: "已完成一", status: "completed" },
      {
        createId: () => "work-2",
        now: () => "2026-11-02T10:02:00.000Z",
      },
    );
    listActiveUserWorks();
    expect(listActiveUserWorksByStatus("all").map((work) => work.name)).toEqual([
      "已完成一",
      "草稿一",
    ]);
    expect(listActiveUserWorksByStatus("draft").map((work) => work.name)).toEqual([
      "草稿一",
    ]);
    expect(
      listActiveUserWorksByStatus("completed").map((work) => work.name),
    ).toEqual(["已完成一"]);
  });

  it("deletes selected active-account works in one write", () => {
    login("13800138000", "user-1");
    createWork(
      { name: "作品一", status: "completed" },
      { createId: () => "work-1" },
    );
    createWork(
      { name: "作品二", status: "draft" },
      { createId: () => "work-2" },
    );
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    expect(
      deleteActiveUserWorks(["work-1", "work-1", "missing"]),
    ).toEqual({ ok: true, deletedCount: 1 });
    expect(listActiveUserWorks().map((work) => work.name)).toEqual(["作品二"]);
    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it("does not delete works owned by another account", () => {
    login("13800138000", "user-1");
    createWork(
      { name: "账号一作品", status: "completed" },
      { createId: () => "work-1" },
    );
    signOut();
    login("13900139000", "user-2");

    expect(deleteActiveUserWorks(["work-1"])).toEqual({
      ok: true,
      deletedCount: 0,
    });
    signOut();
    login("13800138000", "user-1");
    expect(listActiveUserWorks().map((work) => work.name)).toEqual(["账号一作品"]);
  });

  it("returns a storage error when batch deletion cannot persist", () => {
    login("13800138000", "user-1");
    createWork(
      { name: "不可删除", status: "draft" },
      { createId: () => "work-1" },
    );
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

    expect(deleteActiveUserWorks(["work-1"])).toEqual({
      ok: false,
      error: "storage",
    });
    setItem.mockRestore();
    expect(listActiveUserWorks().map((work) => work.name)).toEqual(["不可删除"]);
  });
});
