import { getReadingTime } from "./getReadingTime";

/**
 * Remark 插件：在 markdown 解析阶段计算阅读时间，
 * 并注入到文章的 frontmatter 中。
 *
 * 使用方式：
 *   const { remarkPluginFrontmatter } = await render(post);
 *   const minutes = remarkPluginFrontmatter.readingTime;
 */

// 自行实现 mdast 节点文本提取，避免额外依赖
function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { value?: string; children?: unknown[] };
  if (typeof n.value === "string") return n.value;
  if (Array.isArray(n.children)) {
    return n.children.map(extractText).join(" ");
  }
  return "";
}

// Astro 的 remark plugin 类型在各版本间略有不同，
// 这里用弱类型避免和 unified/mdast 耦合。
/* eslint-disable @typescript-eslint/no-explicit-any */
export function remarkReadingTime(): any {
  return function (tree: unknown, file: any) {
    const textOnPage = extractText(tree);
    const readingTime = getReadingTime(textOnPage);
    if (file?.data?.astro?.frontmatter) {
      file.data.astro.frontmatter.readingTime = readingTime;
    }
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
