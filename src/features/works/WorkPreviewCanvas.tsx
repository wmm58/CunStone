import { useEffect, useRef, useState } from "react";

import type { WorkRecord } from "../../domain/types";
import { prepareSourceDataUrl } from "../editor/imageInput";
import type { RgbaImage } from "../editor/imageProcessing";
import {
  loadWorkSource,
  renderRedImpression,
  renderWorkBlackWhite,
} from "./workPreview";

interface WorkPreviewCanvasProps {
  work: WorkRecord;
  variant: "binary" | "red";
  className?: string;
}

export default function WorkPreviewCanvas({
  work,
  variant,
  className = "",
}: WorkPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [raster, setRaster] = useState<RgbaImage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const dataUrl = work.imageState.sourceDataUrl;
    if (!dataUrl) {
      setRaster(null);
      setError("暂无印稿");
      return;
    }

    setError("");
    loadWorkSource(dataUrl, prepareSourceDataUrl)
      .then((source) => {
        if (!cancelled) {
          const binary = renderWorkBlackWhite(work, source);
          setRaster(variant === "red" ? renderRedImpression(binary) : binary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRaster(null);
          setError("预览不可用");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [variant, work]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !raster) {
      return;
    }
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const imageData = context.createImageData(raster.width, raster.height);
    imageData.data.set(raster.data);
    context.putImageData(imageData, 0, 0);
  }, [raster]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-xs text-slate-500 ${className}`}
      >
        {error}
      </div>
    );
  }

  if (!raster) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-xs text-slate-500 ${className}`}
        role="status"
      >
        正在生成预览…
      </div>
    );
  }

  return (
    <canvas
      aria-label={`${work.name} ${variant === "red" ? "红印预览" : "黑白印稿"}`}
      className={`max-h-full max-w-full border border-slate-200 bg-white object-contain ${className}`}
      ref={canvasRef}
    />
  );
}
