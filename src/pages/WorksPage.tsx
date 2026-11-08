import { useEffect, useState } from "react";

import BrandHeader from "../components/BrandHeader";
import type { WorkRecord } from "../domain/types";
import { getActiveUser } from "../features/auth/authService";
import { setExportWorkIds } from "../features/export/exportSession";
import WorkPreviewCanvas from "../features/works/WorkPreviewCanvas";
import {
  deleteActiveUserWorks,
  listActiveUserWorksByStatus,
  type WorkFilter,
} from "../features/works/workService";

interface WorksPageProps {
  onNewWork: () => void;
  onEditWork: (workId: string) => void;
  onOpenExport: () => void;
  onSignOut: () => void;
}

const FILTERS: Array<{ value: WorkFilter; label: string }> = [
  { value: "all", label: "全部作品" },
  { value: "completed", label: "已完成" },
  { value: "draft", label: "草稿" },
];

export default function WorksPage({
  onNewWork,
  onEditWork,
  onOpenExport,
  onSignOut,
}: WorksPageProps) {
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewWork, setPreviewWork] = useState<WorkRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const activeUser = getActiveUser();

  useEffect(() => {
    setWorks(listActiveUserWorksByStatus(filter));
    setSelected(new Set());
    setError("");
  }, [filter, refreshKey]);

  function changeFilter(next: WorkFilter) {
    setFilter(next);
    setNotice("");
  }

  function toggleWork(workId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(workId)) {
        next.delete(workId);
      } else {
        next.add(workId);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === works.length
        ? new Set()
        : new Set(works.map((work) => work.id)),
    );
  }

  function confirmDelete() {
    const result = deleteActiveUserWorks([...selected]);
    if (!result.ok) {
      setError(
        result.error === "no-active-user"
          ? "当前本地账号不可用"
          : "删除失败，请重试",
      );
      setDeleteOpen(false);
      return;
    }
    setDeleteOpen(false);
    setPreviewWork(null);
    setSelected(new Set());
    setRefreshKey((value) => value + 1);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <BrandHeader
            actions={
              <>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  onClick={onSignOut}
                  type="button"
                >
                  切换账号
                </button>
                <button
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  onClick={onNewWork}
                  type="button"
                >
                  新建作品
                </button>
              </>
            }
            pageTitle="作品列表"
          />
          {activeUser ? (
            <p className="mt-2 text-xs text-slate-500">
              当前账号：{activeUser.phone}
            </p>
          ) : null}
        </div>

        <section className="rounded-2xl border border-slate-300 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex gap-1">
              {FILTERS.map((item) => (
                <button
                  aria-pressed={filter === item.value}
                  className={
                    filter === item.value
                      ? "rounded-md bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white"
                      : "rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  }
                  key={item.value}
                  onClick={() => changeFilter(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {filter !== "all" ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">
                  已选 {selected.size} 项
                </span>
                <button
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  onClick={toggleAll}
                  type="button"
                >
                  一键全选
                </button>
                <button
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={selected.size === 0}
                  onClick={() => setDeleteOpen(true)}
                  type="button"
                >
                  删除
                </button>
                {filter === "completed" ? (
                  <button
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={selected.size === 0}
                    onClick={() => {
                      setExportWorkIds([...selected]);
                      onOpenExport();
                    }}
                    type="button"
                  >
                    A4 导出
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {notice ? (
            <p
              className="mt-4 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-800"
              role="status"
            >
              {notice}
            </p>
          ) : null}
          {error ? (
            <p
              className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {works.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
              当前筛选下没有作品
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {works.map((work) => (
                <article
                  className="rounded-xl border border-slate-300 bg-white p-4"
                  key={work.id}
                >
                  <div className="flex items-start gap-3">
                    {filter !== "all" ? (
                      <input
                        aria-label={`选择作品 ${work.name}`}
                        checked={selected.has(work.id)}
                        className="mt-1 h-4 w-4 accent-slate-900"
                        onChange={() => toggleWork(work.id)}
                        type="checkbox"
                      />
                    ) : null}
                    <div className="flex h-44 min-w-0 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <WorkPreviewCanvas
                        className="h-full w-full"
                        variant="binary"
                        work={work}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <h2 className="truncate font-semibold text-slate-950">
                      {work.name}
                    </h2>
                    <span className="shrink-0 rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600">
                      {work.status === "completed" ? "已完成" : "草稿"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    最后保存 {formatTime(work.lastSavedAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dimensionLabel(work)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                      onClick={() => setPreviewWork(work)}
                      type="button"
                    >
                      预览
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                      onClick={() => onEditWork(work.id)}
                      type="button"
                    >
                      继续编辑
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {previewWork ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
          <section
            aria-label="作品预览弹窗"
            aria-modal="true"
            className="w-full max-w-4xl rounded-2xl border border-slate-300 bg-white p-5 shadow-xl"
            role="dialog"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-950">
                作品预览 · {previewWork.name}
              </h2>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                onClick={() => setPreviewWork(null)}
                type="button"
              >
                关闭
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <PreviewPanel title="红印效果（线上）" tone="red">
                <WorkPreviewCanvas
                  className="h-full w-full"
                  variant="red"
                  work={previewWork}
                />
              </PreviewPanel>
              <PreviewPanel title="黑白印稿" tone="binary">
                <WorkPreviewCanvas
                  className="h-full w-full"
                  variant="binary"
                  work={previewWork}
                />
              </PreviewPanel>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                红印仅线上展示，不进入后续 PDF。
              </span>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => onEditWork(previewWork.id)}
                type="button"
              >
                继续编辑
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section
            aria-label="删除作品确认"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-xl"
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-slate-950">删除作品</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              将永久删除已选的 {selected.size} 件作品，删除后无法恢复。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setDeleteOpen(false)}
                type="button"
              >
                取消
              </button>
              <button
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                onClick={confirmDelete}
                type="button"
              >
                确认删除
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function PreviewPanel({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "red" | "binary";
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <div
        className={`flex aspect-square items-center justify-center rounded-xl border p-4 ${
          tone === "red"
            ? "border-red-200 bg-red-50"
            : "border-slate-300 bg-slate-50"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dimensionLabel(work: WorkRecord): string {
  return work.imageState.shape === "circle"
    ? `Ø${work.imageState.widthMm} mm`
    : `${work.imageState.widthMm}×${work.imageState.heightMm} mm`;
}
