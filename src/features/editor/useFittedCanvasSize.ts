import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export function useFittedCanvasSize(aspectRatio: number, zoom = 1) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function update(width: number, height: number) {
      setAvailable((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    }

    if (typeof ResizeObserver === "undefined") {
      const rect = container.getBoundingClientRect();
      update(rect.width, rect.height);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) {
        update(box.width, box.height);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const measured = available.width > 0 && available.height > 0;
  const width = measured
    ? Math.min(available.width, available.height * aspectRatio) * zoom
    : null;
  const frameStyle: CSSProperties = measured
    ? {
        aspectRatio: `${aspectRatio}`,
        height: `${width! / aspectRatio}px`,
        width: `${width}px`,
      }
    : {
        aspectRatio: `${aspectRatio}`,
        height: "100%",
        width: "auto",
      };

  return { containerRef, frameStyle };
}
