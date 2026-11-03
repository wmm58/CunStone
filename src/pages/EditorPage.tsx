import { useEffect, useState } from "react";

import {
  createDefaultWorkImageState,
  type WorkImageState,
  type WorkRecord,
  type WorkStatus,
} from "../domain/types";
import ImagePreparationPanel from "../features/editor/ImagePreparationPanel";
import {
  createWork,
  getActiveUserWork,
  updateWork,
} from "../features/works/workService";

interface EditorPageProps {
  workId?: string;
  onSignOut: () => void;
  onStartNew: () => void;
  onWorkSaved: (workId: string) => void;
  autosaveDelayMs?: number;
}

type SaveState = "new" | "unsaved" | "saving" | "saved" | "error";

export default function EditorPage({
  workId,
  onSignOut,
  onStartNew,
  onWorkSaved,
  autosaveDelayMs = 600,
}: EditorPageProps) {
  const [work, setWork] = useState<WorkRecord | null>(null);
  const [name, setName] = useState("未命名作品");
  const [status, setStatus] = useState<WorkStatus>("draft");
  const [imageState, setImageState] = useState<WorkImageState>(
    createDefaultWorkImageState,
  );
  const [dirty, setDirty] = useState(false);
  const [imageDirty, setImageDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("new");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setDirty(false);
    setNotFound(false);

    if (!workId) {
      setWork(null);
      setName("未命名作品");
      setStatus("draft");
      setImageState(createDefaultWorkImageState());
      setImageDirty(false);
      setLastSavedAt(null);
      setSaveState("new");
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
    setLastSavedAt(loaded.lastSavedAt);
    setSaveState("saved");
    setImageDirty(false);
  }, [workId]);

  useEffect(() => {
    if (!work || (!dirty && !imageDirty)) {
      return;
    }

    if (!name.trim()) {
      setSaveState("unsaved");
      return;
    }

    setSaveState("unsaved");
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      try {
        const result = updateWork(work.id, { name, status, imageState });
        if (!result.ok) {
          setSaveState("error");
          return;
        }
        setWork(result.work);
        setName(result.work.name);
        setStatus(result.work.status);
        setImageState(result.work.imageState);
        setLastSavedAt(result.work.lastSavedAt);
        setDirty(false);
        setImageDirty(false);
        setError("");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, autosaveDelayMs);

    return () => window.clearTimeout(timer);
  }, [autosaveDelayMs, dirty, imageDirty, imageState, name, status, work]);

  function handleNameChange(nextName: string) {
    setName(nextName);
    setDirty(true);
    setError("");
  }

  function handleImageStateChange(next: WorkImageState) {
    const trimmedName = name.trim();
    const shouldPersistImmediately =
      work &&
      trimmedName &&
      next.sourceDataUrl &&
      next.sourceDataUrl !== imageState.sourceDataUrl;

    if (shouldPersistImmediately) {
      try {
        const result = updateWork(work.id, {
          name: trimmedName,
          status,
          imageState: next,
        });
        if (result.ok) {
          setWork(result.work);
          setImageState(result.work.imageState);
          setLastSavedAt(result.work.lastSavedAt);
          setImageDirty(false);
          setSaveState("saved");
          setError("");
          return;
        }
        setSaveState("error");
        setError(
          result.error === "not-found"
            ? "作品不存在或不属于当前本地账号"
            : "保存失败，请重试",
        );
      } catch {
        setSaveState("error");
        setError("保存失败，请重试");
      }
    } else {
      setError("");
    }

    setImageState(next);
    setImageDirty(true);
    if (!shouldPersistImmediately) {
      setSaveState("unsaved");
    }
  }

  function save(nextStatus: WorkStatus) {
    setError("");
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("请输入作品名称");
      return;
    }

    setSaveState("saving");
    try {
      const result = work
        ? updateWork(work.id, {
            name: trimmedName,
            status: nextStatus,
            imageState,
          })
        : createWork({
            name: trimmedName,
            status: nextStatus,
            imageState,
          });

      if (!result.ok) {
        setSaveState("error");
        setError(
          result.error === "not-found"
            ? "作品不存在或不属于当前本地账号"
            : "保存失败，请重试",
        );
        return;
      }

      const isNew = !work;
      setWork(result.work);
      setName(result.work.name);
      setStatus(result.work.status);
      setImageState(result.work.imageState);
      setLastSavedAt(result.work.lastSavedAt);
      setDirty(false);
      setImageDirty(false);
      setSaveState("saved");

      if (isNew) {
        onWorkSaved(result.work.id);
      }
    } catch {
      setSaveState("error");
      setError("保存失败，请重试");
    }
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-300 bg-white p-8 text-center">
          <h1 className="mb-3 text-2xl font-bold text-slate-950">创作编辑</h1>
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
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-[0.16em] text-slate-500">
              CUNSTONE · P2
            </p>
            <h1 className="text-2xl font-bold text-slate-950">创作编辑</h1>
          </div>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            onClick={onSignOut}
            type="button"
          >
            切换账号
          </button>
        </header>

        <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                作品名称
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                maxLength={50}
                onChange={(event) => handleNameChange(event.target.value)}
                value={name}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                onClick={() => save("draft")}
                type="button"
              >
                草稿
              </button>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => save("completed")}
                type="button"
              >
                保存（已完成）
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span
              aria-label="作品状态"
              className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-700"
            >
              {status === "completed" ? "已完成" : "草稿"}
            </span>
            <SaveStateMessage saveState={saveState} lastSavedAt={lastSavedAt} />
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            本地账号只用于数据区分，不构成安全隔离；数据可在当前浏览器中查看。
          </p>

          {error ? (
            <p
              className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-6">
            <ImagePreparationPanel
              imageState={imageState}
              onChange={handleImageStateChange}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function SaveStateMessage({
  saveState,
  lastSavedAt,
}: {
  saveState: SaveState;
  lastSavedAt: string | null;
}) {
  const message =
    saveState === "saving"
      ? "保存中…"
      : saveState === "saved" && lastSavedAt
        ? `已保存 ${new Date(lastSavedAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}`
        : saveState === "error"
          ? "保存失败，请重试"
          : "未保存";

  return (
    <span
      aria-live="polite"
      className={
        saveState === "error"
          ? "text-sm font-medium text-red-700"
          : "text-sm text-slate-500"
      }
      role="status"
    >
      {message}
    </span>
  );
}
