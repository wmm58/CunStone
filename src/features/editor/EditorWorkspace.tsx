import { useEffect, useRef, useState } from "react";

import type {
  WorkBinaryEditState,
  WorkImageState,
} from "../../domain/types";
import BinaryEditorCanvas from "./BinaryEditorCanvas";
import BinaryEditorPanel from "./BinaryEditorPanel";
import BinaryPreparationPanel from "./BinaryPreparationPanel";
import EditorCanvas from "./EditorCanvas";
import InputEditingPanel from "./InputEditingPanel";
import type { ImageCanvasTool } from "./imageEditingTypes";
import { clampZoom, useEditorSession, ZOOM_STEP_VALUE } from "./useEditorSession";

interface EditorWorkspaceProps {
  binaryState: WorkBinaryEditState;
  clearRequestId?: number;
  imageState: WorkImageState;
  onBinaryStateChange: (next: WorkBinaryEditState) => void;
  onBeforeUpload?: (openPicker: () => void) => void;
  onContentAvailabilityChange?: (available: boolean) => void;
  onImageStateChange: (
    next: WorkImageState,
    resetManualEdits?: boolean,
    autosaveMode?: "defer" | "resume",
  ) => void;
}

export default function EditorWorkspace({
  binaryState,
  clearRequestId = 0,
  imageState,
  onBinaryStateChange,
  onBeforeUpload,
  onContentAvailabilityChange,
  onImageStateChange,
}: EditorWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageTool, setImageTool] = useState<ImageCanvasTool>("sample");
  const session = useEditorSession({
    binaryState,
    clearRequestId,
    imageState,
    onBinaryStateChange,
    onContentAvailabilityChange,
    onImageStateChange,
  });

  useEffect(() => {
    if (!imageState.sourceDataUrl) {
      setImageTool("sample");
    }
  }, [clearRequestId, imageState.sourceDataUrl]);

  function requestUpload() {
    const openPicker = () => fileInputRef.current?.click();
    if (onBeforeUpload) {
      onBeforeUpload(openPicker);
    } else {
      openPicker();
    }
  }

  return (
    <div
      className="grid h-full min-h-0 w-full gap-4 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-stretch"
      data-testid="editor-workspace"
    >
      <aside
        aria-label="编辑工具"
        className="min-h-0 space-y-3 xl:h-full xl:overflow-y-auto xl:pr-2"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              aria-pressed={session.mode === "input"}
              className={
                session.mode === "input" ? activeModeClass : inactiveModeClass
              }
              onClick={() => session.switchMode("input")}
              type="button"
            >
              图片编辑
            </button>
            <button
              aria-pressed={session.mode === "binary"}
              className={
                session.mode === "binary" ? activeModeClass : inactiveModeClass
              }
              onClick={() => session.switchMode("binary")}
              type="button"
            >
              黑白稿编辑
            </button>
          </div>
        </div>
        {session.mode === "input" ? (
          <InputEditingPanel
            activeRuleId={session.activeRuleId}
            activeTool={imageTool}
            busy={session.busy}
            eraserSize={imageState.imageEraserSize}
            fileName={session.fileName}
            inputRef={fileInputRef}
            onActivateRule={(id) => {
              session.setActiveRuleId(id);
              setImageTool("sample");
            }}
            onAddRule={session.addBackgroundRule}
            onEraserSizeChange={session.setImageEraserSize}
            onRemoveRule={session.removeBackgroundRule}
            onRequestUpload={requestUpload}
            onSelectTool={setImageTool}
            onToleranceChange={session.updateBackgroundTolerance}
            onUploadFile={(file) => {
              setImageTool("sample");
              void session.handleUploadFile(file);
            }}
            rules={imageState.backgroundRules}
          />
        ) : (
          <>
            <BinaryPreparationPanel
              busy={session.busy}
              imageState={imageState}
              onRequestChange={session.requestImageChange}
              sourceAvailable={Boolean(session.baseBinary)}
            />
            <BinaryEditorPanel
              binaryState={binaryState}
              canRedo={session.history.redo.length > 0}
              canUndo={session.history.undo.length > 0}
              disabled={!session.editsAvailable}
              onChange={onBinaryStateChange}
              onRedo={session.handleRedo}
              onToolChange={session.setTool}
              onUndo={session.handleUndo}
              onZoomFit={() => session.setZoom(100)}
              onZoomIn={() =>
                session.setZoom((value) => clampZoom(value + ZOOM_STEP_VALUE))
              }
              onZoomOut={() =>
                session.setZoom((value) => clampZoom(value - ZOOM_STEP_VALUE))
              }
              tool={session.tool}
              zoom={session.zoom}
            />
          </>
        )}
        {session.error ? (
          <p
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700"
            role="alert"
          >
            {session.error}
          </p>
        ) : null}
        {session.busy ? (
          <p className="text-xs text-slate-500" role="status">
            正在处理本地图片…
          </p>
        ) : null}
      </aside>

      <div className="min-w-0 w-full space-y-3 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden">
        {session.signatureWarning ? (
          <p
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            role="alert"
          >
            {session.signatureWarning}
          </p>
        ) : null}

        <div className="min-h-0 w-full xl:flex xl:h-full xl:min-h-0 xl:flex-1 xl:overflow-hidden">
          {session.mode === "input" ? (
            <EditorCanvas
              cutout={session.cutout}
              eraserSize={imageState.imageEraserSize}
              onBackgroundSample={session.handleBackgroundSample}
              onCommitRaster={session.commitRasterEdit}
              onRequestUpload={requestUpload}
              tool={imageTool}
            />
          ) : (
            <BinaryEditorCanvas
              disabled={!session.editsAvailable}
              onStrokeEnd={session.handleStrokeEnd}
              onStrokeMove={session.handleStrokeMove}
              onStrokeStart={session.handleStrokeStart}
              raster={session.finalBinary}
              tool={session.tool}
              toolSize={
                session.tool === "brush"
                  ? binaryState.brushSize
                  : binaryState.eraserSize
              }
              zoom={session.zoom}
            />
          )}
        </div>
      </div>

      {session.pendingChange ? (
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
                onClick={session.cancelPendingReset}
                type="button"
              >
                取消
              </button>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                onClick={session.confirmReset}
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
