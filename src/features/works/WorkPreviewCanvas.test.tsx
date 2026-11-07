import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type WorkRecord,
} from "../../domain/types";
import { installCanvasMock } from "../../test/canvasMock";
import * as imageInput from "../editor/imageInput";
import WorkPreviewCanvas from "./WorkPreviewCanvas";

vi.mock("../editor/imageInput", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../editor/imageInput")>();
  return {
    ...actual,
    prepareSourceDataUrl: vi.fn(),
  };
});

const work: WorkRecord = {
  id: "work-1",
  ownerId: "user-1",
  name: "预览作品",
  status: "completed",
  createdAt: "2026-11-07T10:00:00.000Z",
  lastSavedAt: "2026-11-07T10:00:00.000Z",
  imageState: {
    ...createDefaultWorkImageState(),
    sourceKind: "upload",
    sourceDataUrl: "data:image/png;base64,cHJldmlldw==",
  },
  binaryState: createDefaultWorkBinaryState(),
};

describe("WorkPreviewCanvas", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    canvasMock = installCanvasMock();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue({
      width: 2,
      height: 2,
      dataUrl: work.imageState.sourceDataUrl!,
      raster: {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          0, 0, 0, 255,
          0, 0, 0, 255,
          0, 0, 0, 255,
          0, 0, 0, 255,
        ]),
      },
    });
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("renders a black-white canvas for saved work", async () => {
    render(<WorkPreviewCanvas variant="binary" work={work} />);

    expect(
      await screen.findByLabelText("预览作品 黑白印稿"),
    ).toBeVisible();
  });

  it("renders black pixels as clean red in the red preview", async () => {
    render(<WorkPreviewCanvas variant="red" work={work} />);
    await screen.findByLabelText("预览作品 红印预览");

    await waitFor(() => {
      const calls = vi.mocked(canvasMock!.context.putImageData).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const data = calls.at(-1)![0].data;
      let foundRed = false;
      for (let offset = 0; offset < data.length; offset += 4) {
        if (
          data[offset] === 198 &&
          data[offset + 1] === 40 &&
          data[offset + 2] === 40 &&
          data[offset + 3] === 255
        ) {
          foundRed = true;
          break;
        }
      }
      expect(foundRed).toBe(true);
    });
  });

  it("shows an empty state without a saved source", async () => {
    render(
      <WorkPreviewCanvas
        variant="binary"
        work={{
          ...work,
          imageState: createDefaultWorkImageState(),
        }}
      />,
    );

    expect(await screen.findByText("暂无印稿")).toBeVisible();
  });
});
