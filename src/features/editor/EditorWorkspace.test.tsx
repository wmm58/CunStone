import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type WorkBinaryEditState,
  type WorkImageState,
} from "../../domain/types";
import { encodeOverlay } from "../../lib/binary/overlayCodec";
import { installCanvasMock } from "../../test/canvasMock";
import { createGenerationSignature } from "./binaryRendering";
import EditorWorkspace from "./EditorWorkspace";
import * as imageInput from "./imageInput";

vi.mock("./imageInput", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./imageInput")>();
  return {
    ...actual,
    prepareSourceFile: vi.fn(),
    prepareSourceDataUrl: vi.fn(),
  };
});

const prepared = {
  width: 2,
  height: 2,
  dataUrl: "data:image/png;base64,c2FtcGxl",
  raster: {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]),
  },
};

function Harness({
  initialImage = createDefaultWorkImageState(),
  initialBinary = createDefaultWorkBinaryState(),
}: {
  initialImage?: WorkImageState;
  initialBinary?: WorkBinaryEditState;
}) {
  const [imageState, setImageState] = useState(initialImage);
  const [binaryState, setBinaryState] = useState(initialBinary);

  return (
    <>
      <output data-testid="image-state">{JSON.stringify(imageState)}</output>
      <output data-testid="binary-state">{JSON.stringify(binaryState)}</output>
      <EditorWorkspace
        binaryState={binaryState}
        imageState={imageState}
        onBinaryStateChange={setBinaryState}
        onImageStateChange={(next) => setImageState(next)}
      />
    </>
  );
}

function readImageState(): WorkImageState {
  return JSON.parse(screen.getByTestId("image-state").textContent ?? "{}");
}

function readBinaryState(): WorkBinaryEditState {
  return JSON.parse(screen.getByTestId("binary-state").textContent ?? "{}");
}

describe("EditorWorkspace", () => {
  let canvasMock: ReturnType<typeof installCanvasMock> | null = null;

  beforeEach(() => {
    canvasMock = installCanvasMock();
    vi.mocked(imageInput.prepareSourceDataUrl).mockReset();
    vi.mocked(imageInput.prepareSourceDataUrl).mockResolvedValue(prepared);
    vi.mocked(imageInput.prepareSourceFile).mockReset();
    vi.mocked(imageInput.prepareSourceFile).mockResolvedValue(prepared);
  });

  afterEach(() => {
    canvasMock?.restore();
    canvasMock = null;
    vi.restoreAllMocks();
  });

  it("keeps 01-04 and exposes 05-06 with a saved source", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialImage={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
        }}
      />,
    );

    const editButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(editButton).toBeEnabled());
    await user.click(editButton);
    expect(await screen.findByLabelText("黑白稿编辑画布")).toBeVisible();
    expect(screen.getByRole("heading", { name: "01 外形与实际尺寸" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "05 黑白稿编辑" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "阴刻" }));
    expect(readBinaryState()).toMatchObject({ carvingMode: "yin" });
  });

  it("draws, undoes, redoes and persists a packed overlay", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialImage={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
        }}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "黑白稿编辑" }));
    const canvas = await screen.findByLabelText("黑白稿编辑画布");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 512,
      height: 512,
      right: 512,
      bottom: 512,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 100, pointerId: 1 });
    expect(readBinaryState().overlayData).toBeNull();
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 100, pointerId: 1 });

    await waitFor(() => expect(readBinaryState().overlayData).not.toBeNull());
    expect(readBinaryState()).toMatchObject({
      overlayWidth: 512,
      overlayHeight: 512,
      generationSignature: createGenerationSignature(readImageState()),
    });

    await user.click(screen.getByRole("button", { name: "撤销" }));
    expect(readBinaryState().overlayData).toBeNull();
    await user.click(screen.getByRole("button", { name: "重做" }));
    expect(readBinaryState().overlayData).not.toBeNull();
  });

  it("asks before resetting manual edits when 01-04 changes", async () => {
    const user = userEvent.setup();
    const imageState = {
      ...createDefaultWorkImageState(),
      sourceKind: "upload" as const,
      sourceDataUrl: prepared.dataUrl,
    };
    const emptyOverlay = new Uint8Array(512 * 512);
    emptyOverlay[512 * 256 + 256] = 1;
    const binaryState = {
      ...createDefaultWorkBinaryState(),
      overlayData: encodeOverlay(emptyOverlay, 512, 512),
      overlayWidth: 512,
      overlayHeight: 512,
      generationSignature: createGenerationSignature(imageState),
    };
    render(<Harness initialBinary={binaryState} initialImage={imageState} />);

    await user.click(await screen.findByRole("button", { name: "黑白稿编辑" }));
    await screen.findByLabelText("黑白稿编辑画布");
    await user.click(screen.getByRole("button", { name: "圆形" }));

    expect(screen.getByRole("dialog", { name: "重置手动修整确认" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(readImageState().shape).toBe("square");
    expect(readBinaryState().overlayData).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "圆形" }));
    await user.click(screen.getByRole("button", { name: "确认重置" }));
    expect(readImageState().shape).toBe("circle");
    expect(readBinaryState().overlayData).toBeNull();
  });

  it("does not ask for confirmation when there are no manual edits", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialImage={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
        }}
      />,
    );

    const editButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(editButton).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "圆形" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(readImageState().shape).toBe("circle");
  });

  it("warns when saved overlay signature no longer matches the base draft", async () => {
    const user = userEvent.setup();
    const imageState = {
      ...createDefaultWorkImageState(),
      sourceKind: "upload" as const,
      sourceDataUrl: prepared.dataUrl,
    };
    const binaryState = {
      ...createDefaultWorkBinaryState(),
      overlayData: encodeOverlay(new Uint8Array(512 * 512), 512, 512),
      overlayWidth: 512,
      overlayHeight: 512,
      generationSignature: "stale-signature",
    };
    render(<Harness initialBinary={binaryState} initialImage={imageState} />);

    const editButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(editButton).toBeEnabled());
    await user.click(editButton);

    expect(
      await screen.findByText("基础稿已变化，请重新修整"),
    ).toBeVisible();
  });

  it("warns and opens a clean base draft when overlay data is corrupted", async () => {
    const user = userEvent.setup();
    const imageState = {
      ...createDefaultWorkImageState(),
      sourceKind: "upload" as const,
      sourceDataUrl: prepared.dataUrl,
    };
    const binaryState = {
      ...createDefaultWorkBinaryState(),
      overlayData: "AA==",
      overlayWidth: 512,
      overlayHeight: 512,
      generationSignature: createGenerationSignature(imageState),
    };
    render(<Harness initialBinary={binaryState} initialImage={imageState} />);

    const editButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(editButton).toBeEnabled());
    await user.click(editButton);

    expect(await screen.findByText("修整数据损坏，请重新修整")).toBeVisible();
    expect(screen.getByLabelText("黑白稿编辑画布")).toBeVisible();
  });

  it("changes zoom without mutating persisted binary state", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialImage={{
          ...createDefaultWorkImageState(),
          sourceKind: "upload",
          sourceDataUrl: prepared.dataUrl,
        }}
      />,
    );

    const editButton = screen.getByRole("button", { name: "黑白稿编辑" });
    await waitFor(() => expect(editButton).toBeEnabled());
    await user.click(editButton);
    const before = JSON.stringify(readBinaryState());

    await user.click(screen.getByRole("button", { name: "缩小" }));
    await user.click(screen.getByRole("button", { name: "缩小" }));
    expect(screen.getByText("当前缩放 50%")).toBeVisible();
    for (let index = 0; index < 6; index += 1) {
      await user.click(screen.getByRole("button", { name: "放大" }));
    }
    expect(screen.getByText("当前缩放 200%")).toBeVisible();
    for (let index = 0; index < 8; index += 1) {
      await user.click(screen.getByRole("button", { name: "放大" }));
    }
    expect(screen.getByText("当前缩放 400%")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "适应视图" }));

    expect(JSON.stringify(readBinaryState())).toBe(before);
    expect(screen.getByText("当前缩放 100%")).toBeVisible();
  });
});
