# application-shell-branding Specification

## Purpose
为 CunStone 的 P1–P4 建立统一、精致且可缩放的品牌头部，让 Logo、产品字标和当前页面名称形成稳定清晰的导航层级。

## Requirements

### Requirement: 高级感印章 Logo

Logo 必须（MUST）使用可缩放的内嵌 SVG，以“方形印面、负形刻痕、几何留白”为核心视觉语言，轮廓简洁、比例精致，并与页面标题保持清晰分隔和足够留白。

#### Scenario: Logo 高清缩放

- **WHEN** 页面在普通或高分辨率屏幕显示品牌头部
- **THEN** Logo 保持清晰边缘，不出现位图模糊或拉伸变形

#### Scenario: Logo 与字标组合

- **WHEN** 用户查看品牌头部
- **THEN** 印章图形位于 `CUNSTONE` 字标左侧，两者形成固定组合，页面名称位于组合右侧

#### Scenario: Logo 无障碍名称

- **WHEN** 用户或辅助技术识别品牌 Logo
- **THEN** Logo 暴露“CunStone Logo”或等价可读名称，而不是仅有无名称装饰图形

### Requirement: 删除角落页面编号

三个核心页面必须（MUST）删除原先角落中的 `CUNSTONE · P1`、`CUNSTONE · P2`、`CUNSTONE · P3`、`CUNSTONE · P4` 等文字，不得在其他位置继续常驻显示 P1/P2/P3/P4 页面编号。

#### Scenario: 页面不显示编号角标

- **WHEN** 用户依次访问创作编辑、作品列表和 A4 导出页
- **THEN** 页面中不出现 P1、P2、P3 或 P4 编号角标

#### Scenario: 页面名称替代编号

- **WHEN** 用户需要确认当前页面
- **THEN** 通过品牌头部右侧的中文页面名称识别，而不是通过 P 编号

### Requirement: 品牌头部响应式对齐

品牌头部必须（MUST）在桌面宽度下保持单行对齐，Logo、字标和页面名称不互相挤压；窗口变窄时可以整体换行，但不得隐藏 Logo 或页面名称。

#### Scenario: 桌面单行对齐

- **WHEN** 页面在桌面视口显示
- **THEN** Logo、`CUNSTONE` 和页面名称在同一行垂直居中对齐

#### Scenario: 窄屏换行

- **WHEN** 可用宽度不足
- **THEN** 品牌组合与页面名称可以换行排列，仍保持完整可见

### Requirement: P2–P4 统一品牌头部

创作编辑、作品列表和 A4 导出三个核心页面必须（MUST）使用相同的品牌头部结构：左侧显示内嵌 SVG 印章 Logo 和放大的 `CUNSTONE` 字标，右侧显示当前页面名称。

#### Scenario: 创作编辑页品牌头部

- **WHEN** 用户进入创作编辑页
- **THEN** 头部显示 Logo、`CUNSTONE` 和页面名称“创作编辑”

#### Scenario: 作品列表页品牌头部

- **WHEN** 用户进入作品列表页
- **THEN** 头部显示 Logo、`CUNSTONE` 和页面名称“作品列表”

#### Scenario: A4 导出页品牌头部

- **WHEN** 用户进入 A4 导出页
- **THEN** 头部显示 Logo、`CUNSTONE` 和页面名称“A4 导出”
