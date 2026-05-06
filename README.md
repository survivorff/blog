# blog

survivorff 的技术博客。

🔗 [blog.frankfu.cloud](https://blog.frankfu.cloud)

基于 [AstroPaper](https://github.com/satnaing/astro-paper) 构建。

## 本地开发

```bash
pnpm install
pnpm dev
```

访问 `http://localhost:4321`

## 写作

在 `src/data/blog/` 下创建 `.md` 文件。Frontmatter 示例：

```yaml
---
author: survivorff
pubDatetime: 2026-05-06T00:00:00Z
title: 文章标题
slug: article-slug
featured: false
draft: false
tags:
  - 技术
description: 文章摘要
---
```

## 部署

Push 到 `main` 分支会自动部署到 GitHub Pages。

## 技术栈

- [Astro](https://astro.build/)
- [TailwindCSS](https://tailwindcss.com/)
- [AstroPaper](https://github.com/satnaing/astro-paper) 主题

## License

- 主题代码: MIT
- 文章内容: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
