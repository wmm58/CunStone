# CunStone v0.1 工程基线

- 日期：2026-11-08
- 状态：Change 8 已实现
- 适用范围：CunStone v0.1.8 纯静态单用户网页

产品行为以蓝图和对应 OpenSpec Change 为准；本文记录当前工程口径。

## 1. 技术栈与运行方式

- 构建：Vite
- 界面：React + TypeScript
- 样式：Tailwind CSS
- PDF：`pdf-lib`，全部在浏览器本地执行
- 测试：Vitest + Testing Library
- 部署：Gitee Pages 静态托管
- 路由：Hash 路由
- 静态资源基础路径：`./`

应用不包含登录、账号、后端服务、数据库、业务 API、服务端统计或外部 AI。图片解码、去底、黑白处理、localStorage 和 PDF 生成均在浏览器完成。

## 2. 本地数据

- 唯一持久化方式：当前浏览器站点的 localStorage。
- 存储键：`cunstone:v0.1:app-state`。
- 当前结构：`{ version: 8, works: WorkRecord[] }`。
- 不存在 `users`、`activeUserId`、手机号或作品 `ownerId`。
- 当前浏览器只有一个本地作品库，所有作品对当前浏览器使用者可见。
- 不支持跨浏览器、跨设备、无痕会话或云同步。
- 清除站点数据后作品不可恢复。

作品图片状态保存 `sourceKind`、`sourceDataUrl`、外形、宽高、背景颜色规则、效果类型、1–8 级轮廓粗细、0–8 锐化、0–20 mm 外边距、1–80 图片橡皮大小和 `processingVersion: 5`。

作品黑白状态保存压缩覆盖层、画笔大小、橡皮大小、阴阳刻、方向、无/单线/双线边框、1–8 级边框粗细、0–20 mm 边框外边距和 `editVersion: 4`。

不保存最终黑白 PNG、撤销/重做历史、PDF 文件或导出历史。

## 3. 旧数据重置

- Change 8 不迁移 v1–v7 数据。
- 检测到旧版本、损坏或不符合 v8 结构的数据时，直接删除应用存储键。
- 应用以空 v8 作品库启动，可显示一次性提示。
- 旧用户、旧作品、旧 `drawing` 来源、残破边、粗线和旧手动覆盖层均不恢复。
- 不提供旧数据备份、修复或回滚入口。

## 4. 静态部署要求

- `npm run build` 生成 `dist/`。
- `dist/index.html` 必须使用 `./assets/...` 相对资源路径。
- Hash 路由刷新只请求同一静态 HTML，不依赖 History API 回退。
- Gitee Pages 项目子路径下必须能加载 HTML、JS、CSS 和内置资源。
- `npm run check:runtime` 扫描生产源码和构建产物，拒绝业务 API、外部 AI、`apiKey` 和根绝对资源路径。

## 5. 回滚限制

- v0.1.7 及以前代码不能读取 v8 单用户数据。
- 回滚前应清空当前站点 localStorage。
- 回滚后旧作品不会恢复；Change 8 明确接受旧数据丢失。

## 6. 基线验收

- 根路径、旧 `#/login`、未知路径均进入创作编辑页，不出现登录表单。
- 创作编辑、作品列表和 A4 导出三页可无账号直接访问。
- 当前浏览器作品库可创建、保存、恢复、筛选、预览、删除和导出 PDF。
- localStorage v8 不包含用户或所有者字段。
- v1–v7 数据会安全清空并进入空作品库。
- 不同浏览器使用各自独立 localStorage 作品库。
- 构建产物在 Gitee Pages 风格子路径下可正常加载和刷新。
- 不发起业务 API 请求，不依赖后端、数据库或外部 AI。
