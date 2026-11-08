import { useState } from "react";

import { navigate, useHashRoute } from "./app/router";
import EditorPage from "./pages/EditorPage";
import ExportWorksPage from "./pages/ExportWorksPage";
import WorksPage from "./pages/WorksPage";
import { readAppState } from "./lib/storage/appStorage";

export default function App() {
  const route = useHashRoute();
  const [initialRead] = useState(() => readAppState());
  const [storageNotice, setStorageNotice] = useState<string | null>(() => {
    if (initialRead.recovery === "reset-old-version") {
      return "旧版本本地数据已清空，已使用空白作品库启动。";
    }
    if (initialRead.recovery === "corrupt") {
      return "本地数据无法读取，已清空并使用空白作品库启动。";
    }
    return null;
  });

  if (route.name === "editor") {
    return (
      <EditorPage
        key={route.workId ?? "new"}
        onDismissStorageNotice={() => setStorageNotice(null)}
        onStartNew={() => navigate("/editor/new")}
        onOpenWorks={() => navigate("/works")}
        onOpenExport={() => navigate("/export/a4")}
        onWorkSaved={(workId) => navigate(`/editor/${workId}`)}
        storageNotice={storageNotice ?? undefined}
        workId={route.workId}
      />
    );
  }

  if (route.name === "works") {
    return (
      <WorksPage
        onEditWork={(workId) => navigate(`/editor/${workId}`)}
        onNewWork={() => navigate("/editor/new")}
        onOpenExport={() => navigate("/export/a4")}
      />
    );
  }

  if (route.name === "exportA4") {
    return (
      <ExportWorksPage onBack={() => navigate("/works")} />
    );
  }

  return null;
}
