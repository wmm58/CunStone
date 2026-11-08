# Proposal

## Why

当前 v0.1.7 仍保留本地登录、账号归属和账号切换，虽然不需要后端，但让一个本来由个人在单浏览器使用的工具承担了不必要的身份与权限复杂度。Change 8 将产品收敛为纯静态单用户网页，直接部署到 Gitee Pages，打开网址即可使用。

## What Changes

- **BREAKING**：删除 P1 登录/注册页、手机号验证码流程、账号切换、退出登录和活动本地账号守卫。
- **BREAKING**：删除 `users`、`activeUserId` 和作品的 `ownerId`；当前浏览器只维护一套本地作品库。
- **BREAKING**：localStorage 升级为单用户 v8。旧 v1–v7 数据不要求迁移，可以直接清空并以空作品库启动。
- 应用根路径和旧 `#/login` 路径都直接进入 P2 创作编辑页；未知路由回退到新建作品页。
- P2、P3、P4 移除“切换账号”“当前账号”和账号安全说明，保留本地浏览器数据提示。
- 作品创建、保存、恢复、列表、删除、预览、A4 排版和 PDF 下载改为不依赖账号的本地作品库流程。
- Vite 使用适配 Gitee Pages 项目子路径的静态资源基础路径；导航继续使用 Hash 路由。
- 应用运行时不调用自建 API、数据库、服务器、外部 AI 或其他业务服务；图片处理和 PDF 仍在浏览器完成。
- 更新测试、README、工程基线、蓝图和线框图；不新增作品分享、云同步、统计、权限或远程管理。

## Capabilities

### New Capabilities

- `single-user-static-runtime`：无账号直接进入、纯静态运行、Gitee Pages 子路径部署、Hash 路由和无远程服务的运行时边界。
- `local-work-library`：单浏览器本地作品库、localStorage v8、作品创建/保存/恢复/删除，以及旧数据清空重开口径。

### Modified Capabilities

- `change1`：移除登录、短信验证码、活动账号、作品归属和账号切换要求，原有作品生命周期能力迁移到 `local-work-library`。
- `application-shell-branding`：品牌头部从登录/P2/P3/P4 四页收敛为创作编辑、作品列表和 A4 导出三页。
- `editor-workspace-controls`：移除账号相关保存说明、切换账号离开动作和旧版本迁移承诺，改为单用户本地数据提示。
- `editor-image-preparation`：移除历史手绘来源兼容和旧图片数据迁移验收，只保留 Change 8 上线后新上传图片的处理能力。
- `editor-binary-editing`：移除历史残破边、历史粗线和旧手绘基础稿兼容，只保留新的无/单线/双线边框和当前会话编辑能力。
- `work-list-preview`：移除登录保护和当前账号过滤，P3 直接管理当前浏览器的全部本地作品。
- `a4-composition`：移除登录保护和当前账号作品限制，P4 直接使用当前浏览器本地作品库中的已完成作品。
- `pdf-export`：全流程验收改为从无登录的创作编辑页开始，保留浏览器本地 PDF 生成口径。

## Impact

- 影响应用入口、Hash 路由、页面头部、P2/P3/P4 导航、作品服务、localStorage 结构、所有现有 Change 集成测试和本地数据恢复提示。
- 删除 `LoginPage`、`authService`、用户类型、账号相关 props 和账号依赖的工作查询函数。
- 影响 `vite.config.ts` 的静态资源基础路径和 Gitee Pages 部署说明。
- 旧本地作品允许丢失，不新增迁移代码、旧数据恢复、云端备份或跨设备同步。
- 不改变图片裁剪、透视、橡皮、多背景、黑白编辑、红印/黑白预览、A4 排版和 PDF 像素与尺寸规则。
