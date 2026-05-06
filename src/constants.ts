import type { Props } from "astro";
import IconMail from "@/assets/icons/IconMail.svg";
import IconGitHub from "@/assets/icons/IconGitHub.svg";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
import IconWhatsapp from "@/assets/icons/IconWhatsapp.svg";
import IconFacebook from "@/assets/icons/IconFacebook.svg";
import IconTelegram from "@/assets/icons/IconTelegram.svg";
import IconPinterest from "@/assets/icons/IconPinterest.svg";
import { SITE } from "@/config";

interface Social {
  name: string;
  href: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
}

export const SOCIALS: Social[] = [
  {
    name: "GitHub",
    href: "https://github.com/survivorff",
    linkTitle: `${SITE.title} on GitHub`,
    icon: IconGitHub,
  },
  {
    name: "X",
    href: "https://x.com/FrankFu2262",
    linkTitle: `${SITE.title} on X`,
    icon: IconBrandX,
  },
] as const;

export interface Project {
  name: string;
  href: string;
  desc: string;
  icon: string;
  tags?: string[];
}

export const PROJECTS: Project[] = [
  {
    name: "meme-trade-wiki",
    href: "https://github.com/survivorff/meme-trade-wiki",
    desc: "一个 Meme 交易平台工程师写的行业内幕手册。覆盖市场格局、平台架构、链上机制、工程难题到黑暗面，共 8 章 41 篇。",
    icon: "🐸",
    tags: ["Solana", "Meme", "中文"],
  },
  {
    name: "web3-insider",
    href: "https://github.com/survivorff/web3-insider",
    desc: "On-chain tech explained by an exchange engineer. 从交易所视角深挖链上技术、DeFi 协议、安全事件。",
    icon: "🔍",
    tags: ["Web3", "EVM", "Solana"],
  },
] as const;

export const SHARE_LINKS: Social[] = [
  {
    name: "WhatsApp",
    href: "https://wa.me/?text=",
    linkTitle: `Share this post via WhatsApp`,
    icon: IconWhatsapp,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/sharer.php?u=",
    linkTitle: `Share this post on Facebook`,
    icon: IconFacebook,
  },
  {
    name: "X",
    href: "https://x.com/intent/post?url=",
    linkTitle: `Share this post on X`,
    icon: IconBrandX,
  },
  {
    name: "Telegram",
    href: "https://t.me/share/url?url=",
    linkTitle: `Share this post via Telegram`,
    icon: IconTelegram,
  },
  {
    name: "Pinterest",
    href: "https://pinterest.com/pin/create/button/?url=",
    linkTitle: `Share this post on Pinterest`,
    icon: IconPinterest,
  },
  {
    name: "Mail",
    href: "mailto:?subject=See%20this%20post&body=",
    linkTitle: `Share this post via email`,
    icon: IconMail,
  },
] as const;
