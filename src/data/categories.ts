/**
 * 分类定义
 *
 * 每个分类对应一个「一级 tag」（见 TAGS.md）。
 * 首页与 /categories 共用这份定义，避免两处不一致。
 *
 * 注意：这里只放 TAGS.md 里的一级分类。
 * 细分标签（solana / mev / backend 等）走 /tags 页面，不在这里重复。
 */

export type CategoryMeta = {
  /** 对应的 tag slug */
  slug: string;
  name: string;
  icon: string;
  desc: string;
};

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: "web3",
    name: "Web3 实战",
    icon: "🔗",
    desc: "链上技术、DeFi、交易系统、MEV 等深度内容。",
  },
  {
    slug: "engineering",
    name: "工程方法",
    icon: "🛠",
    desc: "架构设计、系统优化、后端与交易系统的工程实践。",
  },
  {
    slug: "ai",
    name: "AI 时代",
    icon: "🤖",
    desc: "AI 工具、AI × 开发、AI × Web3。",
  },
  {
    slug: "thoughts",
    name: "思考随笔",
    icon: "💭",
    desc: "个人经历、行业观察、职业发展。",
  },
];
