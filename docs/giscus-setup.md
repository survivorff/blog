# Giscus 评论系统配置指南

## 为什么用 Giscus

- 完全免费
- 基于 GitHub Discussions，数据在你自己的仓库里
- 读者用 GitHub 账号登录就能评论
- 支持 Markdown、表情、图片
- 自带反垃圾

## 配置步骤

### 第一步：在博客仓库启用 Discussions

1. 打开 https://github.com/survivorff/blog/settings
2. 在 **Features** 区域找到 **Discussions**
3. 勾选启用

### 第二步：安装 Giscus GitHub App

1. 打开 https://github.com/apps/giscus
2. 点击 **Install**
3. 选择 `Only select repositories`
4. 只选择 `blog` 仓库
5. 点击 Install

### 第三步：创建评论分类（Category）

1. 打开 https://github.com/survivorff/blog/discussions
2. 点右边的 **Categories** → 进入管理页面
3. 确认有一个叫 `Announcements` 的分类（默认有的话就跳过）
4. 或者创建一个新分类，比如叫 `Comments`

### 第四步：获取配置参数

1. 打开 https://giscus.app/zh-CN
2. **仓库** 填：`survivorff/blog`
3. **页面 ↔ discussion 映射关系** 选：`pathname`
4. **Discussion 分类** 选：你在第三步选定的分类
5. 滚到下面 **启用此分类下的 discussion 创建功能** 要勾选
6. 页面会生成一段 `<script>` 代码，里面有两个关键参数：
   - `data-repo-id="..."` 
   - `data-category-id="..."`
   
### 第五步：更新代码

把 `src/components/Comments.astro` 里的两个占位符替换：

- 把 `REPO_ID_PLACEHOLDER` 替换为真实的 repo-id
- 把 `CATEGORY_ID_PLACEHOLDER` 替换为真实的 category-id

如果你改了分类名（不是默认的 Announcements），也要改 `data-category` 的值。

### 第六步：提交推送

```bash
git add -A
git commit -m "feat: enable giscus comments"
git push
```

等 GitHub Actions 部署完，每篇文章底部就会出现评论框。
