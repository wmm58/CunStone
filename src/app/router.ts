import { useEffect, useState } from "react";

export type AppRoute =
  | { name: "login" }
  | { name: "works" }
  | { name: "exportA4" }
  | { name: "editor"; workId?: string };

export function parseRoute(hash: string): AppRoute {
  const path = hash.replace(/^#/, "") || "/login";

  if (path === "/editor/new" || path === "/editor") {
    return { name: "editor" };
  }

  if (path === "/works") {
    return { name: "works" };
  }

  if (path === "/export/a4") {
    return { name: "exportA4" };
  }

  const editMatch = /^\/editor\/([^/]+)$/.exec(path);
  if (editMatch) {
    return { name: "editor", workId: decodeURIComponent(editMatch[1]) };
  }

  return { name: "login" };
}

export function navigate(path: string): void {
  const nextHash = path.startsWith("#") ? path : `#${path}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

export function useHashRoute(): AppRoute {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);

    if (!window.location.hash) {
      navigate("/login");
    }

    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return parseRoute(hash);
}
