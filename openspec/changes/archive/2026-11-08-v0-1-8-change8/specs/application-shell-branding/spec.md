# Spec Delta

## REMOVED Requirements

### Requirement: P1–P4 统一品牌头部

**Reason**：Change 8 删除 P1 登录/注册页，产品只保留三个核心页面。

**Migration**：创作编辑、作品列表和 A4 导出页改用新的 P2–P4 品牌头部要求。

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: 删除角落页面编号

三个核心页面必须（MUST）删除原先角落中的 `CUNSTONE · P1`、`CUNSTONE · P2`、`CUNSTONE · P3`、`CUNSTONE · P4` 等文字，不得在其他位置继续常驻显示 P1/P2/P3/P4 页面编号。

#### Scenario: 页面不显示编号角标

- **WHEN** 用户依次访问创作编辑、作品列表和 A4 导出页
- **THEN** 页面中不出现 P1、P2、P3 或 P4 编号角标

#### Scenario: 页面名称替代编号

- **WHEN** 用户需要确认当前页面
- **THEN** 通过品牌头部右侧的中文页面名称识别，而不是通过 P 编号
