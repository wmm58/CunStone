# Spec Delta

## ADDED Requirements

### Requirement: Change 2 单用户基础验收流程

系统必须（MUST）支持无账号用户从图片上传、通过多条背景颜色规则去底到保存并恢复纯黑白基础稿的完整本地流程。

#### Scenario: 上传图片完整流程

- **WHEN** 用户上传固定多色背景样本，选择外形和尺寸，添加多条背景规则，分别调整容差，选择剪影并保存
- **THEN** 系统生成无灰色黑白稿，并在同一浏览器重新打开后恢复图片、规则、容差和效果

## REMOVED Requirements

### Requirement: 历史手绘作品兼容

**Reason**：Change 8 不迁移旧 v1–v7 数据，允许删除当前浏览器中的历史手绘来源作品。

**Migration**：不读取旧 drawing 作品；应用以空的 v8 本地作品库启动。

### Requirement: Change 2 基础验收流程

**Reason**：原验收包含升级前手绘作品的读取与导出兼容，与 Change 8 的旧数据清空策略冲突。

**Migration**：由新增的“Change 2 单用户基础验收流程”接替，仅验收 Change 8 上线后的新上传图片。
