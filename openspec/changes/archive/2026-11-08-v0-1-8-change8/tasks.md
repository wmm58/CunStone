# Tasks

## 1. 基线确认

- [x] 1.1 复核 `src/App.tsx`、`src/app/router.ts`、`src/features/auth/`、`src/features/works/workService.ts`、`src/lib/storage/appStorage.ts` 和 P2/P3/P4 页面，列出所有登录、账号、所有权和 `/login` 依赖；验证清单覆盖 `rg` 在非测试源码中的全部命中。
- [x] 1.2 在实现前运行 `npm test`、`npm run typecheck`、`npm run build` 和 `openspec validate --all --strict --no-interactive`；验证四条命令均通过并记录基线结果。
- [x] 1.3 对照蓝图 Change 8 与本 Change 的 10 个 capability，确认无账号入口、Gitee Pages、作品库 v8、旧数据清空和无后端边界均被覆盖；验证 proposal capabilities 与 `specs/` 目录一一对应。
- [x] 1.4 确认产品仍保留创作编辑、作品列表和 A4 导出三页；验证不新增分享页、社区页、结果页、后台页或登录页。

## 2. 路由与应用入口

- [x] 2.1 从 `AppRoute` 删除 `login` 分支，使空 Hash、根路径和未知 Hash 默认解析为 `{ name: "editor" }`；验证 `router.test.ts` 覆盖空值、`#/`、无效路径和旧 `#/login`。
- [x] 2.2 让旧 `#/login` 显式跳转或解析为 `#/editor/new`，保证旧书签不会显示登录页；验证直接打开 `#/login` 后地址和页面均进入新建作品编辑页。
- [x] 2.3 从 `App.tsx` 删除 `getActiveUser`、`signOut`、`activeUser` 守卫和登录 fallback，直接按路由渲染 P2、P3、P4；验证无本地数据时首屏为创作编辑页。
- [x] 2.4 删除 `LoginPage`、`authService` 及其测试文件，并移除 `FIXED_TEST_CODE`、手机号、验证码相关环境变量说明；验证 `rg "LoginPage|authService|FIXED_TEST_CODE" src` 无结果。
- [x] 2.5 删除 P2/P3/P4 的 `onSignOut` props 和 App 传入的回调；验证三个页面组件不再要求账号相关参数，类型检查通过。
- [x] 2.6 更新 `App.test.tsx` 和 `router.test.ts`，覆盖根入口、旧登录入口、作品列表和 A4 导出直达；验证任何入口都不会渲染登录/注册表单。

## 3. 领域类型与 localStorage v8

- [x] 3.1 从 `domain/types.ts` 删除 `LocalUser` 和 `WorkRecord.ownerId`，保留作品创建时间、最后保存时间、图片状态和黑白状态；验证作品类型不再包含账号字段。
- [x] 3.2 将 `AppState` 改为 `{ version: 8; works: WorkRecord[] }`，移除 `users` 和 `activeUserId`，并更新 `createEmptyAppState`、当前校验和写入逻辑；验证空状态和合法 v8 状态可稳定 round-trip。
- [x] 3.3 修改 `readAppState`：只接受 v8；检测到 v1–v7、旧键结构、非法同步数据或损坏 JSON 时清除应用存储并返回空 v8 状态；验证不抛异常、不保留旧作品。
- [x] 3.4 删除 v1–v7 全部迁移函数、旧版本接口和 `src/test/migrationFixtures.ts`；验证源码中不再存在 `migrateV1State` 到 `migrateV6State` 的调用链。
- [x] 3.5 更新 `appStorage.test.ts`，覆盖空库、合法 v8、v7 旧数据清空、损坏数据和重复读取；验证旧数据清除后 localStorage 为新 v8，且提示只出现一次。
- [x] 3.6 检查 `APP_STORAGE_KEY` 可继续复用，确保旧 key 被重置而不是留下未处理数据；验证浏览器中不残留 `users`、`activeUserId`、`ownerId` 字段。
- [x] 3.7 从领域类型和渲染分支删除历史 `drawing` 来源和 `broken` 边框兼容，只保留上传来源与无/单线/双线边框；验证生产源码不再出现旧来源或旧边框分支。
- [x] 3.8 删除历史手绘、残破边、粗线迁移相关组件分支和测试，并更新受影响的图片处理、黑白渲染与 PDF 测试；验证所有测试只使用 v8 新作品数据。

## 4. 本地作品服务与页面接入

- [x] 4.1 将作品服务函数收敛为 `createWork`、`updateWork`、`getWork`、`listWorks`、`listWorksByStatus`、`deleteWorks`，移除 `getActiveUser` 依赖和 `no-active-user` 错误；验证类型检查通过。
- [x] 4.2 更新 `workService.test.ts`，覆盖无账号创建、更新、按 ID 查询、列表排序、状态过滤、批量删除和未知 ID 忽略；验证无需登录即可完成全部作品操作。
- [x] 4.3 让 `EditorPage` 使用 `getWork` 加载作品，并将错误文案改为“作品不存在”或“本地数据不可用”；验证打开不存在 ID 时显示本地错误页且不出现账号归属提示。
- [x] 4.4 让 `WorksPage` 使用 `listWorksByStatus` 和 `deleteWorks`，删除“当前账号”查询和账号错误分支；验证全部作品、已完成、草稿筛选只依赖当前浏览器作品库。
- [x] 4.5 让 `ExportWorksPage` 使用 `listWorksByStatus("completed")` 提供可添加作品和初始化已添加作品；验证 A4 页面只按本地作品 ID 去重和添加。
- [x] 4.6 更新 P2/P3/P4 的测试 props，移除 `onSignOut` 和账号初始化；验证 `EditorPage.test.tsx`、`WorksPage.test.tsx`、`ExportWorksPage.test.tsx` 全部通过。
- [x] 4.7 确认 P2→P3、P3→P2、P2→P4、P3→P4、P4→P3 路由仍可用；验证导航测试不依赖登录状态或活动账号。

## 5. 页面文案与品牌壳

- [x] 5.1 删除 P2、P3、P4 中的“切换账号”“当前账号”和手机号展示；验证三个页面源码及 DOM 均无这些文案。
- [x] 5.2 将 P2 保存结果弹窗改为只提示当前浏览器保存范围，删除“本地账号仅用于区分作品”和权限隔离说明；验证草稿与已完成弹窗文案符合 spec。
- [x] 5.3 将未保存离开弹窗的触发说明限定为“作品列表”等内部导航，不再出现切换账号；验证继续编辑、保存草稿并继续、直接离开三条路径测试通过。
- [x] 5.4 增加旧数据重置的一次性非阻断提示，文案说明“旧版本本地数据已清空，已使用空白作品库启动”；验证提示出现一次、可关闭、不阻塞编辑。
- [x] 5.5 更新 `application-shell-branding` 相关测试，覆盖 P2/P3/P4 三个页面名称和品牌头，并确认无 P1、账号操作或 P 编号角标；验证 `BrandHeader.test.tsx` 通过。
- [x] 5.6 扫描 `src/` 非测试源码，确认不存在登录、注册、退出、切换账号、当前账号、owner 或“本地账号”产品文案；验证 `rg` 仅允许历史类型注释或明确迁移说明。

## 6. 静态构建与 Gitee Pages

- [x] 6.1 在 `vite.config.ts` 设置适合 Gitee Pages 项目子路径的相对资源基础路径（如 `base: "./"`），不写死仓库名；验证构建后的 `dist/index.html` 引用相对 `./assets/...`。
- [x] 6.2 保留 Hash 路由并验证 `#/editor/new`、`#/works`、`#/export/a4` 的刷新都只请求同一静态 HTML，不依赖 History API 回退。
- [x] 6.3 将 `dist/` 放在本地子路径静态服务器下打开，验证 HTML、JS、CSS、字体/内联资源和页面导航全部正常加载；记录测试 URL 与结果。
- [x] 6.4 构建后扫描 `dist/`，确认没有 `/api/`、业务后端 URL、`localhost` 或外部 AI 地址；验证应用可完全脱离 Vite 开发服务器运行。
- [x] 6.5 增加静态运行回归测试或脚本，检查根路径、旧登录路径、作品列表和 A4 导出在无服务端 API 时仍可打开；验证测试和构建命令均通过。
- [x] 6.6 在 README 增加 Gitee Pages 发布说明，写明 `npm run build`、`dist/` 部署、Hash 路由和子路径资源要求；验证按文档步骤可复现静态构建。

## 7. 测试、集成与数据边界

- [x] 7.1 更新 Change 1–7 集成测试，把固定登录 helper 替换为直接进入 `#/editor/new` 或写入 v8 本地作品；验证测试不再调用 `loginWithFixedCode`。
- [x] 7.2 增加无登录端到端验收：打开站点→上传图片→编辑→保存草稿→P3 预览/筛选→P4 排版→下载 PDF；验证全流程无账号步骤。
- [x] 7.3 增加同浏览器数据恢复测试：保存作品后刷新或重新渲染，作品仍存在；验证清除 localStorage 后应用回到空白作品库。
- [x] 7.4 增加独立浏览器数据测试：使用两个独立 Storage 测试上下文，分别创建作品；验证作品集合互不可见。
- [x] 7.5 增加旧数据重置测试：写入 v7 用户/作品状态后启动，验证 localStorage 被清空、无 `users`/`ownerId`、页面进入空白 P2。
- [x] 7.6 增加历史字段清理检查：确认旧 `drawing`、`broken`、粗线和旧账号数据不会进入 v8 作品库；验证旧数据被清空而不是转换。
- [x] 7.7 增加静态资源与路由验收：构建产物在子路径静态服务器中打开，验证 `#/works` 和 `#/export/a4` 刷新后仍能渲染。
- [x] 7.8 增加无后端扫描测试或 CI 检查，验证生产源码和构建产物不存在业务 `fetch`、API client、数据库或外部 AI 调用；验证 `rg` 无命中。
- [x] 7.9 运行完整 `npm test`、`npm run typecheck`、`npm run build` 和 `openspec validate --all --strict --no-interactive`；验证全部通过后再进入发布准备。

## 8. 文档、版本与发布准备

- [x] 8.1 更新 `README.md`：说明无登录、无后端、本地作品库、旧数据清空、Gitee Pages 部署、浏览器数据风险和明确不支持跨设备/分享。
- [x] 8.2 更新 `docs/engineering/engineering-baseline.md`：记录 v8 单用户结构、无账号路由、相对资源路径、Hash 路由和 localStorage 重置策略。
- [x] 8.3 更新蓝图和线框图：删除 P1 登录页、账号入口和账号文案，保留 P2/P3/P4 功能页标识并标明 Change 8 后的三页结构。
- [x] 8.4 将 `package.json` 和锁文件版本更新为 `0.1.8`；验证 `npm run build` 输出与版本一致。
- [x] 8.5 扫描最终产品源码、测试和文档，确认旧账号迁移承诺、登录入口和分享/远程管理文案已清理；验证 `git diff --check` 无格式问题。
- [x] 8.6 复核最终 diff，只包含 Change 8 的源码、测试、静态部署、文档、版本和 OpenSpec 文件；不提交 `.DS_Store`、不归档、不打 tag。

## Workflow follow-up

- 用户验收通过后归档 Change 8，更新蓝图队列状态和发布台账。
- 提交归档结果并创建与 `0.1.8` 一致的 annotated tag。
