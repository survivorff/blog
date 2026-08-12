/**
 * 系列（专题）注册表
 *
 * 文章的 frontmatter 里只写 `series.name` 和 `series.order`，
 * 系列本身的元信息（URL slug、简介、图标、所属赛道、连载状态）统一在这里维护，
 * 避免在每篇文章里重复。
 *
 * ⚠️ `name` 必须与文章 frontmatter 中的 `series.name` 完全一致，
 *    否则该系列不会被识别。可用 `pnpm build` 后的构建告警检查。
 */

export type SeriesStatus = "ongoing" | "completed";

export type SeriesMeta = {
  /** 必须与 frontmatter 的 series.name 完全一致 */
  name: string;
  /** URL slug，决定 /series/<slug>/ */
  slug: string;
  icon: string;
  /** 一句话简介，用于卡片与系列页 */
  desc: string;
  /** 所属赛道，用于分组展示 */
  track: string;
  status: SeriesStatus;
  /** 预计总篇数（连载中的系列用来显示进度）；不填则只显示已发布篇数 */
  planned?: number;
};

export const SERIES: SeriesMeta[] = [
  {
    name: "预测市场聚合器实战",
    slug: "prediction-market-aggregator",
    icon: "🎲",
    desc: "做 Polymarket + predict.fun 聚合器踩过的坑：事件对齐、跨链 adapter、价格归一化、结算不对称、收益型抵押品。",
    track: "交易系统",
    status: "ongoing",
  },
  {
    name: "Meme 交易平台深挖",
    slug: "meme-trading-platform",
    icon: "🧪",
    desc: "从交易所工程师视角拆解 Meme 交易的全链路：选链、交易生命周期、Jito/MEV、TG Bot、护城河与周期。",
    track: "交易系统",
    status: "completed",
  },
  {
    name: "Solana 后端视角",
    slug: "solana-backend",
    icon: "⚙️",
    desc: "写给传统后端工程师的 Solana：学习路线图、账户模型、以及没有 mempool 却依然存在的 MEV。",
    track: "链上开发",
    status: "ongoing",
  },
  {
    name: "Web3 Insider 中文版",
    slug: "web3-insider-cn",
    icon: "🔍",
    desc: "把英文深度研究搬回中文语境的单篇拆解，目前从 Hyperliquid 的架构开始。",
    track: "深度拆解",
    status: "ongoing",
  },
];

/** 赛道展示顺序 */
export const TRACK_ORDER = ["交易系统", "链上开发", "深度拆解"] as const;

export const getSeriesMeta = (name: string): SeriesMeta | undefined =>
  SERIES.find(s => s.name === name);
