import type { SealShape, WorkImageState } from "../../domain/types";

export interface SizeRecommendation {
  widthMm: number;
  heightMm: number;
  label: string;
}

export function recommendationsForShape(shape: SealShape): SizeRecommendation[] {
  if (shape === "rectangle") {
    return [
      { widthMm: 15, heightMm: 30, label: "15×30 mm" },
      { widthMm: 20, heightMm: 30, label: "20×30 mm" },
    ];
  }

  if (shape === "custom") {
    return [];
  }

  const sizes = [20, 25, 30];
  return sizes.map((size) => ({
    widthMm: size,
    heightMm: size,
    label: shape === "circle" ? `Ø${size} mm` : `${size} mm`,
  }));
}

export function isValidSealDimension(value: number): boolean {
  return Number.isFinite(value) && value >= 10 && value <= 100;
}

export function applyRecommendation(
  state: WorkImageState,
  widthMm: number,
  heightMm: number,
): WorkImageState {
  return { ...state, widthMm, heightMm };
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
