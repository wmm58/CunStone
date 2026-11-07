import { useEffect, useMemo, useRef, useState } from "react";

import type {
  WorkBinaryEditState,
  WorkImageState,
} from "../../domain/types";
import { decodeOverlay, encodeOverlay } from "../../lib/binary/overlayCodec";
import BinaryEditorCanvas from "./BinaryEditorCanvas";
import BinaryEditorPanel from "./BinaryEditorPanel";
import DrawingCanvas from "./DrawingCanvas";
import EditorCanvas from "./EditorCanvas";
import ImagePreparationPanel from "./ImagePreparationPanel";
import {
  clearManualEdits,
  createEmptyOverlay,
  getNeutralOverlayValue,
  hasManualEdits,
  mapFinalPointToNeutral,
  paintStroke,
  recordStrokeHistory,
  redoOverlay,
  undoOverlay,
  type EditTool,
  type OverlayHistory,
  type PixelPoint,
} from "./binaryEditing";
import {
  createGenerationSignature,
  renderFinalBinary,
} from "./binaryRendering";
import { prepareSourceDataUrl, prepareSourceFile } from "./imageInput";
import {
  createCutoutImage,
  renderBinaryDraft,
  rgbToHex,
  type RgbaImage,
} from "./imageProcessing";

// 像素编解码、渲染和面板已拆分；本层只协调编辑会话，仍可在后续提取为独立 hook。
interface EditorWorkspaceProps {
  imageState: WorkImageState;
  binaryState: WorkBinaryEditState;
  onImageStateChange: (
    next: WorkImageState,
    resetManualEdits?: boolean,
  ) => void;
  onBinaryStateChange: (next: WorkBinaryEditState) => void;
}

type CanvasMode = "input" | "binary";

interface PendingImageChange {
  next: WorkImageState;
  fileName?: string;
}

const MIN_ZOOM = 50;
const MAX_ZOOM = 400;
const ZOOM_STEP = 25;

export default function EditorWorkspace({
  imageState,
  binaryState,
  onImageStateChange,
  onBinaryStateChange,
}: EditorWorkspaceProps) {
  const [sourceRaster, setSourceRaster] = useState<RgbaImage | null>(null);
  const [mode, setMode] = useState<CanvasMode>("input");
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [overlay, setOverlayState] = useState<Uint8Array | null>(null);
  const overlayRef = useRef<Uint8Array | null>(null);
  const [history, setHistory] = useState<OverlayHistory>({ undo: [], redo: [] });
  const [tool, setTool] = useState<EditTool>("brush");
  const [zoom, setZoom] = useState(100);
  const [pendingChange, setPendingChange] = useState<PendingImageChange | null>(
    null,
  );
  const [signatureWarning, setSignatureWarning] = useState("");
  const loadedOverlayKeyRef = useRef("");
  const strokeStartSnapshotRef = useRef<string | null>(null);
  const lastPointRef = useRef<PixelPoint | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!imageState.sourceDataUrl) {
      setSourceRaster(null);
      setMode("input");
      setBusy(false);
      setWorkingOverlay(null);
      setHistory({ undo: [], redo: [] });
      return;
    }

    setBusy(true);
    setError("");
    prepareSourceDataUrl(imageState.sourceDataUrl)
      .then((source) => {
        if (!cancelled) {
          setSourceRaster(source.raster);
          setBusy(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSourceRaster(null);
          setBusy(false);
          setError("图片无法读取，请重新上传或手绘");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageState.sourceDataUrl]);

  const cutout = useMemo(
    () =>
      sourceRaster
        ? createCutoutImage(
            sourceRaster,
            imageState.backgroundColor,
            imageState.tolerance,
          )
        : null,
    [imageState.backgroundColor, imageState.tolerance, sourceRaster],
  );

  const baseBinary = useMemo(
    () => (sourceRaster ? renderBinaryDraft(sourceRaster, imageState) : null),
    [imageState, sourceRaster],
  );

  const generationSignature = useMemo(
    () => createGenerationSignature(imageState),
    [imageState],
  );

  useEffect(() => {
    if (!baseBinary) {
      setWorkingOverlay(null);
      return;
    }

    const key = `${generationSignature}:${baseBinary.width}:${baseBinary.height}`;
    if (loadedOverlayKeyRef.current === key) {
      return;
    }
    loadedOverlayKeyRef.current = key;
    setHistory({ undo: [], redo: [] });
    setSignatureWarning("");

    if (!binaryState.overlayData) {
      setWorkingOverlay(createEmptyOverlay(baseBinary.width, baseBinary.height));
      return;
    }

    if (
      binaryState.generationSignature !== generationSignature ||
      binaryState.overlayWidth !== baseBinary.width ||
      binaryState.overlayHeight !== baseBinary.height
    ) {
      setWorkingOverlay(createEmptyOverlay(baseBinary.width, baseBinary.height));
      setSignatureWarning("基础稿已变化，请重新修整");
      return;
    }

    const decoded = decodeOverlay(
      binaryState.overlayData,
      baseBinary.width,
      baseBinary.height,
    );
    if (!decoded) {
      setWorkingOverlay(createEmptyOverlay(baseBinary.width, baseBinary.height));
      setSignatureWarning("修整数据损坏，请重新修整");
      return;
    }

    setWorkingOverlay(decoded);
  }, [
    baseBinary,
    binaryState.generationSignature,
    binaryState.overlayData,
    binaryState.overlayHeight,
    binaryState.overlayWidth,
    generationSignature,
  ]);

  const finalBinary = useMemo(
    () =>
      baseBinary && overlay
        ? renderFinalBinary(baseBinary, overlay, binaryState, imageState.shape)
        : null,
    [baseBinary, binaryState, imageState.shape, overlay],
  );

  const editsAvailable = Boolean(baseBinary && overlay);

  function setWorkingOverlay(next: Uint8Array | null) {
    overlayRef.current = next;
    setOverlayState(next);
  }

  function requestImageChange(next: WorkImageState, nextFileName?: string) {
    if (nextFileName === undefined && createGenerationSignature(next) === generationSignature) {
      return;
    }
    if (hasManualEdits(overlayRef.current)) {
      setPendingChange({ next, fileName: nextFileName });
      return;
    }
    onImageStateChange(next);
    if (nextFileName !== undefined) {
      setFileName(nextFileName);
    }
  }

  async function handleUploadFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const source = await prepareSourceFile(file);
      requestImageChange(
        {
          ...imageState,
          sourceKind: "upload",
          sourceDataUrl: source.dataUrl,
          backgroundColor: null,
        },
        file.name,
      );
    } catch (caught) {
      setError(fileErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleDrawingCommit(dataUrl: string) {
    setBusy(true);
    setError("");
    try {
      const source = await prepareSourceDataUrl(dataUrl);
      setDrawing(false);
      requestImageChange(
        {
          ...imageState,
          sourceKind: "drawing",
          sourceDataUrl: source.dataUrl,
          backgroundColor: null,
        },
        "",
      );
    } catch {
      setError("手绘稿无法读取，请重试");
    } finally {
      setBusy(false);
    }
  }

  function confirmReset() {
    if (!pendingChange) {
      return;
    }
    const change = pendingChange;
    setPendingChange(null);
    clearLocalEdits();
    if (change.fileName !== undefined) {
      setFileName(change.fileName);
    }
    if (change.next.sourceDataUrl !== imageState.sourceDataUrl) {
      setMode("input");
    }
    onBinaryStateChange(clearManualEdits(binaryState));
    onImageStateChange(change.next, true);
  }

  function clearLocalEdits() {
    setWorkingOverlay(null);
    setHistory({ undo: [], redo: [] });
    strokeStartSnapshotRef.current = null;
    lastPointRef.current = null;
    loadedOverlayKeyRef.current = "";
    setSignatureWarning("");
  }

  function handleBackgroundSample(x: number, y: number) {
    if (!sourceRaster) {
      return;
    }
    const offset = (y * sourceRaster.width + x) * 4;
    if (sourceRaster.data[offset + 3] === 0) {
      setError("这里没有可采样的颜色，请点击有颜色的背景区域");
      return;
    }
    setError("");
    requestImageChange({
      ...imageState,
      backgroundColor: rgbToHex({
        r: sourceRaster.data[offset],
        g: sourceRaster.data[offset + 1],
        b: sourceRaster.data[offset + 2],
      }),
    });
  }

  function handleStrokeStart(point: PixelPoint) {
    if (!baseBinary || !overlayRef.current) {
      return;
    }
    strokeStartSnapshotRef.current = encodeOverlay(
      overlayRef.current,
      baseBinary.width,
      baseBinary.height,
    );
    const neutral = mapFinalPointToNeutral(
      point,
      baseBinary.width,
      binaryState.orientation === "mirror",
    );
    lastPointRef.current = neutral;
    const next = paintStroke(
      overlayRef.current,
      baseBinary.width,
      baseBinary.height,
      neutral,
      neutral,
      binaryState.brushSize,
      getNeutralOverlayValue(tool, binaryState.carvingMode),
    );
    setWorkingOverlay(next);
  }

  function handleStrokeMove(point: PixelPoint) {
    if (!baseBinary || !overlayRef.current || !lastPointRef.current) {
      return;
    }
    const neutral = mapFinalPointToNeutral(
      point,
      baseBinary.width,
      binaryState.orientation === "mirror",
    );
    const next = paintStroke(
      overlayRef.current,
      baseBinary.width,
      baseBinary.height,
      lastPointRef.current,
      neutral,
      binaryState.brushSize,
      getNeutralOverlayValue(tool, binaryState.carvingMode),
    );
    lastPointRef.current = neutral;
    setWorkingOverlay(next);
  }

  function handleStrokeEnd() {
    const current = overlayRef.current;
    const before = strokeStartSnapshotRef.current;
    if (!baseBinary || !current || before === null) {
      return;
    }
    const after = encodeOverlay(current, baseBinary.width, baseBinary.height);
    setHistory((currentHistory) =>
      recordStrokeHistory(currentHistory, before),
    );
    persistOverlay(current, baseBinary);
    strokeStartSnapshotRef.current = null;
    lastPointRef.current = null;
    if (after === before) {
      setHistory((currentHistory) => ({
        undo: currentHistory.undo.slice(0, -1),
        redo: currentHistory.redo,
      }));
    }
  }

  function handleUndo() {
    if (!baseBinary || !overlayRef.current) {
      return;
    }
    const currentSnapshot = encodeOverlay(
      overlayRef.current,
      baseBinary.width,
      baseBinary.height,
    );
    const result = undoOverlay(history, currentSnapshot);
    if (!result) {
      return;
    }
    const decoded = decodeOverlay(result.snapshot, baseBinary.width, baseBinary.height);
    if (!decoded) {
      return;
    }
    setHistory(result.history);
    setWorkingOverlay(decoded);
    persistOverlay(decoded, baseBinary);
  }

  function handleRedo() {
    if (!baseBinary || !overlayRef.current) {
      return;
    }
    const currentSnapshot = encodeOverlay(
      overlayRef.current,
      baseBinary.width,
      baseBinary.height,
    );
    const result = redoOverlay(history, currentSnapshot);
    if (!result) {
      return;
    }
    const decoded = decodeOverlay(result.snapshot, baseBinary.width, baseBinary.height);
    if (!decoded) {
      return;
    }
    setHistory(result.history);
    setWorkingOverlay(decoded);
    persistOverlay(decoded, baseBinary);
  }

  function persistOverlay(next: Uint8Array, base: RgbaImage) {
    if (!hasManualEdits(next)) {
      onBinaryStateChange(clearManualEdits(binaryState));
      return;
    }
    onBinaryStateChange({
      ...binaryState,
      overlayData: encodeOverlay(next, base.width, base.height),
      overlayWidth: base.width,
      overlayHeight: base.height,
      generationSignature,
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3" aria-label="编辑工具">
        <ImagePreparationPanel
          busy={busy}
          fileName={fileName}
          imageState={imageState}
          onRequestChange={requestImageChange}
          onStartDrawing={() => {
            setDrawing(true);
            setMode("input");
          }}
          onUploadFile={handleUploadFile}
          sourceAvailable={Boolean(sourceRaster)}
        />
        <BinaryEditorPanel
          binaryState={binaryState}
          canRedo={history.redo.length > 0}
          canUndo={history.undo.length > 0}
          disabled={!editsAvailable}
          onChange={onBinaryStateChange}
          onRedo={handleRedo}
          onToolChange={setTool}
          onUndo={handleUndo}
          onZoomFit={() => setZoom(100)}
          onZoomIn={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
          onZoomOut={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
          tool={tool}
          zoom={zoom}
        />
        {error ? (
          <p
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {busy ? (
          <p className="text-xs text-slate-500" role="status">
            正在处理本地图片…
          </p>
        ) : null}
      </aside>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex gap-1">
            <button
              className={
                mode === "input" ? activeModeClass : inactiveModeClass
              }
              onClick={() => setMode("input")}
              type="button"
            >
              输入 / 去底
            </button>
            <button
              className={
                mode === "binary" ? activeModeClass : inactiveModeClass
              }
              disabled={!editsAvailable}
              onClick={() => setMode("binary")}
              type="button"
            >
              黑白稿编辑
            </button>
          </div>
          <span className="text-xs text-slate-500">
            {mode === "input"
              ? "点击背景区域指定要移除的颜色"
              : "涂抹修整后自动保存"}
          </span>
        </div>

        {signatureWarning ? (
          <p
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            role="alert"
          >
            {signatureWarning}
          </p>
        ) : null}

        {drawing ? (
          <DrawingCanvas
            onCancel={() => setDrawing(false)}
            onCommit={handleDrawingCommit}
          />
        ) : mode === "input" ? (
          <EditorCanvas
            cutout={cutout}
            onBackgroundSample={handleBackgroundSample}
          />
        ) : (
          <BinaryEditorCanvas
            disabled={!editsAvailable}
            onStrokeEnd={handleStrokeEnd}
            onStrokeMove={handleStrokeMove}
            onStrokeStart={handleStrokeStart}
            raster={finalBinary}
            tool={tool}
            zoom={zoom}
          />
        )}
      </div>

      {pendingChange ? (
        <div
          aria-label="重置手动修整确认"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <section className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-950">
              修改处理参数会清除手动修整
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              继续后会重新生成黑白基础稿，并清空当前画笔、橡皮结果和撤销重做历史。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setPendingChange(null)}
                type="button"
              >
                取消
              </button>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                onClick={confirmReset}
                type="button"
              >
                确认重置
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

const activeModeClass =
  "rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white";
const inactiveModeClass =
  "rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50";

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function fileErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "unsupported-type") {
      return "仅支持 PNG、JPEG 或 WebP";
    }
    if (error.message === "too-large") {
      return "图片不能超过 10 MB";
    }
  }
  return "图片无法读取，请重试";
}
