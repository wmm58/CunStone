import "@testing-library/jest-dom/vitest";

// jsdom 不实现 Canvas 2D。默认返回 null 可覆盖异步清理等未显式安装
// Canvas mock 的路径；需要绘制断言的测试仍会安装带 spy 的上下文。
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: () => null,
});

class ResizeObserverMock implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  disconnect() {}

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: {
            width: 800,
            height: 600,
            top: 0,
            right: 800,
            bottom: 600,
            left: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          },
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      this,
    );
  }

  unobserve() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverMock,
});
