import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type WorkBinaryEditState,
  type WorkImageState,
  type WorkRecord,
  type WorkStatus,
} from "../../domain/types";
import { getActiveUser } from "../auth/authService";
import { readAppState, writeAppState } from "../../lib/storage/appStorage";

type WorkError = "no-active-user" | "invalid-name" | "not-found";

interface WorkOptions {
  createId?: () => string;
  now?: () => string;
  storage?: Storage;
}

export interface WorkInput {
  name: string;
  status: WorkStatus;
  imageState?: WorkImageState;
  binaryState?: WorkBinaryEditState;
}

export type WorkResult =
  | { ok: true; work: WorkRecord }
  | { ok: false; error: WorkError };

export function createWork(input: WorkInput, options: WorkOptions = {}): WorkResult {
  const storage = options.storage ?? window.localStorage;
  const activeUser = getActiveUser({ storage });

  if (!activeUser) {
    return { ok: false, error: "no-active-user" };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "invalid-name" };
  }

  const timestamp = (options.now ?? now)();
  const work: WorkRecord = {
    id: (options.createId ?? createId)(),
    ownerId: activeUser.id,
    name,
    status: input.status,
    createdAt: timestamp,
    lastSavedAt: timestamp,
    imageState: input.imageState ?? createDefaultWorkImageState(),
    binaryState: input.binaryState ?? createDefaultWorkBinaryState(),
  };
  const state = readAppState(storage).state;
  state.works = [...state.works, work];
  writeAppState(state, storage);

  return { ok: true, work };
}

export function updateWork(
  workId: string,
  input: WorkInput,
  options: WorkOptions = {},
): WorkResult {
  const storage = options.storage ?? window.localStorage;
  const activeUser = getActiveUser({ storage });

  if (!activeUser) {
    return { ok: false, error: "no-active-user" };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "invalid-name" };
  }

  const state = readAppState(storage).state;
  const index = state.works.findIndex(
    (work) => work.id === workId && work.ownerId === activeUser.id,
  );

  if (index === -1) {
    return { ok: false, error: "not-found" };
  }

  const work: WorkRecord = {
    ...state.works[index],
    name,
    status: input.status,
    imageState: input.imageState ?? state.works[index].imageState,
    binaryState: input.binaryState ?? state.works[index].binaryState,
    lastSavedAt: (options.now ?? now)(),
  };
  state.works = state.works.map((candidate, candidateIndex) =>
    candidateIndex === index ? work : candidate,
  );
  writeAppState(state, storage);

  return { ok: true, work };
}

export function getActiveUserWork(
  workId: string,
  options: Pick<WorkOptions, "storage"> = {},
): WorkRecord | null {
  const storage = options.storage ?? window.localStorage;
  const activeUser = getActiveUser({ storage });
  if (!activeUser) {
    return null;
  }

  return (
    readAppState(storage).state.works.find(
      (work) => work.id === workId && work.ownerId === activeUser.id,
    ) ?? null
  );
}

export function listActiveUserWorks(
  options: Pick<WorkOptions, "storage"> = {},
): WorkRecord[] {
  const storage = options.storage ?? window.localStorage;
  const activeUser = getActiveUser({ storage });
  if (!activeUser) {
    return [];
  }

  return readAppState(storage)
    .state.works.filter((work) => work.ownerId === activeUser.id)
    .sort((left, right) => right.lastSavedAt.localeCompare(left.lastSavedAt));
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `work-${Date.now()}`;
}

function now(): string {
  return new Date().toISOString();
}
