/**
 * 估算文章阅读时间
 *
 * 规则：
 * - 中文：约 300 字/分钟
 * - 英文：约 250 词/分钟
 * - 最少 1 分钟
 *
 * 通过检测中文字符数和英文词数，分别计算再相加
 */
export function getReadingTime(content: string): number {
  if (!content) return 1;

  // 去掉 Markdown 语法标记和代码块
  const cleanText = content
    .replace(/```[\s\S]*?```/g, "") // 代码块
    .replace(/`[^`]*`/g, "") // 行内代码
    .replace(/!\[.*?\]\(.*?\)/g, "") // 图片
    .replace(/\[.*?\]\(.*?\)/g, "") // 链接（保留文字）
    .replace(/[#*_~>\-|]/g, ""); // Markdown 符号

  // 中文字符数（CJK Unified Ideographs）
  const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;

  // 英文单词数
  const englishText = cleanText.replace(/[\u4e00-\u9fa5]/g, " ");
  const englishWords = englishText
    .split(/\s+/)
    .filter(w => /[a-zA-Z]/.test(w)).length;

  // 中文 300 字/分钟，英文 250 词/分钟
  const minutes = Math.ceil(chineseChars / 300 + englishWords / 250);

  return Math.max(1, minutes);
}
