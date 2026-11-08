import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BrandHeader from "./BrandHeader";

describe("BrandHeader", () => {
  it("renders the inline logo, enlarged wordmark and page title", () => {
    render(<BrandHeader pageTitle="创作编辑" />);

    expect(screen.getByRole("img", { name: "CunStone Logo" })).toBeVisible();
    expect(screen.getByText("CUNSTONE")).toBeVisible();
    expect(screen.getByRole("heading", { name: "创作编辑" })).toBeVisible();
    expect(screen.queryByText(/P1|P2|P3|P4/)).not.toBeInTheDocument();
  });

  it.each(["登录 / 注册", "创作编辑", "作品列表", "A4 导出"])(
    "supports the page title %s",
    (pageTitle) => {
      render(<BrandHeader pageTitle={pageTitle} />);
      expect(screen.getByRole("heading", { name: pageTitle })).toBeVisible();
    },
  );
});
