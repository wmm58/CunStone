import "@testing-library/jest-dom/vitest";

// jsdom 不实现 Canvas 2D。默认返回 null 可覆盖异步清理等未显式安装
// Canvas mock 的路径；需要绘制断言的测试仍会安装带 spy 的上下文。
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: () => null,
});
