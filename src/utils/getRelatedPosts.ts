import type { CollectionEntry } from "astro:content";

/**
 * 根据 tag 相似度为当前文章找出相关文章
 *
 * 评分规则：
 *   - 同系列文章加高权重（更相关）
 *   - 每个共同 tag 加 1 分
 *   - 发布日期越近加少量权重
 */
export function getRelatedPosts(
  currentPost: CollectionEntry<"blog">,
  allPosts: CollectionEntry<"blog">[],
  limit = 3
): CollectionEntry<"blog">[] {
  const { id: currentId, data } = currentPost;
  const currentTags = new Set(data.tags || []);
  const currentSeries = data.series?.name;

  const scored = allPosts
    .filter(p => p.id !== currentId && !p.data.draft)
    .map(post => {
      const postTags = post.data.tags || [];
      const tagOverlap = postTags.filter(t => currentTags.has(t)).length;

      let score = tagOverlap;

      // 同系列的文章权重更高
      if (currentSeries && post.data.series?.name === currentSeries) {
        score += 5;
      }

      // 近期发布的文章微弱加权
      const daysSince =
        (Date.now() - new Date(post.data.pubDatetime).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSince < 30) score += 0.3;

      return { post, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.post);

  return scored;
}
