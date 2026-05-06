export const SITE = {
  website: "https://blog.frankfu.cloud/",
  author: "survivorff",
  profile: "https://github.com/survivorff",
  desc: "交易所工程师的技术博客 · EVM & Solana · 链上技术与行业观察",
  title: "survivorff's blog",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 6,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true,
  editPost: {
    enabled: false,
    text: "Edit page",
    url: "https://github.com/survivorff/blog/edit/main/",
  },
  dynamicOgImage: true,
  dir: "ltr",
  lang: "zh-CN",
  timezone: "Asia/Shanghai",
} as const;
