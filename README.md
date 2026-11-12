# 猪猪 · 私密小空间微信小程序

一个面向情侣 / 家人的小范围私密空间小程序，基于 **uni-app (Vue 3)** 开发，后端使用 **微信云开发 (CloudBase)**：云数据库 + 云存储 + 云函数，无需自建服务器。

成员通过**邀请码**加入，第一位登录的用户自动成为管理员。

## 功能一览

| 模块 | 页面             | 说明                                                                       |
| ---- | ---------------- | -------------------------------------------------------------------------- |
| 首页 | `pages/home`     | 空间名、在一起天数、每日情话、各模块「上首页 / 置顶」内容聚合、功能入口    |
| 登录 | `pages/login`    | 首位用户初始化管理员；其他成员凭邀请码注册                                 |
| 菜谱 | `pages/menu`     | 分类与菜品管理、拖拽排序、点赞评论、一键点菜                               |
| 点菜 | `pages/orders`   | 订单列表，按日期 / 状态筛选，状态流转（待处理 → 烹饪中 → 已完成 / 已取消） |
| 心情 | `pages/status`   | 文字 + 心情 + 图片的动态，支持点赞评论                                     |
| 日志 | `pages/journal`  | 日志列表与详情、点赞评论                                                   |
| 旅行 | `pages/travel`   | 旅行计划，计划中 / 进行中 / 已完成                                         |
| 备忘 | `pages/memo`     | 彩色便签，置顶、上首页                                                     |
| 相册 | `pages/gallery`  | 分类相册，批量上传 / 移动 / 删除、网格拖拽排序                             |
| 经期 | `pages/period`   | 经期日历、周期预测、历史记录、提醒                                         |
| 成员 | `pages/members`  | （管理员）生成邀请码、设置管理员、移除成员                                 |
| 设置 | `pages/settings` | 昵称头像、空间名与纪念日、订阅通知、背景设置、清缓存                       |

除首页 / 登录 / 菜谱 / 点菜 / 设置外，其余页面均为**分包**加载（见 `pages.json`）。

## 技术栈

- uni-app 3 + Vue 3 `<script setup>` + Vite 5；`utils` 中的部分模块使用 TypeScript
- 目标平台：微信小程序（`mp-weixin`）
- 微信云开发：云数据库、云存储、云函数（`wx-server-sdk`）、订阅消息

## 目录结构

```
├── App.vue                 # 应用入口：云开发初始化、登录态检查、全局样式
├── main.js
├── pages.json              # 页面路由、分包、tabBar
├── manifest.json           # uni-app 配置（AppID、云开发开关）
├── project.config.json     # 微信开发者工具项目配置（云函数目录）
├── vite.config.js          # 构建后自动把 cloud/ 复制到输出目录
├── pages/                  # 各功能页面
├── components/page-bg/     # 页面背景组件（全局共享背景）
│                           # 页面私有子组件放在各页面目录的 components/ 下（menu / gallery / period）
├── tests/                  # 单元测试（Vitest）
├── utils/
│   ├── cloud.js            # 云开发封装：云函数调用(超时+重试)、上传、临时 URL、缓存、全局背景
│   ├── constants.ts        # 常量：心情、状态映射、配色、订阅模板 ID
│   ├── interactions.js     # 点赞 / 评论数据层
│   ├── useInteractions.js  # 点赞 / 评论 composable
│   ├── contentActions.ts   # 删除确认、上首页、加载失败提示
│   ├── useDragSort.ts      # 列表 / 网格拖拽排序
│   ├── usePeriodData.ts    # 经期记录与设置的加载、保存，日期工具
│   ├── usePeriodStats.ts   # 经期统计与预测
│   ├── types.ts            # 共享类型定义
│   └── useSubscription.js  # 订阅通知偏好
├── data/quotes.js          # 首页情话语录
├── static/tabbar/          # tabBar 图标
└── cloud/functions/        # 云函数
    ├── auth/               # 登录、邀请码、成员与角色管理
    ├── db/                 # 通用数据库代理（增删改查、批量查询、临时 URL、删除文件）
    ├── menu/               # 菜品列表、获取 openid
    ├── order/              # 点菜订单
    └── notification/       # 订阅消息发送
```

## 快速开始

### 1. 环境准备

- Node.js 18+
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 一个已开通**云开发**的微信小程序账号

### 2. 安装依赖并编译

```bash
npm install
```

本项目是 HBuilderX 风格的目录结构，源码在根目录而不在 `src/`，npm 脚本里已经通过 `UNI_INPUT_DIR` 指定了源码目录：

```bash
npm run dev
```

```bash
npm run build
```

`npm run dev` 是开发模式，带监听，输出到 `dist/dev/mp-weixin`；`npm run build` 是生产构建，输出到 `dist/build/mp-weixin`。这两个脚本使用 macOS / Linux 的环境变量写法，Windows 用户请用 HBuilderX 的「运行到小程序模拟器」。

### 代码检查与测试

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run format
```

GitHub Actions 会在每次推送时自动运行 Lint、格式检查、类型检查、单元测试、构建和云函数语法检查。

### 3. 用微信开发者工具打开

导入编译输出目录：命令行编译的输出在 `dist/dev/mp-weixin` 或 `dist/build/mp-weixin`，HBuilderX 编译的输出在 `unpackage/dist/dev/mp-weixin`。构建插件会自动把 `cloud/` 复制到输出目录，不包含本地 `node_modules`，云函数目录为 `cloud/functions/`。

### 4. 配置成你自己的项目

| 配置项          | 位置                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| 小程序 AppID    | `manifest.json` → `appid` 与 `mp-weixin.appid`；`project.config.json` → `appid`   |
| 云环境 ID       | `utils/cloud.js` → `CLOUD_ENV`                                                    |
| 订阅消息模板 ID | `cloud/functions/notification/templates.json`（云函数和客户端共用，只需改这一处） |

订阅模板的字段（`thing1/thing2/thing3`）需与公众平台中模板的关键词一致，见 `notification/index.js` 中的 `buildMsgData`。

### 5. 部署云函数

在微信开发者工具中，对 `cloud/functions/` 下的每个云函数右键 →「上传并部署：云端安装依赖」：`auth`、`db`、`menu`、`order`、`notification`。

云函数依赖 `wx-server-sdk ~3.0.4`，运行环境要求 Node.js 12 及以上（微信云开发默认的运行环境已满足）。`notification` 部署时要带上同目录的 `templates.json` 和 `messages.js`，`db`、`auth` 也要带上各自的 `rules.js`、`invite.js`（选择「上传所有文件」或「云端安装依赖」都会包含这些文件）。

`notification` 需要调用 `subscribeMessage.send`，如部署后报权限错误，请在云函数目录下添加 `config.json` 声明 openapi 权限。

### 6. 创建数据库集合

在云开发控制台 → 数据库中创建以下集合：

| 集合                                          | 用途                                             |
| --------------------------------------------- | ------------------------------------------------ |
| `authorized_users`                            | 已授权成员（openid、昵称、头像、角色、订阅偏好） |
| `invite_codes`                                | 邀请码                                           |
| `profiles`                                    | 空间资料（空间名、纪念日、背景、经期设置）       |
| `categories` / `dishes`                       | 菜谱分类 / 菜品                                  |
| `orders`                                      | 点菜订单                                         |
| `statuses` / `journals` / `travels` / `memos` | 心情 / 日志 / 旅行 / 备忘                        |
| `gallery_photos` / `gallery_categories`       | 相册照片 / 分类                                  |
| `periods`                                     | 经期记录                                         |
| `likes` / `comments`                          | 通用点赞 / 评论                                  |

云存储会使用 `dishes/`、`status/`、`travels/`、`gallery/`、`backgrounds/` 等目录。

### 7. 安全配置（必做）

客户端不直接读写云数据库，所有数据访问都经过带成员鉴权的云函数。请在云开发控制台 → 数据库 → 每个集合 → 数据权限中，选择「自定义安全规则」并填入：

```json
{ "read": false, "write": false }
```

这样即使有人绕过小程序前端，也无法直接读写数据库。云函数使用管理员权限访问，不受这条规则影响。

云函数的鉴权规则：

- `db`、`order`、`notification`，以及 `menu` 的 `listDishes`，只允许 `authorized_users` 中的成员调用；
- `db` 只能访问白名单中的业务集合，`authorized_users` 和 `invite_codes` 只能通过 `auth` 云函数操作；
- 点赞和评论的作者信息由服务端写入，只有作者本人或管理员可以删除。

### 8. 首次使用

第一个打开小程序的人会被初始化为**管理员**，之后在「设置 → 成员管理」中生成邀请码（7 天有效，每个最多 10 人使用，可随时撤销），其他人凭邀请码加入。
