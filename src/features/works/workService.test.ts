import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
} from "../../domain/types";
import {
  createWork,
  deleteWorks,
  getWork,
  listWorks,
  listWorksByStatus,
  updateWork,
} from "./workService";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("workService", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates a draft work without an account", () => {
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
    expect(createWork({ name: "   ", status: "draft" })).toEqual({
      ok: false,
      error: "invalid-name",
    });
  });

  it("updates status and last-saved time without changing creation time", () => {
    createWork(
      { name: "草稿", status: "draft" },
      {
        createId: () => "work-1",
        now: () => "2026-11-02T10:01:00.000Z",
      },
    );

    expect(
      updateWork(
        "work-1",
        { name: "已完成作品", status: "completed" },
        { now: () => "2026-11-02T10:05:00.000Z" },
      ),
    ).toMatchObject({
      ok: true,
      work: {
        name: "已完成作品",
        status: "completed",
        createdAt: "2026-11-02T10:01:00.000Z",
        lastSavedAt: "2026-11-02T10:05:00.000Z",
      },
    });
  });

  it("persists image and binary states", () => {
    createWork(
      { name: "状态作品", status: "draft" },
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
    };
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

    expect(
      updateWork("work-1", {
        name: "状态作品",
        status: "draft",
        imageState,
        binaryState,
      }),
    ).toMatchObject({ ok: true, work: { imageState, binaryState } });
    expect(getWork("work-1")?.binaryState).toEqual(binaryState);
  });

  it("lists and filters every local work by saved time", () => {
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

    expect(listWorks().map((work) => work.name)).toEqual(["已完成一", "草稿一"]);
    expect(listWorksByStatus("draft").map((work) => work.name)).toEqual([
      "草稿一",
    ]);
    expect(listWorksByStatus("completed").map((work) => work.name)).toEqual([
      "已完成一",
    ]);
  });

  it("gets by id and returns null for a missing id", () => {
    createWork(
      { name: "作品一", status: "draft" },
      { createId: () => "work-1" },
    );

    expect(getWork("work-1")?.name).toBe("作品一");
    expect(getWork("missing")).toBeNull();
  });

  it("deletes selected works in one write and ignores unknown ids", () => {
    createWork(
      { name: "作品一", status: "completed" },
      { createId: () => "work-1" },
    );
    createWork(
      { name: "作品二", status: "draft" },
      { createId: () => "work-2" },
    );
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    expect(deleteWorks(["work-1", "work-1", "missing"])).toEqual({
      ok: true,
      deletedCount: 1,
    });
    expect(listWorks().map((work) => work.name)).toEqual(["作品二"]);
    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it("keeps independent browser storages isolated", () => {
    const browserA = new MemoryStorage();
    const browserB = new MemoryStorage();
    createWork(
      { name: "浏览器 A 作品", status: "draft" },
      { createId: () => "work-a", storage: browserA },
    );
    createWork(
      { name: "浏览器 B 作品", status: "draft" },
      { createId: () => "work-b", storage: browserB },
    );

    expect(listWorks({ storage: browserA }).map((work) => work.name)).toEqual([
      "浏览器 A 作品",
    ]);
    expect(listWorks({ storage: browserB }).map((work) => work.name)).toEqual([
      "浏览器 B 作品",
    ]);
  });
});
