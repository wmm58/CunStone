import type { SealShape, WorkImageState } from "../../domain/types";

export function isValidSealDimension(value: number): boolean {
  return Number.isFinite(value) && value >= 10 && value <= 100;
}

export function sanitizeDimensionInput(input: string): string {
  const numeric = input.replace(/[^\d.]/g, "");
  const firstDot = numeric.indexOf(".");
  if (firstDot === -1) {
    return numeric;
  }
  return (
    numeric.slice(0, firstDot + 1) +
    numeric.slice(firstDot + 1).replace(/\./g, "")
  );
}

export function selectShape(state: WorkImageState, shape: SealShape): WorkImageState {
  if (shape === "square" || shape === "circle") {
    const size =
      state.widthMm === state.heightMm && isValidSealDimension(state.widthMm)
        ? state.widthMm
        : 25;
    return { ...state, shape, widthMm: size, heightMm: size };
  }

  if (shape === "rectangle" && state.widthMm === state.heightMm) {
    return { ...state, shape, widthMm: 20, heightMm: 30 };
  }

  return { ...state, shape };
}
