# Spec Delta

## MODIFIED Requirements

### Requirement: v0.1 全流程验收

系统必须（MUST）支持固定上传样本从直接进入创作编辑、创建作品、黑白编辑、保存、P3 管理和 P4 排版到 PDF 下载的完整无登录流程。

#### Scenario: 固定样本完成

- **WHEN** 使用固定上传样本走完整应用流程
- **THEN** 下载的 PDF 页面、尺寸、边框、标注和裁剪线符合要求

## REMOVED Requirements

### Requirement: 既有本地作品状态迁移

**Reason**：Change 8 不迁移 v1–v7 本地作品，旧数据允许直接清空。

**Migration**：不读取旧 PDF 相关作品状态；应用使用空的 v8 本地作品库，仅对上线后新作品提供 PDF 导出。
