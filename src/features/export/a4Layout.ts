export const A4_PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 12,
  minGapMm: 0,
  maxGapMm: 30,
} as const;

export interface LayoutWorkInput {
  id: string;
  widthMm: number;
  heightMm: number;
}

export interface PlacedWork extends LayoutWorkInput {
  pageIndex: number;
  xMm: number;
  yMm: number;
  rotationDeg: number;
}

export interface LayoutSpacing {
  horizontalGapMm: number;
  verticalGapMm: number;
}

export function autoLayoutWorks(
  works: readonly LayoutWorkInput[],
  spacing: LayoutSpacing,
): PlacedWork[] {
  const left = A4_PAGE.marginMm;
  const top = A4_PAGE.marginMm;
  const right = A4_PAGE.widthMm - A4_PAGE.marginMm;
  const bottom = A4_PAGE.heightMm - A4_PAGE.marginMm;
  const horizontalGap = clampGap(spacing.horizontalGapMm);
  const verticalGap = clampGap(spacing.verticalGapMm);
  let pageIndex = 0;
  let x = left;
  let y = top;
  let rowHeight = 0;

  return works.map((work) => {
    if (x > left && x + work.widthMm > right) {
      x = left;
      y += rowHeight + verticalGap;
      rowHeight = 0;
    }
    if (y + work.heightMm > bottom) {
      pageIndex += 1;
      x = left;
      y = top;
      rowHeight = 0;
    }

    const placed: PlacedWork = {
      ...work,
      pageIndex,
      xMm: x,
      yMm: y,
      rotationDeg: 0,
    };
    x += work.widthMm + horizontalGap;
    rowHeight = Math.max(rowHeight, work.heightMm);
    return placed;
  });
}

export function getPageCount(items: readonly PlacedWork[]): number {
  return Math.max(1, ...items.map((item) => item.pageIndex + 1));
}

export function clampWorkPosition(
  work: Pick<LayoutWorkInput, "widthMm" | "heightMm">,
  xMm: number,
  yMm: number,
): { xMm: number; yMm: number } {
  return {
    xMm: clamp(xMm, 0, A4_PAGE.widthMm - work.widthMm),
    yMm: clamp(yMm, 0, A4_PAGE.heightMm - work.heightMm),
  };
}

export function normalizeRotation(rotationDeg: number): number {
  const normalized = Math.round(rotationDeg / 90) * 90;
  return ((normalized % 360) + 360) % 360;
}

export function clampGap(value: number): number {
  return clamp(value, A4_PAGE.minGapMm, A4_PAGE.maxGapMm);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
