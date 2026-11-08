# pdf-export Specification

## Purpose
让用户把 P4 当前 A4 排版即时生成并下载为页面尺寸正确、仅含黑白印稿、带实际尺寸与裁剪线的 PDF。

## Requirements

### Requirement: P4 真实下载 PDF

P4 必须（MUST）提供“下载 PDF”操作；按钮在存在作品时生成并下载 PDF。

#### Scenario: 下载有效 PDF

- **WHEN** P4 中至少有一件作品且用户点击“下载 PDF”
- **THEN** 浏览器下载一个可打开的 `.pdf` 文件

#### Scenario: 空排版

- **WHEN** P4 没有作品
- **THEN** 系统不生成空 PDF，并提示用户先添加作品

### Requirement: A4 页面尺寸

PDF 每页必须（MUST）使用 A4 纵向尺寸 210×297 mm，并与 P4 页数一致。

#### Scenario: 单页 PDF

- **WHEN** 排版只有一页
- **THEN** PDF 包含一个 A4 页面

#### Scenario: 多页 PDF

- **WHEN** 排版自动生成多页
- **THEN** PDF 包含相同数量的 A4 页面

### Requirement: 1:1 实际尺寸

PDF 中每枚作品必须（MUST）按 P4 的毫米位置和实际宽高放置；旋转作品必须按最后旋转角度输出。

#### Scenario: 毫米尺寸

- **WHEN** 生成 25×25 mm 方形印章
- **THEN** PDF 中该图像宽高对应 25×25 mm

#### Scenario: 旋转输出

- **WHEN** P4 作品旋转 90°、180° 或 270°
- **THEN** PDF 使用相同旋转方向和位置

### Requirement: 仅黑白稿

PDF 中必须（MUST）只包含最终黑白印稿，不包含红印效果、灰色或背景纹理。

#### Scenario: 使用已保存编辑状态

- **WHEN** 作品包含手动修整、阴阳刻、镜像和边框
- **THEN** PDF 使用最终保存的黑白像素和边框

### Requirement: 尺寸标注与裁剪线

每枚作品必须（MUST）在 PDF 中包含实际尺寸文字和四角裁剪线。

#### Scenario: 方章与圆章

- **WHEN** 作品为方章、长方章或圆章
- **THEN** PDF 显示对应尺寸文本和四角裁剪线

### Requirement: 多页输出

系统必须（MUST）按 P4 的临时分页输出 PDF，不重新丢失已手动调整的页内位置。

#### Scenario: 多页作品

- **WHEN** P4 有两页及以上
- **THEN** 每页作品出现在对应 PDF 页面中

### Requirement: 下载即时生成且不存档

PDF 必须（MUST）在浏览器本地即时生成并下载，不保存 PDF 历史、导出记录或排版数据。

#### Scenario: 刷新后无 PDF 历史

- **WHEN** 用户下载 PDF 后刷新页面
- **THEN** 系统没有 PDF 文件历史或导出记录可恢复

### Requirement: 不使用服务端或外部 AI

PDF 生成必须（MUST）完全在浏览器本地完成，不调用 API、服务端、数据库或外部 AI。

#### Scenario: 本地导出

- **WHEN** 用户生成 PDF
- **THEN** 不发起业务 API 或外部 AI 请求

### Requirement: v0.1 全流程验收

系统必须（MUST）支持固定上传样本从直接进入创作编辑、创建作品、黑白编辑、保存、P3 管理和 P4 排版到 PDF 下载的完整无登录流程。

#### Scenario: 固定样本完成

- **WHEN** 使用固定上传样本走完整应用流程
- **THEN** 下载的 PDF 页面、尺寸、边框、标注和裁剪线符合要求
