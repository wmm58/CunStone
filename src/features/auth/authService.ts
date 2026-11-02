import type { LocalUser } from "../../domain/types";
import { readAppState, writeAppState } from "../../lib/storage/appStorage";

export const FIXED_TEST_CODE = (
  import.meta.env.VITE_TEST_VERIFICATION_CODE ?? "123456"
).trim();

type AuthError = "invalid-phone" | "invalid-code";

interface LoginOptions {
  createId?: () => string;
  now?: () => string;
  storage?: Storage;
}

export type LoginResult =
  | { ok: true; user: LocalUser }
  | { ok: false; error: AuthError };

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length === 13 && digits.startsWith("86") ? digits.slice(2) : digits;
}

export function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export function loginWithFixedCode(
  input: { phone: string; code: string },
  options: LoginOptions = {},
): LoginResult {
  const phone = normalizePhone(input.phone);

  if (!isValidPhone(phone)) {
    return { ok: false, error: "invalid-phone" };
  }

  if (input.code.trim() !== FIXED_TEST_CODE) {
    return { ok: false, error: "invalid-code" };
  }

  const storage = options.storage ?? window.localStorage;
  const state = readAppState(storage).state;
  let user = state.users.find((candidate) => candidate.phone === phone);

  if (!user) {
    user = {
      id: (options.createId ?? createId)(),
      phone,
      createdAt: (options.now ?? now)(),
    };
    state.users = [...state.users, user];
  }

  state.activeUserId = user.id;
  writeAppState(state, storage);

  return { ok: true, user };
}

export function getActiveUser(
  options: Pick<LoginOptions, "storage"> = {},
): LocalUser | null {
  const state = readAppState(options.storage ?? window.localStorage).state;
  return state.users.find((user) => user.id === state.activeUserId) ?? null;
}

export function signOut(options: Pick<LoginOptions, "storage"> = {}): void {
  const storage = options.storage ?? window.localStorage;
  const state = readAppState(storage).state;
  state.activeUserId = null;
  writeAppState(state, storage);
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `user-${Date.now()}`;
}

function now(): string {
  return new Date().toISOString();
}
