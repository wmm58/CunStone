import { useEffect, useRef, useState } from "react";

import BrandHeader from "../components/BrandHeader";
import EditorDialog, {
  dialogPrimaryButtonClass,
  dialogSecondaryButtonClass,
} from "../components/EditorDialog";
import {
  createDefaultWorkBinaryState,
  createDefaultWorkImageState,
  type WorkBinaryEditState,
  type WorkImageState,
  type WorkRecord,
  type WorkStatus,
} from "../domain/types";
import EditorWorkspace from "../features/editor/EditorWorkspace";
import { clearManualEdits } from "../features/editor/binaryEditing";
import { setExportWorkIds } from "../features/export/exportSession";
import {
  createWork,
  getActiveUserWork,
  updateWork,
} from "../features/works/workService";

interface EditorPageProps {
  workId?: string;
  onSignOut: () => void;
  onStartNew: () => void;
  onOpenWorks?: () => void;
  onOpenExport?: () => void;
  onWorkSaved: (workId: string) => void;
  autosaveDelayMs?: number;
}

type SaveNotice = "draft" | "completed";

export default function EditorPage({
  workId,
  onSignOut,
  onStartNew,
  onOpenWorks,
  onOpenExport,
  onWorkSaved,
  autosaveDelayMs = 600,
}: EditorPageProps) {
  const [work, setWork] = useState<WorkRecord | null>(null);
  const [name, setName] = useState("未命名作品");
  const [status, setStatus] = useState<WorkStatus>("draft");
  const [imageState, setImageState] = useState<WorkImageState>(
    createDefaultWorkImageState,
  );
  const [binaryState, setBinaryState] = useState<WorkBinaryEditState>(
    createDefaultWorkBinaryState,
  );
  const [hasPrintableContent, setHasPrintableContent] = useState(false);
  const [clearRequestId, setClearRequestId] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [imageDirty, setImageDirty] = useState(false);
  const [binaryDirty, setBinaryDirty] = useState(false);
  const [rasterEditPending, setRasterEditPending] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [pendingRouteWorkId, setPendingRouteWorkId] = useState<string | null>(
    null,
  );
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const pendingUploadRef = useRef<(() => void) | null>(null);

  const hasUnsavedChanges = dirty || imageDirty || binaryDirty;

  useEffect(() => {
    setError("");
    setDirty(false);
    setNotFound(false);
    setHasPrintableContent(false);
    setRasterEditPending(false);
    setClearRequestId(0);
    setSaveNotice(null);
    setLeaveOpen(false);
    setReplaceOpen(false);
    setPendingRouteWorkId(null);
    pendingLeaveRef.current = null;
    pendingUploadRef.current = null;

    if (!workId) {
      setWork(null);
      setName("未命名作品");
      setStatus("draft");
      setImageState(createDefaultWorkImageState());
      setBinaryState(createDefaultWorkBinaryState());
      setImageDirty(false);
      setBinaryDirty(false);
      return;
    }

    const loaded = getActiveUserWork(workId);
    if (!loaded) {
      setWork(null);
      setNotFound(true);
      return;
    }

    setWork(loaded);
    setName(loaded.name);
    setStatus(loaded.status);
    setImageState(loaded.imageState);
    setBinaryState(loaded.binaryState);
    setImageDirty(false);
    setBinaryDirty(false);
  }, [workId]);

  useEffect(() => {
    if (
      !work ||
      rasterEditPending ||
      (!dirty && !imageDirty && !binaryDirty)
    ) {
      return;
    }
    if (!name.trim() || !hasPrintableContent) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const result = updateWork(work.id, {
          name,
          status,
          imageState,
          binaryState,
        });
        if (!result.ok) {
          setError(
            result.error === "not-found"
              ? "作品不存在或不属于当前本地账号"
              : "保存失败，请重试",
          );
          return;
        }
        setWork(result.work);
        setName(result.work.name);
        setStatus(result.work.status);
        setImageState(result.work.imageState);
        setBinaryState(result.work.binaryState);
        setDirty(false);
        setImageDirty(false);
        setBinaryDirty(false);
        setRasterEditPending(false);
        setError("");
      } catch {
        setError("保存失败，请重试");
      }
    }, autosaveDelayMs);

    return () => window.clearTimeout(timer);
  }, [
    autosaveDelayMs,
    binaryDirty,
    binaryState,
    dirty,
    hasPrintableContent,
    imageDirty,
    imageState,
    name,
    rasterEditPending,
    status,
    work,
  ]);

  function handleNameChange(nextName: string) {
    setName(nextName);
    setDirty(true);
    setError("");
  }

  function handleImageStateChange(
    next: WorkImageState,
    resetManualEdits = false,
    autosaveMode?: "defer" | "resume",
  ) {
    const nextBinaryState = resetManualEdits
      ? clearManualEdits(binaryState)
      : binaryState;
    setError("");
    setImageState(next);
    setBinaryState(nextBinaryState);
    setImageDirty(true);
    if (autosaveMode === "defer") {
      setRasterEditPending(true);
    } else if (autosaveMode === "resume") {
      setRasterEditPending(false);
    }
    if (resetManualEdits) {
      setBinaryDirty(true);
    }
  }

  function handleBinaryStateChange(next: WorkBinaryEditState) {
    setBinaryState(next);
    setBinaryDirty(true);
    setError("");
  }

  function persistWork(
    nextStatus: WorkStatus,
    notifyNewRoute = false,
  ): WorkRecord | null {
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("请输入作品名称");
      return null;
    }
    if (!hasPrintableContent) {
      setError("作品为空");
      return null;
    }

    try {
      const result = work
        ? updateWork(work.id, {
            name: trimmedName,
            status: nextStatus,
            imageState,
            binaryState,
          })
        : createWork({
            name: trimmedName,
            status: nextStatus,
            imageState,
            binaryState,
          });

      if (!result.ok) {
        setError(
          result.error === "not-found"
            ? "作品不存在或不属于当前本地账号"
            : "保存失败，请重试",
        );
        return null;
      }

      const isNew = !work;
      setWork(result.work);
      setName(result.work.name);
      setStatus(result.work.status);
      setImageState(result.work.imageState);
      setBinaryState(result.work.binaryState);
      setDirty(false);
      setImageDirty(false);
      setBinaryDirty(false);
      setRasterEditPending(false);
      if (isNew && notifyNewRoute) {
        setPendingRouteWorkId(result.work.id);
      }
      return result.work;
    } catch {
      setError("保存失败，请重试");
      return null;
    }
  }

  function handleSave(nextStatus: WorkStatus) {
    const saved = persistWork(nextStatus, true);
    if (saved) {
      setSaveNotice(nextStatus === "draft" ? "draft" : "completed");
    }
  }

  function closeSaveNotice() {
    setSaveNotice(null);
    const routeWorkId = pendingRouteWorkId;
    setPendingRouteWorkId(null);
    if (routeWorkId) {
      onWorkSaved(routeWorkId);
    }
  }

  function requestLeave(action: () => void) {
    if (!hasUnsavedChanges) {
      action();
      return;
    }
    pendingLeaveRef.current = action;
    setLeaveOpen(true);
  }

  function cancelLeave() {
    pendingLeaveRef.current = null;
    setLeaveOpen(false);
  }

  function leaveWithoutSaving() {
    const action = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    setLeaveOpen(false);
    action?.();
  }

  function saveDraftAndContinue() {
    const action = pendingLeaveRef.current;
    const saved = persistWork("draft");
    pendingLeaveRef.current = null;
    setLeaveOpen(false);
    if (saved) {
      action?.();
    }
  }

  function handleBeforeUpload(openPicker: () => void) {
    if (imageState.sourceDataUrl || hasPrintableContent) {
      pendingUploadRef.current = openPicker;
      setReplaceOpen(true);
      return;
    }
    openPicker();
  }

  function cancelReplace() {
    pendingUploadRef.current = null;
    setReplaceOpen(false);
  }

  function replaceWithoutSaving() {
    const openPicker = pendingUploadRef.current;
    pendingUploadRef.current = null;
    setReplaceOpen(false);
    openPicker?.();
  }

  function saveDraftAndReplace() {
    const openPicker = pendingUploadRef.current;
    const saved = persistWork("draft");
    pendingUploadRef.current = null;
    setReplaceOpen(false);
    if (saved) {
      openPicker?.();
    }
  }

  function handleExport() {
    const saved = persistWork("completed");
    if (!saved || !onOpenExport) {
      if (saved && !onOpenExport) {
        setError("A4 导出暂不可用");
      }
      return;
    }
    setExportWorkIds([saved.id]);
    onOpenExport();
  }

  function handleClear() {
    setImageState({
      ...createDefaultWorkImageState(),
      shape: imageState.shape,
      widthMm: imageState.widthMm,
      heightMm: imageState.heightMm,
    });
    setBinaryState(createDefaultWorkBinaryState());
    setHasPrintableContent(false);
    setClearRequestId((value) => value + 1);
    setImageDirty(true);
    setBinaryDirty(true);
    setRasterEditPending(false);
    setError("");
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl">
          <BrandHeader pageTitle="创作编辑" />
          <section className="mx-auto mt-12 max-w-xl rounded-2xl border border-slate-300 bg-white p-8 text-center">
            <p className="mb-5 text-sm text-slate-600">
              作品不存在或不属于当前本地账号
            </p>
            <div className="flex justify-center gap-2">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={onSignOut}
                type="button"
              >
                切换账号
              </button>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                onClick={onStartNew}
                type="button"
              >
                新建作品
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6 xl:h-dvh xl:overflow-hidden xl:py-4">
      <div className="mx-auto max-w-[1600px] xl:flex xl:h-full xl:flex-col">
        <div className="xl:shrink-0">
          <BrandHeader
            actions={
              <>
                {onOpenWorks ? (
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    onClick={() => requestLeave(onOpenWorks)}
                    type="button"
                  >
                    作品列表
                  </button>
                ) : null}
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  onClick={() => requestLeave(onSignOut)}
                  type="button"
                >
                  切换账号
                </button>
              </>
            }
            pageTitle="创作编辑"
          />
        </div>

        <section className="mt-4 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <label className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-sm font-medium text-slate-700">
                作品名称
              </span>
              <input
                aria-label="作品名称"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                maxLength={50}
                onChange={(event) => handleNameChange(event.target.value)}
                value={name}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                onClick={() => handleSave("draft")}
                type="button"
              >
                草稿
              </button>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => handleSave("completed")}
                type="button"
              >
                保存
              </button>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                onClick={handleExport}
                type="button"
              >
                A4 导出
              </button>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                onClick={handleClear}
                type="button"
              >
                清除
              </button>
            </div>
          </div>

          {error ? (
            <p
              className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-3 xl:min-h-0 xl:flex-1">
            <EditorWorkspace
              binaryState={binaryState}
              clearRequestId={clearRequestId}
              imageState={imageState}
              onBeforeUpload={handleBeforeUpload}
              onBinaryStateChange={handleBinaryStateChange}
              onContentAvailabilityChange={setHasPrintableContent}
              onImageStateChange={handleImageStateChange}
            />
          </div>
        </section>
      </div>

      {saveNotice ? (
        <EditorDialog
          actions={
            <button
              className={dialogPrimaryButtonClass}
              onClick={closeSaveNotice}
              type="button"
            >
              知道了
            </button>
          }
          title={saveNotice === "draft" ? "草稿已保存" : "作品已保存"}
        >
          <p>
            {saveNotice === "draft"
              ? "作品已保存到当前浏览器。更换浏览器、清除站点数据或更换设备后可能无法恢复。"
              : "作品已保存到当前浏览器，可继续编辑，也可在作品列表中预览或进入 A4 排版。"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            本地账号仅用于区分作品，不等同于安全隔离。
          </p>
        </EditorDialog>
      ) : null}

      {leaveOpen ? (
        <EditorDialog
          actions={
            <>
              <button
                className={dialogSecondaryButtonClass}
                onClick={cancelLeave}
                type="button"
              >
                继续编辑
              </button>
              <button
                className={dialogSecondaryButtonClass}
                onClick={saveDraftAndContinue}
                type="button"
              >
                保存草稿并继续
              </button>
              <button
                className={dialogPrimaryButtonClass}
                onClick={leaveWithoutSaving}
                type="button"
              >
                直接离开
              </button>
            </>
          }
          title="当前修改尚未保存"
        >
          <p>离开后，本次未保存的修改会丢失。</p>
        </EditorDialog>
      ) : null}

      {replaceOpen ? (
        <EditorDialog
          actions={
            <>
              <button
                className={dialogSecondaryButtonClass}
                onClick={cancelReplace}
                type="button"
              >
                取消
              </button>
              <button
                className={dialogSecondaryButtonClass}
                onClick={saveDraftAndReplace}
                type="button"
              >
                保存草稿并替换
              </button>
              <button
                className={dialogPrimaryButtonClass}
                onClick={replaceWithoutSaving}
                type="button"
              >
                直接替换
              </button>
            </>
          }
          title="替换当前作品？"
        >
          <p>当前画布已有内容，替换后会使用新图片重新开始。</p>
        </EditorDialog>
      ) : null}
    </main>
  );
}
