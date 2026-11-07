import { useEffect, useRef, useState, type PointerEvent } from "react";

import type { WorkRecord } from "../domain/types";
import {
  A4_PAGE,
  autoLayoutWorks,
  clampGap,
  clampWorkPosition,
  getPageCount,
  normalizeRotation,
  type PlacedWork,
} from "../features/export/a4Layout";
import { peekExportWorkIds } from "../features/export/exportSession";
import WorkPreviewCanvas from "../features/works/WorkPreviewCanvas";
import { listActiveUserWorksByStatus } from "../features/works/workService";

const SCREEN_PX_PER_MM = 3;
const DEFAULT_SPACING = { horizontalGapMm: 5, verticalGapMm: 5 };

interface ExportWorksPageProps {
  onBack: () => void;
  onSignOut: () => void;
}

interface DragState {
  id: string;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
}

export default function ExportWorksPage({
  onBack,
  onSignOut,
}: ExportWorksPageProps) {
  const [works, setWorks] = useState<WorkRecord[]>(() => {
    const ids = new Set(peekExportWorkIds());
    return listActiveUserWorksByStatus("completed").filter((work) =>
      ids.has(work.id),
    );
  });
  const [spacing, setSpacing] = useState(DEFAULT_SPACING);
  const [layout, setLayout] = useState<PlacedWork[]>(() =>
    autoLayoutWorks(toLayoutInputs(works), DEFAULT_SPACING),
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const dragRef = useRef<DragState | null>(null);

  const pageCount = getPageCount(layout);
  const displayedItems = layout.filter((item) => item.pageIndex === pageIndex);
  const availableWorks = listActiveUserWorksByStatus("completed").filter(
    (work) => !works.some((existing) => existing.id === work.id),
  );

  useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  function reflow(nextWorks: WorkRecord[], nextSpacing = spacing) {
    setWorks(nextWorks);
    setLayout(autoLayoutWorks(toLayoutInputs(nextWorks), nextSpacing));
    setSelectedId(null);
    setPageIndex(0);
  }

  function changeSpacing(kind: "horizontalGapMm" | "verticalGapMm", value: number) {
    const next = { ...spacing, [kind]: clampGap(value) };
    setSpacing(next);
    reflow(works, next);
    setNotice("间距已更新，已重新自动排版。手动位置已重置。");
  }

  function openAddDialog() {
    setAddSelected(new Set());
    setAddOpen(true);
  }

  function confirmAddWorks() {
    const additions = availableWorks.filter((work) => addSelected.has(work.id));
    reflow([...works, ...additions]);
    setAddOpen(false);
    setAddSelected(new Set());
  }

  function removeWork(workId: string) {
    reflow(works.filter((work) => work.id !== workId));
  }

  function rotateSelected() {
    if (!selectedId) {
      return;
    }
    setLayout((current) =>
      current.map((item) =>
        item.id === selectedId
          ? { ...item, rotationDeg: normalizeRotation(item.rotationDeg + 90) }
          : item,
      ),
    );
  }

  function handleDragStart(event: PointerEvent<HTMLElement>, item: PlacedWork) {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedId(item.id);
    dragRef.current = {
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      originalX: item.xMm,
      originalY: item.yMm,
    };
  }

  function handleDragMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    setLayout((current) =>
      current.map((item) => {
        if (item.id !== drag.id) {
          return item;
        }
        const position = clampWorkPosition(
          item,
          drag.originalX + (event.clientX - drag.startX) / SCREEN_PX_PER_MM,
          drag.originalY + (event.clientY - drag.startY) / SCREEN_PX_PER_MM,
        );
        return { ...item, ...position };
      }),
    );
  }

  function handleDragEnd(event: PointerEvent<HTMLElement>) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-[0.16em] text-slate-500">
              CUNSTONE · P4
            </p>
            <h1 className="text-2xl font-bold text-slate-950">A4 导出</h1>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              onClick={onBack}
              type="button"
            >
              返回作品列表
            </button>
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              onClick={onSignOut}
              type="button"
            >
              切换账号
            </button>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside
            aria-label="已添加作品列表"
            className="rounded-2xl border border-slate-300 bg-white p-4"
          >
            <h2 className="text-lg font-semibold text-slate-950">
              已添加作品列表
            </h2>
            <div className="mt-4 space-y-3">
              {works.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  尚未添加作品
                </p>
              ) : (
                works.map((work) => (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-2"
                    key={work.id}
                  >
                    <div className="h-16 w-16 shrink-0 rounded border border-slate-200 bg-slate-50">
                      <WorkPreviewCanvas
                        className="h-full w-full"
                        variant="binary"
                        work={work}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {work.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {workDimensionLabel(work)}
                      </p>
                    </div>
                    <button
                      aria-label={`移除作品 ${work.name}`}
                      className="text-xs text-red-700"
                      onClick={() => removeWork(work.id)}
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
              onClick={openAddDialog}
              type="button"
            >
              添加作品
            </button>
            <p className="mt-3 text-xs text-slate-500">
              共添加 {works.length} 件作品
            </p>
          </aside>

          <section className="min-w-0 rounded-2xl border border-slate-300 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                onClick={() => {
                  reflow(works);
                  setNotice("已重新自动排版。");
                }}
                type="button"
              >
                自动排版
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                disabled={!selectedId}
                onClick={rotateSelected}
                type="button"
              >
                旋转 90°
              </button>
              <label className="text-xs text-slate-600">
                水平间距 {spacing.horizontalGapMm} mm
                <input
                  aria-label="水平间距"
                  className="ml-2 w-28 accent-slate-900"
                  max={A4_PAGE.maxGapMm}
                  min={A4_PAGE.minGapMm}
                  onChange={(event) =>
                    changeSpacing("horizontalGapMm", Number(event.target.value))
                  }
                  type="range"
                  value={spacing.horizontalGapMm}
                />
              </label>
              <label className="text-xs text-slate-600">
                垂直间距 {spacing.verticalGapMm} mm
                <input
                  aria-label="垂直间距"
                  className="ml-2 w-28 accent-slate-900"
                  max={A4_PAGE.maxGapMm}
                  min={A4_PAGE.minGapMm}
                  onChange={(event) =>
                    changeSpacing("verticalGapMm", Number(event.target.value))
                  }
                  type="range"
                  value={spacing.verticalGapMm}
                />
              </label>
            </div>

            {notice ? (
              <p
                className="mt-3 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-800"
                role="status"
              >
                {notice}
              </p>
            ) : null}

            <div className="mt-4 overflow-auto bg-slate-200 p-5">
              <div
                aria-label="A4 排版预览"
                className="relative mx-auto bg-white shadow-lg"
                style={{
                  height: A4_PAGE.heightMm * SCREEN_PX_PER_MM,
                  width: A4_PAGE.widthMm * SCREEN_PX_PER_MM,
                }}
              >
                {displayedItems.map((item) => {
                  const work = works.find((candidate) => candidate.id === item.id);
                  if (!work) {
                    return null;
                  }
                  return (
                    <article
                      data-testid={`placed-work-${item.id}`}
                      key={item.id}
                      onPointerDown={(event) => handleDragStart(event, item)}
                      onPointerMove={handleDragMove}
                      onPointerUp={handleDragEnd}
                      style={{
                        height: item.heightMm * SCREEN_PX_PER_MM,
                        left: item.xMm * SCREEN_PX_PER_MM,
                        position: "absolute",
                        top: item.yMm * SCREEN_PX_PER_MM,
                        touchAction: "none",
                        width: item.widthMm * SCREEN_PX_PER_MM,
                      }}
                    >
                      <div
                        className={`relative h-full w-full cursor-move border ${
                          selectedId === item.id
                            ? "border-sky-600"
                            : "border-slate-300"
                        }`}
                        data-testid={`placed-work-${item.id}-inner`}
                        style={{ transform: `rotate(${item.rotationDeg}deg)` }}
                      >
                        <WorkPreviewCanvas
                          className="h-full w-full"
                          variant="binary"
                          work={work}
                        />
                        <CropMarks />
                        <span
                          className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[10px] text-slate-700"
                          style={{ transform: `translateX(-50%) rotate(-${item.rotationDeg}deg)` }}
                        >
                          {workDimensionLabel(work)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((value) => value - 1)}
                type="button"
              >
                上一页
              </button>
              <span className="text-sm text-slate-700">
                第 {pageIndex + 1} / {pageCount} 页
              </span>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                disabled={pageIndex >= pageCount - 1}
                onClick={() => setPageIndex((value) => value + 1)}
                type="button"
              >
                下一页
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <span className="text-xs text-slate-500">
                拖动作品调整位置；PDF 仅包含黑白稿，不包含红印效果。
              </span>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => setNotice("PDF 下载将在后续 Change 提供。")}
                type="button"
              >
                下载 PDF
              </button>
            </div>
          </section>
        </div>
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section
            aria-label="添加已完成作品弹窗"
            aria-modal="true"
            className="w-full max-w-3xl rounded-2xl border border-slate-300 bg-white p-5 shadow-xl"
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-950">
                添加已完成作品
              </h2>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                onClick={() => setAddOpen(false)}
                type="button"
              >
                取消
              </button>
            </div>
            {availableWorks.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                没有可添加的已完成作品
              </p>
            ) : (
              <div className="mt-4 grid max-h-[55vh] gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                {availableWorks.map((work) => (
                  <label
                    className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3"
                    key={work.id}
                  >
                    <input
                      aria-label={`选择作品 ${work.name}`}
                      checked={addSelected.has(work.id)}
                      className="mt-1 h-4 w-4 accent-slate-900"
                      onChange={() =>
                        setAddSelected((current) => {
                          const next = new Set(current);
                          if (next.has(work.id)) next.delete(work.id);
                          else next.add(work.id);
                          return next;
                        })
                      }
                      type="checkbox"
                    />
                    <div className="min-w-0">
                      <div className="h-24 w-24 rounded border border-slate-200 bg-slate-50">
                        <WorkPreviewCanvas
                          className="h-full w-full"
                          variant="binary"
                          work={work}
                        />
                      </div>
                      <p className="mt-2 truncate text-sm font-medium">{work.name}</p>
                      <p className="text-xs text-slate-500">
                        {workDimensionLabel(work)} · 已完成
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                onClick={confirmAddWorks}
                type="button"
              >
                确定
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function CropMarks() {
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t border-slate-500" />
      <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t border-slate-500" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-slate-500" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-slate-500" />
    </>
  );
}

function toLayoutInputs(works: readonly WorkRecord[]) {
  return works.map((work) => ({
    id: work.id,
    widthMm: work.imageState.widthMm,
    heightMm: work.imageState.heightMm,
  }));
}

function workDimensionLabel(work: WorkRecord): string {
  return work.imageState.shape === "circle"
    ? `Ø${work.imageState.widthMm} mm`
    : `${work.imageState.widthMm} × ${work.imageState.heightMm} mm`;
}
