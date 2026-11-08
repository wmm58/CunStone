import {
  DEFAULT_BACKGROUND_TOLERANCE,
  type BackgroundRemovalRule,
} from "../../domain/types";

export function createBackgroundRemovalRule(): BackgroundRemovalRule {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `background-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    color: null,
    tolerance: DEFAULT_BACKGROUND_TOLERANCE,
  };
}
