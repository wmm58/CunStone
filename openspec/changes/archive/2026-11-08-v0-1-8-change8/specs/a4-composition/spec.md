# Spec Delta

## ADDED Requirements

### Requirement: P4 单用户本地入口

A4 排版路由必须（MUST）无需登录即可访问，并从 P2、P3 接入；P3 只允许添加已完成作品，P2 当前有效作品必须先自动保存为已完成再进入 P4，空作品或保存失败不得进入。

#### Scenario: 从 P3 进入

- **WHEN** 用户在 P3 选择已完成作品并点击 A4 导出
- **THEN** 系统进入 P4 并带入所选作品

#### Scenario: 从已完成作品的 P2 进入

- **WHEN** 已完成作品在 P2 点击 A4 导出
- **THEN** 系统重新保存当前状态为已完成，然后进入 P4 并加入该作品

#### Scenario: 从编辑中的 P2 进入

- **WHEN** 草稿或新作品在 P2 有名称和可打印内容并点击 A4 导出
- **THEN** 系统先自动保存为已完成作品，再进入 P4 并加入该作品

#### Scenario: P2 空作品不能进入

- **WHEN** P2 当前作品没有可打印内容时点击 A4 导出
- **THEN** 系统停在 P2，显示“作品为空”且不进入 P4

#### Scenario: P2 保存失败不能进入

- **WHEN** P2 导出前的自动保存失败
- **THEN** 系统停在 P2、保留当前内容并显示保存失败提示

#### Scenario: 直接访问 P4

- **WHEN** 用户直接打开 `#/export/a4`
- **THEN** 系统显示当前浏览器本地作品库驱动的 A4 排版页，不跳转登录页

## MODIFIED Requirements

### Requirement: 添加作品弹窗

点击“添加作品”必须（MUST）打开弹窗，只展示当前浏览器作品库中已完成作品的名称和缩略图，支持多选并在确认后返回 P4。

#### Scenario: 多选添加

- **WHEN** 用户勾选多个已完成作品并点击确定
- **THEN** 弹窗关闭、作品加入列表并显示总数量

#### Scenario: 排除草稿和重复

- **WHEN** 系统展示或添加作品
- **THEN** 草稿不出现，已在列表中的作品不重复添加

## REMOVED Requirements

### Requirement: P4 登录保护与入口

**Reason**：Change 8 删除登录与活动账号，P4 不再有登录保护和账号入口。

**Migration**：改用无账号的 P4 本地入口，现有 A4 排版行为保持不变。
