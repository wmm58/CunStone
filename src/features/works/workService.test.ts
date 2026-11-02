import { beforeEach, describe, expect, it } from "vitest";

import { FIXED_TEST_CODE, loginWithFixedCode, signOut } from "../auth/authService";
import {
  createWork,
  getActiveUserWork,
  listActiveUserWorks,
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
      },
    });
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
});
