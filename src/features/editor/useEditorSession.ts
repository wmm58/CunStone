import { useEffect, useMemo, useRef, useState } from "react";

import {
  MAX_BACKGROUND_RULES,
  type BackgroundRemovalRule,
  type WorkBinaryEditState,
  type WorkImageState,
} from "../../domain/types";
import { decodeOverlay, encodeOverlay } from "../../lib/binary/overlayCodec";
import { createBackgroundRemovalRule } from "./backgroundRules";
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
import { createGenerationSignature, renderFinalBinary } from "./binaryRendering";
import { prepareSourceDataUrl, prepareSourceFile } from "./imageInput";
import {
  createCutoutImage,
  renderBinaryDraft,
  rgbToHex,
  type RgbaImage,
} from "./imageProcessing";
import { rasterToPngDataUrl } from "./imageEditOperations";
import { hasPrintableBlackContent } from "./printableContent";

export type CanvasMode = "input" | "binary";

interface PendingImageChange {
  next: WorkImageState;
  fileName?: string;
  raster?: RgbaImage;
}

interface UseEditorSessionOptions {
  binaryState: WorkBinaryEditState;
  clearRequestId: number;
  imageState: WorkImageState;
  onBinaryStateChange: (next: WorkBinaryEditState) => void;
  onContentAvailabilityChange?: (available: boolean) => void;
  onImageStateChange: (
    next: WorkImageState,
    resetManualEdits?: boolean,
    autosaveMode?: "defer" | "resume",
  ) => void;
}

const MIN_ZOOM = 50;
const MAX_ZOOM = 400;
const ZOOM_STEP = 25;

export function useEditorSession({
  binaryState,
  clearRequestId,
  imageState,
  onBinaryStateChange,
  onContentAvailabilityChange,
  onImageStateChange,
}: UseEditorSessionOptions) {
  const [sourceRaster, setSourceRaster] = useState<RgbaImage | null>(null);
  const localRasterRef = useRef<RgbaImage | null>(null);
  const selfGeneratedSourceRef = useRef<string | null>(null);
  const imageStateRef = useRef(imageState);
  const [mode, setMode] = useState<CanvasMode>("input");
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
  const [activeRuleId, setActiveRuleId] = useState<string | null>(
    imageState.backgroundRules[0]?.id ?? null,
  );
  const loadedOverlayKeyRef = useRef("");
  const strokeStartSnapshotRef = useRef<string | null>(null);
  const lastPointRef = useRef<PixelPoint | null>(null);

  imageStateRef.current = imageState;

  useEffect(() => {
    let cancelled = false;
    if (!imageState.sourceDataUrl) {
      setSourceRaster(null);
      setMode("input");
      setBusy(false);
      setFileName("");
      setWorkingOverlay(null);
      setHistory({ undo: [], redo: [] });
      return;
    }

    if (
      selfGeneratedSourceRef.current === imageState.sourceDataUrl &&
      localRasterRef.current
    ) {
      setSourceRaster(localRasterRef.current);
      setBusy(false);
      return;
    }

    selfGeneratedSourceRef.current = null;
    setSourceRaster(null);
    setBusy(true);
    setError("");
    prepareSourceDataUrl(imageState.sourceDataUrl)
      .then((source) => {
        if (!cancelled) {
          localRasterRef.current = source.raster;
          setSourceRaster(source.raster);
          setBusy(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSourceRaster(null);
          setBusy(false);
          setError("图片无法读取，请重新上传");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageState.sourceDataUrl]);

  useEffect(() => {
    if (clearRequestId === 0) {
      return;
    }
    clearLocalEdits();
    setFileName("");
    setMode("input");
    setError("");
    setPendingChange(null);
    setActiveRuleId(null);
  }, [clearRequestId]);

  useEffect(() => {
    if (
      activeRuleId &&
      imageState.backgroundRules.some((rule) => rule.id === activeRuleId)
    ) {
      return;
    }
    setActiveRuleId(imageState.backgroundRules[0]?.id ?? null);
  }, [activeRuleId, imageState.backgroundRules]);

  const cutout = useMemo(
    () =>
      sourceRaster
        ? createCutoutImage(sourceRaster, imageState.backgroundRules)
        : null,
    [imageState.backgroundRules, sourceRaster],
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
        ? renderFinalBinary(
            baseBinary,
            overlay,
            binaryState,
            imageState.shape,
            imageState.widthMm,
            imageState.heightMm,
          )
        : null,
    [
      baseBinary,
      binaryState,
      imageState.heightMm,
      imageState.shape,
      imageState.widthMm,
      overlay,
    ],
  );

  const contentAvailable = useMemo(
    () =>
      hasPrintableBlackContent(imageState.sourceDataUrl, baseBinary, overlay),
    [baseBinary, imageState.sourceDataUrl, overlay],
  );

  useEffect(() => {
    onContentAvailabilityChange?.(contentAvailable);
  }, [contentAvailable, onContentAvailabilityChange]);

  const editsAvailable = Boolean(baseBinary && overlay);

  function setWorkingOverlay(next: Uint8Array | null) {
    overlayRef.current = next;
    setOverlayState(next);
  }

  function requestImageChange(next: WorkImageState, nextFileName?: string) {
    const signatureChanged =
      createGenerationSignature(next) !== generationSignature;
    if (!signatureChanged) {
      onImageStateChange(next);
      if (nextFileName !== undefined) {
        setFileName(nextFileName);
      }
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

  function commitRasterEdit(raster: RgbaImage) {
    let dataUrl: string;
    try {
      dataUrl = rasterToPngDataUrl(raster);
    } catch {
      setError("图片编辑结果保存失败，请重试");
      return;
    }
    const next: WorkImageState = {
      ...imageStateRef.current,
      sourceKind: "upload",
      sourceDataUrl: dataUrl,
    };
    if (hasManualEdits(overlayRef.current)) {
      setPendingChange({ next, raster });
      return;
    }
    applyRasterSource(raster, dataUrl);
    onBinaryStateChange(clearManualEdits(binaryState));
    onImageStateChange(next, true, "defer");
  }

  function setImageEraserSize(size: number) {
    requestImageChange({
      ...imageState,
      imageEraserSize: Math.min(80, Math.max(1, Math.round(size))),
    });
  }

  async function handleUploadFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const source = await prepareSourceFile(file);
      clearLocalEdits();
      const next: WorkImageState = {
        ...imageState,
        sourceKind: "upload",
        sourceDataUrl: source.dataUrl,
        backgroundRules: [],
        effectMode: "silhouette",
        outlineThickness: 1,
      };
      setFileName(file.name);
      setMode("input");
      selfGeneratedSourceRef.current = null;
      onBinaryStateChange(clearManualEdits(binaryState));
      onImageStateChange(next, true, "resume");
    } catch (caught) {
      setError(fileErrorMessage(caught));
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
    if (change.raster && change.next.sourceDataUrl) {
      applyRasterSource(change.raster, change.next.sourceDataUrl);
    }
    clearLocalEdits();
    onBinaryStateChange(clearManualEdits(binaryState));
    onImageStateChange(
      change.next,
      true,
      change.next.sourceDataUrl !== imageState.sourceDataUrl ? "defer" : undefined,
    );
    if (change.fileName !== undefined) {
      setFileName(change.fileName);
    }
    if (change.next.sourceDataUrl !== imageState.sourceDataUrl) {
      setMode("input");
    }
  }

  function clearLocalEdits() {
    setWorkingOverlay(null);
    setHistory({ undo: [], redo: [] });
    strokeStartSnapshotRef.current = null;
    lastPointRef.current = null;
    loadedOverlayKeyRef.current = "";
    setSignatureWarning("");
  }

  function applyRasterSource(raster: RgbaImage, dataUrl: string) {
    localRasterRef.current = raster;
    selfGeneratedSourceRef.current = dataUrl;
    setSourceRaster(raster);
    setBusy(false);
  }

  function addBackgroundRule() {
    if (imageState.backgroundRules.length >= MAX_BACKGROUND_RULES) {
      return;
    }
    const rule = createBackgroundRemovalRule();
    setActiveRuleId(rule.id);
    requestImageChange({
      ...imageState,
      backgroundRules: [...imageState.backgroundRules, rule],
    });
  }

  function removeBackgroundRule(id: string) {
    const nextRules = imageState.backgroundRules.filter((rule) => rule.id !== id);
    if (activeRuleId === id) {
      setActiveRuleId(nextRules[0]?.id ?? null);
    }
    requestImageChange({ ...imageState, backgroundRules: nextRules });
  }

  function updateBackgroundTolerance(id: string, tolerance: number) {
    requestImageChange({
      ...imageState,
      backgroundRules: imageState.backgroundRules.map((rule) =>
        rule.id === id ? { ...rule, tolerance } : rule,
      ),
    });
  }

  function handleBackgroundSample(x: number, y: number) {
    if (!sourceRaster) {
      return;
    }
    if (!activeRuleId) {
      setError("请先添加并选择一条背景颜色规则");
      return;
    }
    const offset = (y * sourceRaster.width + x) * 4;
    if (sourceRaster.data[offset + 3] === 0) {
      setError("这里没有可采样的颜色，请点击有颜色的背景区域");
      return;
    }
    setError("");
    const color = rgbToHex({
      r: sourceRaster.data[offset],
      g: sourceRaster.data[offset + 1],
      b: sourceRaster.data[offset + 2],
    });
    requestImageChange({
      ...imageState,
      backgroundRules: imageState.backgroundRules.map((rule) =>
        rule.id === activeRuleId ? { ...rule, color } : rule,
      ),
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
    const strokeSize =
      tool === "brush" ? binaryState.brushSize : binaryState.eraserSize;
    setWorkingOverlay(
      paintStroke(
        overlayRef.current,
        baseBinary.width,
        baseBinary.height,
        neutral,
        neutral,
        strokeSize,
        getNeutralOverlayValue(tool, binaryState.carvingMode),
      ),
    );
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
    const strokeSize =
      tool === "brush" ? binaryState.brushSize : binaryState.eraserSize;
    setWorkingOverlay(
      paintStroke(
        overlayRef.current,
        baseBinary.width,
        baseBinary.height,
        lastPointRef.current,
        neutral,
        strokeSize,
        getNeutralOverlayValue(tool, binaryState.carvingMode),
      ),
    );
    lastPointRef.current = neutral;
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
    const result = undoOverlay(
      history,
      encodeOverlay(overlayRef.current, baseBinary.width, baseBinary.height),
    );
    if (!result) {
      return;
    }
    const decoded = decodeOverlay(
      result.snapshot,
      baseBinary.width,
      baseBinary.height,
    );
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
    const result = redoOverlay(
      history,
      encodeOverlay(overlayRef.current, baseBinary.width, baseBinary.height),
    );
    if (!result) {
      return;
    }
    const decoded = decodeOverlay(
      result.snapshot,
      baseBinary.width,
      baseBinary.height,
    );
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

  function switchMode(nextMode: CanvasMode) {
    setMode(nextMode);
  }

  return {
    activeRuleId,
    addBackgroundRule,
    baseBinary,
    busy,
    cancelPendingReset: () => setPendingChange(null),
    commitRasterEdit,
    confirmReset,
    contentAvailable,
    cutout,
    editsAvailable,
    error,
    fileName,
    finalBinary,
    handleBackgroundSample,
    handleRedo,
    handleStrokeEnd,
    handleStrokeMove,
    handleStrokeStart,
    handleUndo,
    handleUploadFile,
    history,
    mode,
    pendingChange,
    removeBackgroundRule,
    requestImageChange,
    setActiveRuleId,
    setImageEraserSize,
    setTool,
    setZoom,
    signatureWarning,
    sourceRaster,
    switchMode,
    tool,
    updateBackgroundTolerance,
    zoom,
  };
}

export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export const ZOOM_STEP_VALUE = ZOOM_STEP;

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
