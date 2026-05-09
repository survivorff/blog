---
author: survivorff
pubDatetime: 2026-06-03T10:00:00Z
title: MEV 在 Solana 上是怎么运作的：从三明治攻击到 Jito BAM
slug: mev-on-solana-explained
featured: false
draft: true
tags:
  - web3
  - solana
  - mev
  - deep-dive
description: 2025 年 Jito 从 MEV 里捕获了 7 亿美元。理解 MEV 是理解 Solana 交易世界的一把钥匙。
---

## MEV 不是 Solana 独有的问题

MEV（Maximal Extractable Value）是每条公链都面临的**结构性问题**：谁控制交易排序，谁就能提取额外价值。

但 Solana 的 MEV 玩法和以太坊完全不同。理解这些差异，是做 Solana 交易系统的前提。

---

## 先理解一个核心事实：Solana 没有 mempool

以太坊：
- 有公开 mempool
- 你的交易进 mempool 后，所有人都能看到
- MEV 搜索者从 mempool 扫有利可图的交易

Solana：
- 没有公开 mempool
- 交易直接转发到当前 slot 的 Leader
- 理论上只有 Leader 和少数近端节点能看到未确认的交易

这个差异让 Solana 的 MEV 攻击面**本来应该**更小。但事实上……

---

## 现实：MEV 还是大规模存在

2025 年数据：
- Solana MEV 捕获总量：**$720M+**
- 其中三明治攻击造成的用户损失：**~$500M（16 个月）**

为什么 Solana 没 mempool 但还是有这么多 MEV？

答案：**验证者本身就是 MEV 提取者**。

具体机制：

1. 交易广播到 Leader 节点
2. Leader 节点本身（或其合作伙伴）运行 MEV 搜索软件
3. 搜索软件分析流入的交易，找出可获利机会
4. 在 Leader 自己的交易池里，插入攻击交易
5. 打包进区块

**用户的交易从未"公开"，但 Leader 内部已经知道了。**

---

## Jito 的出现改变了格局

2022 年 Jito 出现，把 MEV 这件事从"潜规则"变成"公开拍卖"。

Jito 做的事：

1. **Jito-Solana 客户端**：修改版验证者软件，支持 Bundle 处理
2. **Block Engine**：接收 Bundle 提交，按 Tip 排序，转发给 Leader
3. **Bundle**：打包多笔交易，保证原子性和顺序

**关键洞察：** Jito 没有消除 MEV，而是让 MEV 变得公开、可定价。

现在 MEV 搜索者通过 Jito 提交 Bundle，和验证者共享利润。结果：
- 95% 的 Solana 验证者运行 Jito 客户端
- MEV 活动变得"规范化"
- 但三明治攻击仍然存在

---

## 三明治攻击的具体机制

```
用户 Alice 提交：买入 Token X（愿意接受 5% 滑点）
  │
  ▼
攻击者看到这笔交易（通过 Jito Block Engine 或直接运行验证者）
  │
  ▼
攻击者构建 Bundle：
  [1] 攻击者先买入 Token X（推高价格）
  [2] Alice 的交易（以更高的价格成交，比如 4% 滑点）
  [3] 攻击者立即卖出（获利）
  │
  ▼
攻击者付高 Tip，Bundle 获得执行优先权
```

**Alice 的损失**：以接近滑点上限的价格成交，损失约 3-4%。
**攻击者的收益**：Bundle 内套利 - Tip - Gas - 攻击者的买卖成本 = 净利润。

---

## 防护机制的演进

### 第 1 代：滑点保护

原始做法：用户设小滑点（比如 1%）。

问题：流动性差的 Token 可能根本成交不了；攻击者精确算到容忍度下手，用户依然损失。

### 第 2 代：Jito DontFront

2024 年 Jito 推出的功能：

```
Bundle {
  [1] 用户的买入交易（with DontFront）
}
```

Block Engine 保证：**这个 Bundle 的交易前面不能插入其他交易**。

效果：
- 直接防御前向插入
- 2025 年三明治攻击下降 **93%**
- 用户损失减少约 $3 亿

但 DontFront 不是完全免费的：
- 需要通过 Jito Bundle 提交（比直接 RPC 慢 50-100ms）
- 需要付 Jito Tip
- 某些边缘情况还是会被攻击（复杂的多跳交易）

### 第 3 代：Jito BAM

**Block Auction Marketplace**，Jito 2025 年推出的新机制。

核心思想：不是禁止 MEV，而是让 MEV **价值回流给用户**。

工作方式：
- 用户提交交易时，可以指定"我愿意分享 X% 的 MEV 给 searcher"
- Block Engine 把这笔交易挂拍卖，搜索者竞价
- 赢家获得 MEV，但必须把一部分返给用户（rebate）
- 用户最终获得比普通提交更好的价格

这是生态向"MEV-as-a-Service"演进的关键一步。

---

## 套利：有益的 MEV

不是所有 MEV 都是坏的。**套利是有益的**。

常见套利场景：
- Token X 在 Raydium 是 $0.10，在 PumpSwap 是 $0.12
- 套利者通过 Bundle 同时买入 Raydium / 卖出 PumpSwap
- 结果：两边价格拉平，市场变有效

套利者赚差价，但用户也受益：
- 更一致的市场价
- 更高的流动性
- 更低的整体滑点

这就是 Solana 生态对"atomic arbitrage"相对宽容的原因。

---

## 对普通用户的实用建议

如果你是普通 Meme 交易者，这些能帮你减少损失：

### 1. 使用 MEV 保护的平台

Axiom、GMGN 等主流平台默认通过 Jito Bundle + DontFront 提交，基本不会被三明治。

**如果你的平台没说自己用了 Jito Bundle，大概率是直接提交，有被夹的风险。**

### 2. 滑点别设太高

默认用户设的 10-20% 滑点，给了攻击者足够的利润空间。**5% 是合理的上限**。

大额交易甚至可以用 2-3%（但可能失败率上升）。

### 3. 大额交易拆分

100 SOL 一次性买入，攻击者能赚 3-5 SOL。
拆成 10 笔 10 SOL，每笔只能赚 0.3-0.5 SOL，攻击者可能觉得不值。

### 4. 小心"定制路由"

有些平台提供"最优路由"，实际可能走了滑点更大的路径。看清楚每一笔路径。

---

## 对开发者的建议

如果你在做交易相关的产品：

### 1. 默认用 Jito Bundle

不要让用户自己选"是否启用 MEV 保护"。默认开启，极少数场景（追求极致速度的狙击）才关掉。

### 2. 动态计算 Tip

- 太低：Bundle 不被打包
- 太高：吃用户利润

我的经验值（2026）：
- 正常交易：0.001-0.003 SOL
- 大额（>$1000）：0.005-0.01 SOL
- 狙击：0.01-0.1 SOL（看热度）

### 3. 透明展示 MEV 成本

向用户展示：
- 这笔交易的 Priority Fee + Jito Tip
- 预计滑点
- 最终成交价和预期价的偏差

透明度是建立信任的基础。

### 4. 关注 BAM

Jito BAM 2026 年逐步成熟，对"追求最优执行"的平台来说是机会。早期集成能给用户比竞争对手更好的价格。

---

## 结论

MEV 是 Solana 上的百亿美元市场。它不会消失，但会继续演进：
- 从"暴力提取"演进到"规则竞价"（Jito Block Engine）
- 从"零和游戏"演进到"价值分享"（Jito BAM）
- 从"用户被收割"演进到"用户参与分享收益"

作为开发者和用户，理解 MEV 不是为了抵御它，而是为了**合理参与进去**。

---

_更多 Solana 深度内容：[订阅 RSS](/rss.xml) 或 [关注 X](https://x.com/FrankFu2262)。_
