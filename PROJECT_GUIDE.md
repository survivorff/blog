# blog.frankfu.cloud 项目交接说明

> 一份给「接手维护这个博客的人 / AI 助手」的完整说明。读完这一篇，就能独立发文、配图、部署。

---

## 1. 这是什么

- **站点**：blog.frankfu.cloud —— survivorff 的技术博客（区别于个人生活博客 me.frankfu.cloud）
- **定位**：交易所工程师视角的链上技术与行业观察。EVM & Solana 双链，中文优先，填补中文技术内容空白。
- **视角**：从「建造者」视角写，不写币圈热点，只写技术和认知。
- **仓库**：github.com/survivorff/blog
- **框架**：[AstroPaper](https://github.com/satnaing/astro-paper) 主题（Astro + TailwindCSS），主题版本 5.5.1
- **部署**：push 到 `main` → GitHub Actions 自动 build & 部署到 GitHub Pages
- **作者**：survivorff / Frank，交易所后端工程师，11 年后端 + 4 年 Web3

## 2. 技术栈与环境

- 包管理：**pnpm**（有 `pnpm-lock.yaml`）
- 框架：**Astro 5**（`^5.16.6`）
- 样式：**TailwindCSS 4**（`@tailwindcss/vite`）
- 搜索：**Pagefind**（静态全文搜索，build 时生成并拷进 `public/`）
- OG 图：**satori + @resvg/resvg-js** 动态生成（`dynamicOgImage: true`）
- 代码高亮：shiki（`@shikijs/transformers`）
- 其它：dayjs、remark-toc、remark-collapse、slugify、sharp
- 语言：TypeScript
- 本地命令：
  - `pnpm install` 装依赖
  - `pnpm dev` 本地开发，访问 `http://localhost:4321`（长跑命令，验证时别用它阻塞）
  - `pnpm build` 构建：`astro check && astro build && pagefind --site dist && cp -r dist/pagefind public/`
  - `pnpm preview` 预览构建产物
  - `pnpm lint` eslint；`pnpm format` prettier

## 3. 文章怎么放

- 位置：`src/data/blog/<slug>.md`
- 文件名即 slug，URL 会是 `/posts/<slug>/`
- `_` 前缀的文件/目录会被忽略（如 `src/data/blog/_drafts/`）
- Frontmatter schema（定义见 `src/content.config.ts`）：
  ```yaml
  ---
  author: survivorff              # 可选，默认取 SITE.author
  pubDatetime: 2026-05-06T00:00:00Z   # ⚠️ 必填，date 类型（带时区）
  modDatetime:                    # 可选，修改时间
  title: 文章标题                 # 必填
  slug: article-slug              # 可选，不写则用文件名
  featured: false                 # 可选，是否首页精选
  draft: false                    # 可选，true 则不发布
  tags: [技术, Solana]            # 默认 ["others"]
  description: 文章摘要           # ⚠️ 必填，用于卡片和 OG 图
  ogImage:                        # 可选，图片或字符串
  canonicalURL:                   # 可选
  series:                         # 可选，系列导航
    name: Solana 深挖
    order: 1
  ---
  ```
- **系列文章**：同一 `series.name` 的文章会自动互相导航，用 `series.order` 排序。

> ⚠️ 迁移/换模型注意：技术博客用 `pubDatetime` / `tags`（数组）/ `slug`，跟 `me/` 生活博客的 `published` / `image` / `category` **字段完全不同**，别混。

## 4. 站点配置

- `src/config.ts` —— `SITE` 对象：站点标题、作者、描述、每页文章数（`postPerIndex: 4` / `postPerPage: 6`）、语言 `zh-CN`、时区 `Asia/Shanghai`、明暗主题、动态 OG 图开关等。
- `src/constants.ts` —— 三组常量：
  - `SOCIALS`：页脚社交链接（GitHub、X）
  - `PROJECTS`：项目展示（meme-trade-wiki、web3-insider）
  - `SHARE_LINKS`：文章分享按钮

## 5. 目录结构

```
blog/
├── src/
│   ├── config.ts            # 站点配置 SITE
│   ├── constants.ts         # SOCIALS / PROJECTS / SHARE_LINKS
│   ├── content.config.ts    # 内容集合 schema（最重要）
│   ├── data/blog/           # 所有文章 .md（_drafts/ 被忽略）
│   ├── components/          # 组件
│   ├── layouts/             # 布局
│   ├── pages/               # 路由页
│   ├── utils/ styles/ scripts/ assets/
├── public/                  # 静态资源、CNAME、favicon、pagefind
├── x-threads/               # 每篇文章配套的 X/Twitter thread 文案
├── docs/                    # 杂项文档（如 giscus 评论配置）
├── CONTENT_PLAN.md          # 内容战略与发布节奏
├── TAGS.md                  # 标签规划
├── astro.config.ts  package.json  tsconfig.json
├── Dockerfile  docker-compose.yml
```

## 6. 内容战略（详见 CONTENT_PLAN.md）

四象限内容矩阵：
- **Part 1 系列长文**（每月 2-4 篇）：《Solana 深挖》《Meme 交易平台拆解》《EVM vs Solana》等成系列的深度文章。
- **Part 2 深度分析**（每月 1-2 篇）：单篇深度，安全事件复盘、新协议解读、行业数据拆解。
- **Part 3 随笔/思考**（每 2-4 周 1 篇）：行业、方法论、职业观察。
- **Part 4 工具/技巧**（每月 1-2 篇）：小而精的实用内容。

素材主要改写自作者的 `meme-trade-wiki`（41 篇行业内幕）和 `web3-insider`（英文沉淀）两个仓库。每篇发布后配套一条 X thread（模板见 `x-threads/`）。

发布前自检清单在 CONTENT_PLAN.md 末尾（标题吸引力、独家视角、tags 2-4 个、description 能独立成句等）。

## 7. 发布流程

1. 写文章放 `src/data/blog/<slug>.md`，`draft: true` 先自检。
2. 确认发布 → `draft: false`。
3. `pnpm build` 本地验证（会跑 astro check + pagefind）。
4. commit + push 到 `main` → CI 自动部署到 GitHub Pages。
5. 发布后按 CONTENT_PLAN 的推广节奏发 X thread。

## 8. License

- 主题代码：MIT
- 文章内容：[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
