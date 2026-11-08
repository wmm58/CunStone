import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  createDefaultWorkImageState,
  type BackgroundRemovalRule,
  type WorkImageState,
} from "../../domain/types";
import BinaryPreparationPanel from "./BinaryPreparationPanel";
import InputEditingPanel from "./InputEditingPanel";

function rule(
  id: string,
  color: string | null = null,
  tolerance = 20,
): BackgroundRemovalRule {
  return { id, color, tolerance };
}

function InputHarness({
  initialRules = [],
  onUploadFile = vi.fn(),
  initialTool = "sample",
}: {
  initialRules?: BackgroundRemovalRule[];
  onUploadFile?: (file: File) => void;
  initialTool?: "sample" | "crop" | "perspective" | "eraser";
}) {
  const [rules, setRules] = useState(initialRules);
  const [activeTool, setActiveTool] = useState(initialTool);
  const [eraserSize, setEraserSize] = useState(24);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(
    initialRules[0]?.id ?? null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <output data-testid="rules">{JSON.stringify(rules)}</output>
      <output data-testid="active-rule">{activeRuleId ?? ""}</output>
      <output data-testid="active-tool">{activeTool}</output>
      <output data-testid="eraser-size">{eraserSize}</output>
      <InputEditingPanel
        activeRuleId={activeRuleId}
        activeTool={activeTool}
        busy={false}
        eraserSize={eraserSize}
        fileName="sample.png"
        inputRef={inputRef}
        onActivateRule={setActiveRuleId}
        onAddRule={() => {
          if (rules.length >= 10) {
            return;
          }
          const next = rule(`rule-${rules.length + 1}`);
          setRules((current) => [...current, next]);
          setActiveRuleId(next.id);
        }}
        onRemoveRule={(id) => {
          const next = rules.filter((item) => item.id !== id);
          setRules(next);
          if (activeRuleId === id) {
            setActiveRuleId(next[0]?.id ?? null);
          }
        }}
        onEraserSizeChange={setEraserSize}
        onRequestUpload={vi.fn()}
        onSelectTool={setActiveTool}
        onToleranceChange={(id, tolerance) =>
          setRules((current) =>
            current.map((item) =>
              item.id === id ? { ...item, tolerance } : item,
            ),
          )
        }
        onUploadFile={onUploadFile}
        rules={rules}
      />
    </>
  );
}

function BinaryHarness({
  initial = createDefaultWorkImageState(),
}: {
  initial?: WorkImageState;
}) {
  const [state, setState] = useState(initial);
  return (
    <>
      <output data-testid="binary-image-state">{JSON.stringify(state)}</output>
      <BinaryPreparationPanel
        busy={false}
        imageState={state}
        onRequestChange={setState}
        sourceAvailable
      />
    </>
  );
}

describe("Change 7 P2 tool panels", () => {
  it("renders only upload and background tools in image editing with one sampling hint", () => {
    render(<InputHarness initialRules={[rule("rule-1", "#ffffff", 20)]} />);

    expect(screen.getByRole("heading", { name: "上传图片" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "纯色背景去除" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "外形与尺寸" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "效果与适配" })).not.toBeInTheDocument();
    expect(
      screen.getAllByText("点击背景区域指定要移除的颜色"),
    ).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "手绘画布" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^\d{2}\s/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "上传图片图标" })).toBeVisible();
    expect(screen.getByRole("img", { name: "纯色背景去除图标" })).toBeVisible();
  });

  it("activates crop, perspective crop and image eraser tools", async () => {
    const user = userEvent.setup();
    render(<InputHarness />);

    expect(screen.getByRole("heading", { name: "裁剪" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "橡皮" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "裁剪" }));
    expect(screen.getByTestId("active-tool")).toHaveTextContent("crop");
    await user.click(screen.getByRole("button", { name: "透视裁剪" }));
    expect(screen.getByTestId("active-tool")).toHaveTextContent("perspective");
    await user.click(screen.getByRole("button", { name: "使用橡皮" }));
    expect(screen.getByTestId("active-tool")).toHaveTextContent("eraser");
    const size = screen.getByLabelText("图片橡皮大小");
    expect(size).toBeEnabled();
    fireEvent.change(size, { target: { value: "42" } });
    expect(screen.getByTestId("eraser-size")).toHaveTextContent("42");
  });

  it("adds up to ten background rules and disables the add button at the limit", async () => {
    const user = userEvent.setup();
    render(<InputHarness initialRules={Array.from({ length: 9 }, (_, index) => rule(`rule-${index + 1}`))} />);

    const add = screen.getByRole("button", { name: "添加待选颜色" });
    expect(add).toBeEnabled();
    await user.click(add);
    expect(screen.getAllByRole("button", { name: /^删除背景颜色规则/ })).toHaveLength(10);
    expect(add).toBeDisabled();
  });

  it("activates and removes color rows and keeps tolerances independent", async () => {
    const user = userEvent.setup();
    render(
      <InputHarness
        initialRules={[
          rule("rule-1", "#ffffff", 20),
          rule("rule-2", "#0000ff", 35),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "选择背景颜色规则 2" }));
    expect(screen.getByTestId("active-rule")).toHaveTextContent("rule-2");

    fireEvent.change(screen.getByLabelText("颜色 1 容差"), {
      target: { value: "60" },
    });
    const state = JSON.parse(screen.getByTestId("rules").textContent ?? "[]");
    expect(state).toEqual([
      expect.objectContaining({ id: "rule-1", tolerance: 60 }),
      expect.objectContaining({ id: "rule-2", tolerance: 35 }),
    ]);

    await user.click(screen.getByRole("button", { name: "删除背景颜色规则 2" }));
    expect(screen.getAllByRole("button", { name: /^删除背景颜色规则/ })).toHaveLength(1);
    expect(screen.getByText("#FFFFFF")).toBeVisible();
  });

  it("renders only shape and effect tools in binary preparation with three shapes", async () => {
    const user = userEvent.setup();
    render(<BinaryHarness />);

    expect(screen.getByRole("heading", { name: "外形与尺寸" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "效果与适配" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "上传图片" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "正方形" })).toBeVisible();
    expect(screen.getByRole("button", { name: "长方形" })).toBeVisible();
    expect(screen.getByRole("button", { name: "圆形" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "自定义" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "25 mm" })).not.toBeInTheDocument();

    const width = screen.getByLabelText("宽 (mm)");
    await user.clear(width);
    await user.type(width, "a2b0");
    expect(width).toHaveValue("20");
    await user.tab();
    expect(
      JSON.parse(screen.getByTestId("binary-image-state").textContent ?? "{}"),
    ).toMatchObject({ widthMm: 20 });
  });

  it("shows an outline thickness slider only for outline mode", async () => {
    const user = userEvent.setup();
    render(<BinaryHarness />);

    expect(screen.queryByLabelText("轮廓粗细")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "轮廓线稿" }));
    const slider = screen.getByLabelText("轮廓粗细");
    expect(slider).toHaveValue("1");
    fireEvent.change(slider, { target: { value: "8" } });
    expect(
      JSON.parse(screen.getByTestId("binary-image-state").textContent ?? "{}"),
    ).toMatchObject({ outlineThickness: 8, effectMode: "outline" });
  });

  it("adjusts sharpen amount and outer margin", () => {
    render(<BinaryHarness />);
    const sharpen = screen.getByLabelText("锐化大小");
    const margin = screen.getByLabelText("图片外边距");
    expect(sharpen).toHaveValue("1");
    expect(margin).toHaveValue("0");
    expect(margin).toHaveAttribute("step", "0.1");

    fireEvent.change(sharpen, { target: { value: "5" } });
    fireEvent.change(margin, { target: { value: "5.7" } });

    expect(
      JSON.parse(screen.getByTestId("binary-image-state").textContent ?? "{}"),
    ).toMatchObject({ sharpenAmount: 5, outerMarginMm: 5.7 });
    expect(screen.getByText("外边距 5.7 mm")).toBeVisible();
  });

  it("rejects dimensions outside 10-100 mm and links square width and height", async () => {
    const user = userEvent.setup();
    render(<BinaryHarness />);

    const width = screen.getByLabelText("宽 (mm)");
    const height = screen.getByLabelText("高 (mm)");
    await user.clear(width);
    await user.type(width, "9.9");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("尺寸需在 10–100 mm 之间");

    await user.clear(width);
    await user.type(width, "30");
    expect(height).toHaveValue("30");
    await user.tab();
    expect(
      JSON.parse(screen.getByTestId("binary-image-state").textContent ?? "{}"),
    ).toMatchObject({ widthMm: 30, heightMm: 30 });
  });
});
