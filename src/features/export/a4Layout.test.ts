import { describe, expect, it } from "vitest";

import {
  A4_PAGE,
  autoLayoutWorks,
  clampWorkPosition,
  getPageCount,
  normalizeRotation,
} from "./a4Layout";

const square30 = { id: "a", widthMm: 30, heightMm: 30 };

describe("a4Layout", () => {
  it("defines a portrait A4 page", () => {
    expect(A4_PAGE).toMatchObject({
      widthMm: 210,
      heightMm: 297,
      marginMm: 12,
    });
  });

  it("lays works left to right and wraps within A4 margins", () => {
    const works = [
      { id: "a", widthMm: 60, heightMm: 40 },
      { id: "b", widthMm: 60, heightMm: 40 },
      { id: "c", widthMm: 60, heightMm: 40 },
    ];
    const layout = autoLayoutWorks(works, {
      horizontalGapMm: 5,
      verticalGapMm: 6,
    });

    expect(layout).toMatchObject([
      { id: "a", pageIndex: 0, xMm: 12, yMm: 12 },
      { id: "b", pageIndex: 0, xMm: 77, yMm: 12 },
      { id: "c", pageIndex: 0, xMm: 12, yMm: 58 },
    ]);
  });

  it("adds pages when vertical space is insufficient", () => {
    const works = Array.from({ length: 10 }, (_, index) => ({
      id: `work-${index}`,
      widthMm: 60,
      heightMm: 80,
    }));
    const layout = autoLayoutWorks(works, {
      horizontalGapMm: 5,
      verticalGapMm: 5,
    });

    expect(getPageCount(layout)).toBe(2);
    expect(layout.find((item) => item.id === "work-6")?.pageIndex).toBe(1);
  });

  it("changes positions when spacing changes", () => {
    const works = [
      { id: "a", widthMm: 30, heightMm: 30 },
      { id: "b", widthMm: 30, heightMm: 30 },
    ];
    const tight = autoLayoutWorks(works, {
      horizontalGapMm: 1,
      verticalGapMm: 1,
    });
    const loose = autoLayoutWorks(works, {
      horizontalGapMm: 10,
      verticalGapMm: 10,
    });

    expect(loose[1].xMm).toBeGreaterThan(tight[1].xMm);
  });

  it("clamps positions inside the page and normalizes rotations", () => {
    expect(clampWorkPosition(square30, -5, 999)).toEqual({
      xMm: 0,
      yMm: 267,
    });
    expect(normalizeRotation(46)).toBe(90);
    expect(normalizeRotation(181)).toBe(180);
    expect(normalizeRotation(270)).toBe(270);
    expect(normalizeRotation(360)).toBe(0);
  });
});
