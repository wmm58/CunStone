import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import type { WorkImageState } from "../../domain/types";
import DrawingCanvas from "./DrawingCanvas";
import EditorCanvas, { type CanvasMode } from "./EditorCanvas";
import { prepareSourceDataUrl, prepareSourceFile } from "./imageInput";
import {
  createCutoutImage,
  renderBinaryDraft,
  rgbToHex,
  type RgbaImage,
} from "./imageProcessing";
import {
  applyRecommendation,
  isValidSealDimension,
  recommendationsForShape,
  selectShape,
} from "./sealOptions";

interface ImagePreparationPanelProps {
  imageState: WorkImageState;
  onChange: (next: WorkImageState) => void;
}

export default function ImagePreparationPanel({
  imageState,
  onChange,
}: ImagePreparationPanelProps) {
  const [sourceRaster, setSourceRaster] = useState<RgbaImage | null>(null);
  const [mode, setMode] = useState<CanvasMode>("input");
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [widthInput, setWidthInput] = useState(String(imageState.widthMm));
  const [heightInput, setHeightInput] = useState(String(imageState.heightMm));
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWidthInput(String(imageState.widthMm));
    setHeightInput(String(imageState.heightMm));
  }, [imageState.widthMm, imageState.heightMm]);

  useEffect(() => {
    let cancelled = false;
    if (!imageState.sourceDataUrl) {
      setSourceRaster(null);
      setMode("input");
      return;
    }

    setBusy(true);
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
          setError("图片无法读取，请重新上传或手绘");
          setBusy(false);
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

  const binary = useMemo(
    () => (sourceRaster ? renderBinaryDraft(sourceRaster, imageState) : null),
    [imageState, sourceRaster],
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setError("");
    setBusy(true);
    try {
      const source = await prepareSourceFile(file);
      setSourceRaster(source.raster);
      setFileName(file.name);
      setMode("input");
      onChange({
        ...imageState,
        sourceKind: "upload",
        sourceDataUrl: source.dataUrl,
        backgroundColor: null,
      });
    } catch (caught) {
      setError(fileErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleDrawingCommit(dataUrl: string) {
    setError("");
    setBusy(true);
    try {
      const source = await prepareSourceDataUrl(dataUrl);
      setSourceRaster(source.raster);
      setFileName("");
      setDrawing(false);
      setMode("input");
      onChange({
        ...imageState,
        sourceKind: "drawing",
        sourceDataUrl: source.dataUrl,
        backgroundColor: null,
      });
    } catch {
      setError("手绘稿无法读取，请重试");
    } finally {
      setBusy(false);
    }
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
    onChange({
      ...imageState,
      backgroundColor: rgbToHex({
        r: sourceRaster.data[offset],
        g: sourceRaster.data[offset + 1],
        b: sourceRaster.data[offset + 2],
      }),
    });
  }

  function handleShape(shape: WorkImageState["shape"]) {
    const next = selectShape(imageState, shape);
    setWidthInput(String(next.widthMm));
    setHeightInput(String(next.heightMm));
    setError("");
    onChange(next);
  }

  function handleRecommendation(widthMm: number, heightMm: number) {
    const next = applyRecommendation(imageState, widthMm, heightMm);
    setWidthInput(String(widthMm));
    setHeightInput(String(heightMm));
    setError("");
    onChange(next);
  }

  function commitDimensions() {
    const width = Number(widthInput);
    const height = Number(heightInput);
    if (!isValidSealDimension(width) || !isValidSealDimension(height)) {
      setError("尺寸需在 10–100 mm 之间");
      return;
    }
    setError("");
    onChange({ ...imageState, widthMm: width, heightMm: height });
  }

  function updateDimension(
    dimension: "width" | "height",
    value: string,
  ) {
    if (dimension === "width") {
      setWidthInput(value);
      if (imageState.shape === "square" || imageState.shape === "circle") {
        setHeightInput(value);
      }
    } else {
      setHeightInput(value);
      if (imageState.shape === "square" || imageState.shape === "circle") {
        setWidthInput(value);
      }
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-3" aria-label="图片预处理工具">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">01 外形与实际尺寸</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {(["square", "rectangle", "circle", "custom"] as const).map((shape) => (
              <button
                aria-pressed={imageState.shape === shape}
                className={
                  imageState.shape === shape
                    ? "rounded-md bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white"
                    : "rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                }
                key={shape}
                onClick={() => handleShape(shape)}
                type="button"
              >
                {shapeLabel(shape)}
              </button>
            ))}
          </div>
          {recommendationsForShape(imageState.shape).length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {recommendationsForShape(imageState.shape).map((option) => (
                <button
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  key={option.label}
                  onClick={() => handleRecommendation(option.widthMm, option.heightMm)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">
              宽 (mm)
              <input
                aria-label="宽 (mm)"
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                inputMode="decimal"
                onBlur={commitDimensions}
                onChange={(event) => updateDimension("width", event.target.value)}
                value={widthInput}
              />
            </label>
            <label className="text-xs text-slate-600">
              高 (mm)
              <input
                aria-label="高 (mm)"
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                inputMode="decimal"
                onBlur={commitDimensions}
                onChange={(event) => updateDimension("height", event.target.value)}
                value={heightInput}
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">02 输入完整画面</h3>
          <div className="flex flex-wrap gap-2">
            <label className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium">
              上传图片
              <input
                accept="image/png,image/jpeg,image/webp"
                aria-label="上传图片"
                className="sr-only"
                onChange={handleFile}
                ref={fileInputRef}
                type="file"
              />
            </label>
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium"
              onClick={() => {
                setDrawing(true);
                setMode("input");
              }}
              type="button"
            >
              手绘画布
            </button>
          </div>
          {fileName ? <p className="mt-2 truncate text-xs text-slate-500">当前文件：{fileName}</p> : null}
          <p className="mt-2 text-xs leading-5 text-slate-500">
            仅支持完整构图；单文件不超过 10 MB。
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">03 纯色背景去除</h3>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>已选背景色</span>
            <span
              className="h-4 w-4 rounded border border-slate-300"
              style={{ backgroundColor: imageState.backgroundColor ?? "#ffffff" }}
            />
            <span>{imageState.backgroundColor ?? "未选择"}</span>
          </div>
          {imageState.backgroundColor ? (
            <button
              className="mt-2 text-xs font-medium text-slate-700 underline"
              onClick={() => onChange({ ...imageState, backgroundColor: null })}
              type="button"
            >
              重新点选背景
            </button>
          ) : null}
          <label className="mt-3 block text-xs text-slate-600">
            背景容差 {imageState.tolerance}
            <input
              aria-label="背景容差"
              className="mt-1 w-full accent-slate-900"
              disabled={!sourceRaster}
              max={100}
              min={0}
              onChange={(event) =>
                onChange({ ...imageState, tolerance: Number(event.target.value) })
              }
              type="range"
              value={imageState.tolerance}
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            在输入画布点击背景取样。残留边缘将在 Change 3 用橡皮修整。
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">04 效果与适配</h3>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              aria-pressed={imageState.effectMode === "silhouette"}
              className={
                imageState.effectMode === "silhouette"
                  ? "rounded-md bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white"
                  : "rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              }
              onClick={() => onChange({ ...imageState, effectMode: "silhouette" })}
              type="button"
            >
              实心剪影
            </button>
            <button
              aria-pressed={imageState.effectMode === "outline"}
              className={
                imageState.effectMode === "outline"
                  ? "rounded-md bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white"
                  : "rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              }
              onClick={() => onChange({ ...imageState, effectMode: "outline" })}
              type="button"
            >
              轮廓线稿
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            本地自动缩放、居中、锐化和外形裁切；不包含透视校正。
          </p>
        </section>

        {error ? (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {busy ? (
          <p className="text-xs text-slate-500" role="status">
            正在处理本地图片…
          </p>
        ) : null}
      </aside>

      <div className="min-w-0">
        {drawing ? (
          <DrawingCanvas
            onCancel={() => setDrawing(false)}
            onCommit={handleDrawingCommit}
          />
        ) : (
          <EditorCanvas
            binary={binary}
            cutout={cutout}
            mode={mode}
            onBackgroundSample={handleBackgroundSample}
            onModeChange={setMode}
          />
        )}
      </div>
    </div>
  );
}

function shapeLabel(shape: WorkImageState["shape"]): string {
  return {
    square: "正方形",
    rectangle: "长方形",
    circle: "圆形",
    custom: "自定义",
  }[shape];
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
