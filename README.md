# 猪猪 · 私密小空间微信小程序

一个面向情侣 / 家人的小范围私密空间小程序，基于 **uni-app (Vue 3)** 开发，后端使用 **微信云开发 (CloudBase)**：云数据库 + 云存储 + 云函数，无需自建服务器。

成员通过**邀请码**加入，第一位登录的用户自动成为管理员。

## 功能一览

| 模块 | 页面             | 说明                                                                       |
| ---- | ---------------- | -------------------------------------------------------------------------- |
| 首页 | `pages/home`     | 问候与家人头像、在一起天数、每日一句、即将到来的日子、相册 / 心愿 / 胶囊卡片、功能入口、置顶内容、家人动态 |
| 登录 | `pages/login`    | 首位用户初始化管理员；其他成员凭邀请码注册                                 |
| 菜谱 | `pages/menu`、`pages/recipe` | 按菜系 / 餐别 / 标签筛选和搜索，分页加载；176 道世界各地精选菜谱 + 家里的菜；菜谱详情（食材清单、做法步骤）、编辑、点菜篮 |
| 点菜 | `pages/orders`   | 一次点一餐（选日期和早 / 午 / 晚 / 夜宵、份数、备注），按餐分组展示，整餐开始 / 完成，状态流转（待处理 → 烹饪中 → 已完成 / 已取消） |
| 心情 | `pages/status`   | 文字 + 心情 + 图片的动态，支持点赞评论                                     |
| 日志 | `pages/journal`  | 日志列表与详情、点赞评论                                                   |
| 旅行 | `pages/travel`   | 旅行计划，计划中 / 进行中 / 已完成                                         |
| 备忘 | `pages/memo`     | 彩色便签，置顶、上首页                                                     |
| 相册 | `pages/gallery`  | 分类相册，批量上传 / 移动 / 删除、网格拖拽排序                             |
| 经期 | `pages/period`   | 经期日历、周期预测、历史记录、提醒                                         |
| 成员 | `pages/members`  | 所有人可看家庭成员；管理员生成 / 撤销邀请码（失效的自动清理，也可一键清理）、设置管理员、移除成员 |
| 设置 | `pages/settings` | 昵称头像、空间名与纪念日、订阅通知、背景设置（预设色或家庭照片）、清缓存 |
| 纪念日 | `pages/anniversary` | 纪念日（已经 N 天）、倒数日、每年重复的生日 / 周年，可选图标和颜色，可显示在首页 |
| 心愿 | `pages/wish` | 家庭心愿清单，分类、完成进度，实现时有小烟花动效 |
| 时光胶囊 | `pages/capsule` | 写给未来的信，到开启日期前内容由云函数隐藏，到期后才能打开阅读 |

除首页 / 登录 / 菜谱 / 点菜 / 设置外，其余页面均为**分包**加载（见 `pages.json`）。

**管理员隐藏**：心情、日志、旅行、备忘、相册、心愿、纪念日、时光胶囊、菜谱里的内容，管理员都可以隐藏 / 取消隐藏。隐藏的内容由云函数直接过滤，其他成员完全看不到；管理员能看到并带「已隐藏」标签。

## 技术栈

- uni-app 3 + Vue 3 `<script setup>` + Vite 5
- 视觉：奶油杂志风设计系统（全局 CSS 变量与 `ui-*` 工具类定义在 `src/App.vue`，页面背景的柔光氛围由 `src/components/page-bg` 提供）。设置了照片背景时进入「照片背景模式」：照片清晰铺满，标题白字，卡片磨砂玻璃（页面根节点的 `photo-mode` 类，见 `App.vue` 末尾）
- 目标平台：微信小程序（`mp-weixin`）
- 微信云开发：云数据库、云存储、云函数（`wx-server-sdk`）、订阅消息

## 目录结构

```
├── src/                        # 小程序源码（uni-app 标准目录，所有页面、组件、图片都在这里）
│   ├── App.vue                 # 应用入口：云开发初始化、登录态检查、全局样式
│   ├── main.js
│   ├── pages.json              # 页面路由、分包、tabBar
│   ├── manifest.json           # uni-app 配置（AppID、云开发开关）
│   ├── uni.scss
│   ├── pages/                  # 各功能页面；页面私有子组件放在各页面目录的 components/ 下
│   ├── components/             # 全局组件：页面背景 page-bg、菜品封面 dish-cover（没有照片时按菜系显示占位）
│   ├── utils/                  # 云开发封装、常量、点赞评论、拖拽排序、菜谱与点菜篮（menu.js）、经期 / 纪念日计算等
│   ├── data/quotes.js          # 首页语录
│   └── static/                 # 图片等静态资源（tabBar 图标），编译时原样输出
├── cloud/functions/            # 云函数源码，开发者工具直接读取这里并部署
│   ├── auth/                   # 登录、邀请码、成员与角色管理
│   ├── db/                     # 通用数据库代理（增删改查、隐藏、批量查询、临时 URL、删除文件）
│   ├── menu/                   # 菜品分页筛选搜索、详情、分类计数、导入精选菜谱
│   │   ├── taxonomy.json       # 菜系 / 餐别 / 标签 / 餐次，小程序和云函数共用
│   │   └── recipes/            # 精选菜谱数据（每个文件一个数组）
│   ├── order/                  # 点菜订单
│   └── notification/           # 订阅消息发送（templates.json 与小程序共用）
├── dist/mp-weixin/             # 编译产物（npm run dev / build 都输出到这里，不提交）
├── project.config.json         # 微信开发者工具项目配置：小程序读 dist/mp-weixin/，云函数读 cloud/functions/
├── vite.config.js
└── package.json
```

**只改 `src/` 和 `cloud/functions/`，`dist/` 由编译生成。** 开发者工具打开的是项目根目录，小程序代码和云函数各读各的源目录，不需要手动拷贝任何文件。

## 快速开始

### 1. 环境准备

- Node.js 18+
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 一个已开通**云开发**的微信小程序账号

### 2. 安装依赖并编译

```bash
npm install
```

开发时运行（带监听，改了 `src/` 会自动重新编译）：

```bash
npm run dev
```

发布前运行（生产构建，压缩代码）：

```bash
npm run build
```

两个命令都输出到 `dist/mp-weixin/`。脚本使用 macOS / Linux 的环境变量写法。

### 3. 用微信开发者工具打开

在开发者工具中导入**项目根目录**（不是 `dist/`）。`project.config.json` 已指定小程序目录 `dist/mp-weixin/` 和云函数目录 `cloud/functions/`。

日常流程：

1. `npm run dev`，在开发者工具里预览调试；
2. 改了云函数：在开发者工具的 `cloud/functions/` 下右键该云函数 →「上传并部署：云端安装依赖」；
3. 发布：`npm run build`，然后在开发者工具里点「上传」。

### 4. 配置成你自己的项目

| 配置项          | 位置                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| 小程序 AppID    | `src/manifest.json` → `appid` 与 `mp-weixin.appid`；`project.config.json` → `appid` |
| 云环境 ID       | `src/utils/cloud.js` → `CLOUD_ENV`                                                |
| 订阅消息模板 ID | `cloud/functions/notification/templates.json`（云函数和客户端共用，只需改这一处） |

订阅模板的字段（`thing1/thing2/thing3`）需与公众平台中模板的关键词一致，见 `notification/index.js` 中的 `buildMsgData`。

### 5. 部署云函数

在微信开发者工具中，对 `cloud/functions/` 下的每个云函数右键 →「上传并部署：云端安装依赖」：`auth`、`db`、`menu`、`order`、`notification`。

云函数依赖 `wx-server-sdk ~3.0.4`，运行环境要求 Node.js 12 及以上（微信云开发默认的运行环境已满足）。`notification` 部署时要带上同目录的 `templates.json` 和 `messages.js`，`db`、`auth` 也要带上各自的 `rules.js`、`invite.js`（选择「上传所有文件」或「云端安装依赖」都会包含这些文件）。

`notification` 需要调用 `subscribeMessage.send`，如部署后报权限错误，请在云函数目录下添加 `config.json` 声明 openapi 权限。

### 6. 创建数据库集合

在云开发控制台 → 数据库中创建以下集合（`db` 云函数在集合不存在时，查询返回空列表、第一次新增时自动创建，所以漏建也不会报错）：

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
| `anniversaries`                               | 纪念日 / 倒数日                                  |
| `wishes`                                      | 心愿清单                                         |
| `capsules`                                    | 时光胶囊                                         |

云存储会使用 `dishes/`、`status/`、`travels/`、`gallery/`、`backgrounds/` 等目录。

### 7. 安全配置（必做）

客户端不直接读写云数据库，所有数据访问都经过带成员鉴权的云函数。请在云开发控制台 → 数据库 → 每个集合 → 数据权限中，选择「自定义安全规则」并填入：

```json
{ "read": false, "write": false }
```

这样即使有人绕过小程序前端，也无法直接读写数据库。云函数使用管理员权限访问，不受这条规则影响。

云函数的鉴权规则：

- `db`、`order`、`notification`，以及 `menu` 的菜品查询（`listDishes` / `getDish` / `facets`），只允许 `authorized_users` 中的成员调用；`menu` 的 `importBuiltin` 只允许管理员调用；
- 管理员隐藏的内容（`hidden: true`）在查询时直接过滤，非管理员查不到，也不能修改、删除；
- `db` 只能访问白名单中的业务集合，`authorized_users` 和 `invite_codes` 只能通过 `auth` 云函数操作；
- 点赞和评论的作者信息由服务端写入，只有作者本人或管理员可以删除。

### 8. 精选菜谱

`cloud/functions/menu/recipes/` 里的菜谱随 `menu` 云函数一起部署，部署后由管理员调用一次导入（在开发者工具调试器里执行 `wx.cloud.callFunction({ name: 'menu', data: { action: 'importBuiltin' } })`）。导入按每道菜的 `key` 判断，重复执行只会补上新加的菜，不会重复，也不会覆盖家里改过的内容。以后要加菜，往 `recipes/` 里追加数据、重新部署 `menu`、再导入一次即可。

菜品多了以后，建议在云开发控制台给 `dishes` 集合建索引：`sort_order`、`cuisine + sort_order`、`course + sort_order`、`order_count`。

### 9. 首次使用

第一个打开小程序的人会被初始化为**管理员**，之后在「设置 → 成员管理」中生成邀请码（7 天有效，每个最多 10 人使用，可随时撤销；生成新邀请码时会自动删除已过期 / 已撤销 / 已用完的），其他人凭邀请码加入。
