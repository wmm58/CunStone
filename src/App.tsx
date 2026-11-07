import { useEffect, useState } from "react";

import { getActiveUser, signOut } from "./features/auth/authService";
import { navigate, useHashRoute } from "./app/router";
import EditorPage from "./pages/EditorPage";
import LoginPage from "./pages/LoginPage";
import WorksPage from "./pages/WorksPage";
import { readAppState, writeAppState } from "./lib/storage/appStorage";

export default function App() {
  const route = useHashRoute();
  const activeUser = getActiveUser();
  const [initialRead] = useState(() => readAppState());
  const storageNotice =
    initialRead.recovery === "corrupt"
      ? "本地数据无法读取，已使用空数据启动。"
      : initialRead.recovery === "unsupported-version"
        ? "本地数据版本不兼容，已使用空数据启动。"
        : initialRead.recovery === "migrated"
          ? "本地数据已升级到新版本。"
          : undefined;

  useEffect(() => {
    if (initialRead.recovery === "migrated") {
      try {
        writeAppState(initialRead.state);
      } catch {
        // 保留内存中的迁移结果，后续保存时继续尝试。
      }
    }
  }, [initialRead]);

  useEffect(() => {
    if (route.name !== "login" && !activeUser) {
      navigate("/login");
    }
  }, [activeUser, route.name]);

  if (route.name === "editor" && activeUser) {
    return (
      <EditorPage
        key={route.workId ?? "new"}
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
        onStartNew={() => navigate("/editor/new")}
        onOpenWorks={() => navigate("/works")}
        onWorkSaved={(workId) => navigate(`/editor/${workId}`)}
        workId={route.workId}
      />
    );
  }

  if (route.name === "works" && activeUser) {
    return (
      <WorksPage
        onEditWork={(workId) => navigate(`/editor/${workId}`)}
        onNewWork={() => navigate("/editor/new")}
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />
    );
  }

  return (
    <LoginPage
      onSuccess={() => navigate("/editor/new")}
      storageNotice={storageNotice}
    />
  );
}
