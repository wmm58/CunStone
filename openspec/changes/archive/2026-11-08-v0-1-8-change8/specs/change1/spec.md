# Spec Delta

## REMOVED Requirements

### Requirement: 本地固定测试码登录与注册

**Reason**：Change 8 取消账号体系，应用无需登录即可使用。

**Migration**：删除登录页和固定测试码逻辑；用户打开应用后直接进入创作编辑页。

### Requirement: v0.1 不发送真实短信

**Reason**：产品不再提供验证码或任何短信流程。

**Migration**：删除验证码入口、环境变量和相关文案。

### Requirement: 无活动本地账号时阻止访问

**Reason**：单用户静态应用不存在活动账号守卫。

**Migration**：所有核心页面取消登录保护，直接访问当前浏览器本地作品库。

### Requirement: 登录后进入 P2

**Reason**：不存在登录成功动作。

**Migration**：应用根路径和旧登录路径直接进入 P2 创作编辑页。

### Requirement: 作品按本地账号区分

**Reason**：作品不再归属账号，当前浏览器只维护一套作品库。

**Migration**：删除用户与所有权字段；旧数据允许清空，不进行账号合并或迁移。

### Requirement: 用户可以创建并命名作品

**Reason**：作品生命周期要求迁移到无账号的 `local-work-library` 能力。

**Migration**：由 `local-work-library` 的“创建并命名作品”要求接替。

### Requirement: 保存草稿写入本地作品元数据

**Reason**：保存行为需要按单用户本地作品库重新定义。

**Migration**：由 `local-work-library` 的“保存草稿与已完成状态”要求接替。

### Requirement: 用户可以将作品保存为已完成

**Reason**：保存行为需要按单用户本地作品库重新定义。

**Migration**：由 `local-work-library` 的“保存草稿与已完成状态”要求接替。

### Requirement: 已保存作品可以恢复

**Reason**：恢复动作不再包含登录步骤。

**Migration**：由 `local-work-library` 的“同一浏览器恢复作品”要求接替。

### Requirement: 自动保存基础能力保留编辑

**Reason**：自动保存需要按单用户本地作品库重新定义。

**Migration**：由 `local-work-library` 的“本地自动保存”要求接替。

### Requirement: 作品状态支持草稿和已完成

**Reason**：状态行为合并到单用户保存要求。

**Migration**：由 `local-work-library` 的“保存草稿与已完成状态”要求接替。

### Requirement: 数据仅限当前浏览器和站点

**Reason**：浏览器本地数据边界由新的单用户能力完整定义。

**Migration**：由 `local-work-library` 和 `single-user-static-runtime` 的本地数据与静态运行要求接替。

### Requirement: Change 1 基础验收流程

**Reason**：原验收从登录开始，与 Change 8 无账号入口冲突。

**Migration**：改用 Change 8 的无登录完整流程验收。
