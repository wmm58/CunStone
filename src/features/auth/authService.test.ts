import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAppState, readAppState, writeAppState } from "../../lib/storage/appStorage";
import {
  FIXED_TEST_CODE,
  getActiveUser,
  loginWithFixedCode,
  normalizePhone,
  signOut,
} from "./authService";

describe("authService", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes spaces and mainland China country code", () => {
    expect(normalizePhone("+86 138-0013-8000")).toBe("13800138000");
  });

  it("rejects an invalid phone number", () => {
    expect(
      loginWithFixedCode({ phone: "123", code: FIXED_TEST_CODE }),
    ).toEqual({ ok: false, error: "invalid-phone" });
  });

  it("rejects an incorrect verification code", () => {
    expect(
      loginWithFixedCode({ phone: "13800138000", code: "000000" }),
    ).toEqual({ ok: false, error: "invalid-code" });
  });

  it("creates a local account on first login and reuses it later", () => {
    const createId = () => "user-1";
    const now = () => "2026-11-02T10:00:00.000Z";

    const first = loginWithFixedCode(
      { phone: "13800138000", code: FIXED_TEST_CODE },
      { createId, now },
    );
    const second = loginWithFixedCode(
      { phone: "138 0013 8000", code: FIXED_TEST_CODE },
      { createId: () => "unused", now },
    );

    expect(first).toMatchObject({ ok: true, user: { id: "user-1" } });
    expect(second).toMatchObject({ ok: true, user: { id: "user-1" } });
    expect(readAppState().state.users).toHaveLength(1);
    expect(getActiveUser()).toMatchObject({ id: "user-1", phone: "13800138000" });
  });

  it("clears only the active account when signing out", () => {
    loginWithFixedCode(
      { phone: "13800138000", code: FIXED_TEST_CODE },
      { createId: () => "user-1" },
    );

    signOut();

    expect(getActiveUser()).toBeNull();
    expect(readAppState().state.users).toHaveLength(1);
  });

  it("returns no active user when stored data has no active account", () => {
    writeAppState(createEmptyAppState());

    expect(getActiveUser()).toBeNull();
  });
});
