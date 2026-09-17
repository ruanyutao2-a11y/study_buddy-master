# 时习 · Web 学习平台

基于 [study_buddy](https://github.com/yunkst/study_buddy)（「时习」App）二次开发而成的**网页版个人学习平台**，保留纸感学术风，可直接部署为静态网站（GitHub Pages / Vercel / 任意静态托管）。

## 功能

| 模块 | 说明 |
|---|---|
| 🗂 知识点库 | 按分类沉淀知识点，附「引子—答案—关联」，掌握度标签、搜索、详情 |
| 🎯 间隔复习 | FSRS-4.5 遗忘曲线算法，四档自评（忘了/困难/良好/简单）自动排下次 |
| 💬 AI 问答 | 多轮对话、流式输出、Markdown + LaTeX 渲染、苏格拉底式启发教学 |
| ⏱ 专注打卡 | 一键计时、关联知识点、自动计入学习日报 |
| 📊 学习日报 | 按日翻页，专注时长 / 新增知识点 / 复习记录一目了然 |
| 👤 本地账号 | 注册 / 登录 / 切换账号，数据按账号隔离 |

## 技术栈

- Vite + React 18 + TypeScript
- React Router（Hash 路由，适配静态托管刷新）
- IndexedDB 本地存储（无需后端）
- marked + KaTeX（Markdown / 公式渲染）
- 自研 FSRS-4.5 调度器

## 本地开发

```bash
cd webapp
npm install        # 若遇到缓存权限问题：npm install --cache ./.npm-cache
npm run dev        # 启动开发服务器（终端会打印地址）
```

## 构建与本地预览

```bash
npm run build      # 产物输出到 dist/
npm run preview    # 或用 node serve.mjs 4173
```

`vite.config.ts` 中 `base: './'`，产物使用相对路径，因此部署到任意子路径（如 `https://<用户名>.github.io/<仓库名>/`）都能正常加载。

## 部署到 GitHub Pages

> 仓库已内置 `.github/workflows/deploy-pages.yml`，推送到 GitHub 后自动构建并部署，无需在本地构建。

1. 在 GitHub 新建（或推送现有）仓库，把整个项目（含 `webapp/` 与 `.github/workflows/deploy-pages.yml`）推上去：

   ```bash
   git init && git add -A
   git commit -m "feat: 时习 Web 学习平台"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```

2. 打开仓库 **Settings → Pages**，把 **Source** 选为 **GitHub Actions**。

3. 之后每次向 `main` 推送（或手动触发 Actions）都会自动部署。访问地址：`https://<你的用户名>.github.io/<仓库名>/`。

### 手动部署（可选）

若不用 GitHub Actions，也可本地构建后把 `dist/` 推到 `gh-pages` 分支：

```bash
cd webapp
npm run build
# 将 dist/ 目录内容提交到 gh-pages 分支（可用 gh-pages 等工具）
```

## 首次使用：配置 AI

进入网站后注册一个本地账号，然后在 **设置 → AI 配置** 填写你自己的 AI 接口：

- **接口地址**：填 `…/v1` 结尾的 Base URL，例如
  - DeepSeek：`https://api.deepseek.com/v1`
  - 月之暗面 Kimi：`https://api.moonshot.cn/v1`
  - 通义千问（OpenAI 兼容）：`https://dashscope.aliyuncs.com/compatible-mode/v1`
  - OpenAI：`https://api.openai.com/v1`
- **API 密钥**：对应服务商的后台申请 `sk-…`
- **模型名称**：例如 `deepseek-chat`、`moonshot-v1-8k`、`qwen-plus`（留空则用服务默认）

密钥只保存在你当前浏览器本地，不上传任何服务器。

> ⚠️ **跨域（CORS）说明**：本平台是纯静态站，AI 请求由浏览器直接发给服务商，因此服务商必须允许浏览器跨域调用。若「测试连接」提示 CORS 相关报错，请改用支持浏览器直连的服务商，或自行架设一个转发代理并填入其地址。DeepSeek、Moonshot 等多数国内服务商支持浏览器直连，OpenAI 官方接口默认不允许浏览器直连。

## 账号与数据说明

- **本地账号**：数据保存在浏览器 IndexedDB，按账号隔离，换设备/换浏览器数据不互通。
- **云端账号（Supabase）**：用邮箱注册/登录，登录态与学习数据可跨设备同步。

### 启用云端同步（Supabase）

跨设备同步需要先在 Supabase 建好业务表并开启 RLS：

1. 在 [supabase.com](https://supabase.com) 新建（或打开）项目。
2. 打开 **SQL Editor**，把仓库里的 `webapp/supabase_schema.sql` 整段粘贴执行 —— 会创建 6 张业务表（分类/知识点/复习记录/专注/聊天会话/消息）并为每张表开启 RLS（用户只能读写自己的数据）。
3. 在 **Project Settings → API** 复制 **Project URL** 与 **anon public key**。
4. 把它们填入本站「设置 → ☁️ 云端账号」（或直接写进 `src/lib/supabaseConfig.ts` 作为默认值）。
5. 之后在登录页用**邮箱**注册/登录，即自动开启跨设备同步。

> 建议在 **Authentication → Providers → Email** 中按需关闭「Confirm email」，否则新用户注册后需先查收邮件确认。

### 同步机制

- 采用「本地优先」：所有改动先写入浏览器 IndexedDB，再后台异步镜像到 Supabase；离线也能正常使用。
- 登录/启动时从云端拉取并按 `updatedAt` 合并，以较新者为准。
- 云端与本地字段通过 camelCase↔snake_case 自动映射（见 `src/lib/sync.ts`）。

## 品牌定制

改名称、标语、页脚，只需编辑 `src/lib/brand.ts`：

```ts
export const BRAND = {
  name: '时习',
  tagline: '学而时习之，不亦说乎。',
  title: '时习 · 学习平台',
  // ...
}
```

主题色在 `src/index.css` 顶部的 CSS 变量（`--seal`、`--paper`、`--ink`）中调整。

## 目录结构

```
webapp/
├── index.html
├── vite.config.ts
├── serve.mjs            # 本地静态预览脚本
├── src/
│   ├── main.tsx         # 入口
│   ├── App.tsx          # 路由
│   ├── index.css        # 纸感学术风主题
│   ├── lib/             # FSRS、AI 客户端、IndexedDB、Markdown、数据访问层
│   ├── store/           # 全局状态（账号 / 设置）
│   └── features/        # 各功能页面
└── dist/                # 构建产物（部署用）
```
