# Spec Delta

## Purpose

定义 CunStone 作为无需账号、无需后端和无需业务网络服务的单用户静态网页如何启动、导航和部署，确保用户打开 Gitee Pages 地址即可直接使用。

## ADDED Requirements

### Requirement: 无账号直接进入

应用必须（MUST）取消登录前置条件；打开站点根路径或旧登录路径时，直接进入创作编辑页。

#### Scenario: 根路径进入编辑页

- **WHEN** 用户首次打开站点且没有本地应用数据
- **THEN** 系统直接显示新建作品的创作编辑页，不展示登录或注册表单

#### Scenario: 旧登录地址重定向

- **WHEN** 用户打开旧 `#/login` 地址
- **THEN** 系统直接进入新建作品编辑页，不要求手机号或验证码

### Requirement: 未知路由回退

应用必须（MUST）在 Hash 路由无法识别时将用户带回新建作品编辑页，而不是显示登录页或空白页。

#### Scenario: 无效 Hash

- **WHEN** 用户打开不存在的应用 Hash 路径
- **THEN** 系统进入新建作品编辑页并保持应用外壳可用

### Requirement: 纯静态运行

应用运行时必须（MUST）只依赖随站点发布的静态资源；图片处理、localStorage 读写和 PDF 生成不得调用自建 API、数据库、外部 AI 或其他业务服务。

#### Scenario: 图片处理不联网

- **WHEN** 用户上传图片并完成裁剪、去底、黑白化和预览
- **THEN** 网络请求中不出现业务 API 或外部 AI 调用

#### Scenario: PDF 本地生成

- **WHEN** 用户下载 A4 PDF
- **THEN** PDF 由当前浏览器本地生成并下载，不依赖服务端

### Requirement: Gitee Pages 静态部署

生产构建必须（MUST）生成可直接部署到 Gitee Pages 的静态文件，并适配仓库子路径；Hash 路由刷新和静态资源加载不得依赖服务器重写规则。

#### Scenario: 子路径首次加载

- **WHEN** 应用部署在 Gitee Pages 的项目子路径下
- **THEN** HTML、JavaScript、CSS 和内置资源均能从该子路径正常加载

#### Scenario: Hash 路由刷新

- **WHEN** 用户在 `#/works` 或 `#/export/a4` 刷新页面
- **THEN** Gitee Pages 仍返回同一 HTML 入口，应用恢复对应页面

### Requirement: 不提供账号与远程管理

应用不得提供（MUST NOT）登录、注册、退出、切换账号、作品分享、公开作品库、服务端统计、远程权限管理或后台管理入口。

#### Scenario: 页面不出现账号操作

- **WHEN** 用户浏览创作编辑、作品列表和 A4 导出页
- **THEN** 页面不存在登录、退出、切换账号、分享或管理入口

#### Scenario: 不提供公开作品访问

- **WHEN** 用户查看应用内所有导航入口
- **THEN** 不存在生成公开作品链接、社区或云端作品库的入口
