---
author: Frank Fu
pubDatetime: 2026-05-22T09:15:52+08:00
title: 为什么 Hyperliquid 赢了链上 perp:一个交易所工程师的架构拆解
slug: hyperliquid-architecture-breakdown
featured: true
draft: false
tags:
  - hyperliquid
  - defi
  - architecture
  - engineering
  - perp
  - solana
description: 从 dYdX 到 GMX 到 Hyperliquid,链上永续合约的终极形态是什么?交易所工程师视角的完整架构拆解,覆盖 HyperBFT、HyperCore、HyperEVM、JELLY 事件、HIP-3 和 2026 竞争格局。
series:
  name: Web3 Insider 中文版
  order: 2
---

> 本文是 [Web3 Insider](https://github.com/survivorff/web3-insider) 第 2 篇的中文版。英文原版在 [GitHub](https://github.com/survivorff/web3-insider/blob/main/articles/02-hyperliquid-architecture-breakdown.md)。更深入的技术细节请参考我的 [Hyperliquid 知识库](https://github.com/survivorff/hyperliquid_design)。

*约 8000 字 · 阅读需 25-30 分钟*

---

## 写在前面

这是一篇我花了很长时间打磨的文章。因为 Hyperliquid 是我作为交易所工程师,第一个认真考虑过"能不能用它替代我们某个撮合子模块"的链上 venue。我想把来龙去脉理清楚,希望一篇顶十篇。

文章按读者水平分成了阶梯式结构,你可以按需跳读:

- **第 1 节**(基础扫盲):如果你还分不清 perp 和 spot、CLOB 和 AMM、"链上撮合"和"链上结算",从这里开始
- **第 2 节**(演化历史):给懂基础但没追过这五年演化的读者,看清"为什么必然走到 Hyperliquid 这一步"
- **第 3–4 节**(架构深拆):给工程师看具体怎么实现、为什么这么实现
- **第 5–6 节**(代价 + HIP-3):给资深从业者看权衡和未来
- **第 7–9 节**(竞争格局 + 工程笔记 + 深度思考):给决策者和同行看"这对整个行业意味着什么"

不急,从头读到尾的话大约 25-30 分钟。如果只想要结论,TL;DR 已经写在最前面。

---

## TL;DR

- Hyperliquid 占了**链上 perp 成交量约 70%**,峰值日触到 **Binance 永续盘口的 13%**,月收入 $100M+ 级
- 它赢的根本原因只有一句话:**撮合引擎不是智能合约,是 L1 里的原生状态机,EVM 挂在旁边而不是叠在上面**
- 所有其他亮点 —— 亚秒级 finality、maker 免 gas、共享保证金、`CoreWriter` precompile 桥 —— 都是这个决策的下游结果
- 代价是真实的:**24–30 个验证者的集中化、HLP vault 作为中央对手方、跨层桥的新攻击面**。2025 年 3 月的 JELLY 事件把这三点同时炸出来过
- 2026 年真正值得盯的是 HIP-3 之后的演化 —— Hyperliquid 已经从"一个 perp DEX"变成"**permissionless 市场工厂**",未平仓合约破 $1.2B,产品覆盖面开始和传统期货交易所对撞
- 对交易所工程师而言:这是第一个让我认真考虑"能不能用它替代某个撮合子模块"的链上 venue。结论对某一类产品不是显而易见的不行

---

## 1. 你需要知道的基础

> **如果你已经在做 Web3 交易基建,这一节可以跳过。**
> 这一节给第一次认真看链上 perp 的读者用,后面所有技术讨论都默认你有这些概念。

### 1.1 什么是 perp(永续合约)

传统的期货合约有到期日,到期交割或平仓。**永续合约**把到期日去掉,用"资金费率"(funding rate)这个机制,让永续合约的价格锚定现货。

简单说:

- 如果永续价 > 现货价(市场情绪偏多)→ 多头付资金费给空头,市场被推回平衡
- 反之空头付多头

永续的好处是:不用每月换月,可以用 5 倍、10 倍、100 倍杠杆持仓,适合投机和对冲。加密圈之所以偏爱永续,是因为它比现货资本效率高得多,同时比传统期货灵活。

**全球永续盘口**现在每月成交量在 $3–5 万亿美元级别,远超现货。链上那部分大概占 5–10%,也就是每月 $1500 亿–$5000 亿 —— Hyperliquid 占了这里面七成。

### 1.2 什么是 order book(CLOB)和 AMM

这是两种**完全不同**的定价机制,也是理解 Hyperliquid 为什么重要的前提。

**Order book(订单簿,CLOB)** 是传统金融里用了一百年的机制:买家和卖家各自挂价格和数量,系统按"价格优先、时间优先"撮合。纽交所、Binance、所有 CEX 都是这个机制。

- 好处:价格由市场参与者真实博弈决定,价差(spread)可以很小,做市商利润空间大,**资本效率极高**
- 坏处:需要强大的匹配引擎,需要做市商,需要低延迟,任何一个缺一块就崩

**AMM(自动做市商)** 是 Uniswap 2020 年发扬光大的机制:不用 order book,价格由池子里两种资产的数量按数学公式决定(最经典的是 `x * y = k`)。

- 好处:实现简单,不需要做市商,任何人都能提供流动性
- 坏处:滑点大,无常损失,**资本效率远低于 order book**

CEX 全是 CLOB,DEX 过去大部分是 AMM。**"在链上跑一个像样的 CLOB"从 2020 年开始就是 DeFi 的圣杯,五年内所有尝试都失败了**。Hyperliquid 是第一个真正做成的。

### 1.3 "链上撮合"到底意味着什么

这里有个容易混淆的地方。"链上"可以指三个不同的层面:

| 层面 | 含义 | 例子 |
|---|---|---|
| **链上结算** | 最终资金清算在链上,但撮合发生在链下 | dYdX v3(StarkEx),早期的 EtherFlyer |
| **链上撮合** | 订单匹配逻辑跑在链上,但可能是一个合约 | Serum(Solana) |
| **链上 + 原生** | 撮合是 L1 共识的一部分,不是合约 | **Hyperliquid** |

前两种都有人做成过(部分场景),但都有结构性的天花板。Hyperliquid 是第一个做"第三种"并且成功的。

### 1.4 Finality 和延迟:为什么毫秒级很重要

**Finality** 指一笔交易"真的不会被撤销"的时刻。不同链差得很远:

| 链 | 出块时间 | Finality |
|---|---|---|
| 以太坊 | 12 秒 | ~12 分钟(2 epoch) |
| Solana(现在) | 400ms | 约 12 秒 |
| Solana(Alpenglow 后) | 400ms | ~150ms |
| Hyperliquid | <1 秒 | 单块 |
| Binance 撮合 | N/A | 微秒级(中心化) |

对 meme 币交易或交易机器人,finality 差 1000 倍意味着完全不同的商业模式。在以太坊上,你一笔市价买单发出去,等确认的 12 秒里价格可能跑了 5%;在 Hyperliquid 上,这笔单和在 Binance 上体感没差。

这也是为什么所有人都在追求更快 finality —— 它不是性能指标,**它是能不能做某一类业务的准入条件**。

---

## 2. 来龙去脉:我们是怎么走到这一步的

> 如果你只想看 Hyperliquid 本身,这一节可以跳过。
> 但我强烈建议读一下,因为**看清前辈怎么死的,才能看懂 Hyperliquid 赢在哪**。

### 2.1 2020:AMM 的黄金时代

Uniswap V2 上线。`x * y = k` 解决了长尾资产的定价问题 —— 只要有 LP 愿意存两种资产,任何人都能在链上交易,不需要做市商。

这是 DeFi Summer 的起点。但 AMM 有一个根本局限:**不适合高频和大单**。滑点和无常损失让专业交易员、做市商、机构都不愿意用 AMM 做主战场。所有人都知道,**想做真正像 CEX 的 DEX,必须要 order book**。

### 2.2 2021–2022:Serum 的悲壮尝试

Solana 因为 TPS 高、出块快,成了"能不能在链上跑 CLOB"这个问题的第一个答卷人。Serum 是 FTX 和 Solana 生态联手推动的链上 order book 协议。

Serum 的想法很对:撮合在链上,其他 DEX 都可以复用它的 order book 流动性,形成共享基础设施。早期也真跑起来了,Raydium、Mango Markets、Phoenix 都集成过 Serum。

**它为什么死了:**

1. **撮合引擎是合约**。所有撮合逻辑跑在 Solana 程序里,任何大交易量都会和其他应用抢 Compute Unit。一旦有 NFT mint 或热门 Token launch,Serum 就卡
2. **前端和基础设施依赖 FTX 团队**。FTX 倒塌那一刻,Serum 的前端、Oracle、权限签名方全部不可用
3. **做市商离开**。专业做市商不愿意承担撤单 gas 成本。没有做市商,盘口就是死的

**教训**:即使跑在 Solana 这种"最快的通用 VM"上,撮合作为合约仍然不够。

### 2.3 2021–2023:dYdX 的 zk-rollup 折衷

dYdX 选了另一条路:**撮合放链下,结算用 StarkEx(zk-rollup)证明到以太坊**。这是典型的"链上结算"路线。

在 2021-2022 年,dYdX v3 一度是链上 perp 市场份额最大的 —— 因为它实际上就是个中心化撮合,只是资金在链上。

**为什么它没能赢下 2024-2026:**

1. **中心化撮合不是真 DeFi**。监管压力、意识形态分裂,加密社区对 dYdX 越来越冷淡
2. **自建 app-chain 的迁移失败**。dYdX v4 切到 Cosmos SDK,技术上没错,但 Cosmos 生态的流动性引导机制失效,HYPE 叙事跑不起来
3. **用户体验割裂**。IBC 桥、Cosmos 钱包、对 EVM 用户是一道坎

**教训**:**"可以随时去中心化"的承诺不够,必须一开始就是去中心化的**。并且 app-chain 不是万能药,**生态和流动性的引导和架构同样重要**。

### 2.4 2022–2024:GMX、Jupiter 的 AMM perp 路线

既然 CLOB 做不成,那用 AMM 加 oracle 来做 perp 呢?

GMX 是这个思路的代表:用户存 USDC、ETH 等到一个大池子,做市方就是 pool 本身,价格用 Chainlink oracle。Jupiter 在 Solana 上做了类似的事,规模更大。

**为什么这条路有天花板:**

1. **大单会打爆 pool**。Pool 有限,一笔大单可以让 LP 承担 oracle 价和真实成交价之间的差
2. **Oracle 是外部依赖**。oracle 的延迟和可操纵性都是风险。曾经发生过多次 GMX 被 oracle 操纵攻击
3. **不是 CLOB 语义**。做市商没法在多个价位挂单、做 scalping、做 maker rebates —— 专业做市商根本不来

**教训**:AMM 能把 perp 做到几十亿美元 TVL,但做不到 CEX 级专业性。

### 2.5 2023:Hyperliquid 的登场

在上面所有人都在试错的时候,Jeff Yan 和几个量化交易背景的工程师在 2022 年底开始做 Hyperliquid。他们的背景是关键信号:**这是一群在 Hudson River Trading 这类高频做市公司写过真撮合引擎的人**。

他们的判断很狠:

> 上面所有尝试都是**错的出发点**。不是"怎么把 CLOB 塞进现有 VM",而是"**把撮合当作 L1 原生组件,VM 反过来挂在旁边**"。

他们不融 VC,自己出资,花了一年多独立造 L1。2023 年年中上线,初期几乎没有声量。

真正的转折点是 2024 年:Pump.fun 把 meme 交易拉爆,交易机器人、高频策略、MEV 需求井喷。市场终于出现了一个"必须用 CEX 级 DEX"的场景。Hyperliquid 是当时唯一准备好的。2024 年 11 月空投,31% 的 HYPE 代币直接给用户,零 VC。

**这是加密史上最干净、最"社区派"的空投分发之一**。加上已经验证过的技术产品,Hyperliquid 从"冷门小众 DEX"一跃变成链上 perp 的绝对主导者。

### 2.6 前辈的共同错误

把这五年串起来看,前辈死于同一个假设:

> **只要 EVM 够快、L2 够多、app-chain 够灵活,链上 CLOB 迟早跑得动。**

这个假设从根上就是错的。**Gas 模型不是工程问题,是经济问题**。一个限价 order book 每成交一笔,会产生几千到几万次撤单、修改、重挂。没有任何通用 VM 的 gas 计价能把这个成本定价对。用 L1 gas 去支付高频撤单成本,本质上等于"用电费付出租车费",量级错得离谱。

Hyperliquid 的本质是拒绝这个假设。**撮合需要的是一个针对交易特别设计的状态机,不是一个高性能的通用 VM**。

---

## 3. 核心主张:撮合不能是合约

### 3.1 三角约束

Hyperliquid 真正要解决的问题不是"把 DEX 做得更快",是一个三角约束:

1. **用 CEX 级的吞吐撮合** —— 每秒几万单,端到端亚秒级
2. **链上结算** —— 用户自托管,系统可审计
3. **保持可编程** —— 能在上面叠 vault、结构化产品、做市策略

过去所有尝试都是三选二:

| 方案 | 撮合速度 | 链上结算 | 可编程 |
|---|---|---|---|
| **dYdX v3**(StarkEx L2) | ✅ | ⚠️ 证明在链上,order book 在链下 | ❌ |
| **GMX / Jupiter**(AMM perp) | ✅ | ✅ | 组合度中等,不是 CLOB 语义 |
| **Serum**(Solana) | 部分 | ✅ | ✅ 但实盘负载一上来撮合就崩 |
| **纯 Solidity CLOB** | ❌ | ✅ | ✅ 但 Gas 和出块时间让它经济上不成立 |

Hyperliquid 第一个把这个"不可能三角"打破的。**代价是它得自己造一条 L1 出来**。

### 3.2 架构级回答

Hyperliquid 的答案是:

- 把**撮合做成 L1 原生状态机**(不是合约)
- 通用 EVM **并列**运行,不是叠在上面
- 两者共用**同一套共识**
- 它们之间的通信用一个**精心设计的异步桥**

这一套选择是一个**互相咬合的整体**,单独抽出任何一块都不成立。下一节拆开讲。

---

## 4. 架构深拆

> **[图 2 — 全文最重要的一张图]**
> HyperBFT 共识在下面,上面并列 HyperCore 和 HyperEVM,两者之间标出"同步读 / 异步写"的箭头。HyperCore 红色,HyperEVM 蓝色,共识灰色。

```
┌─────────────────────────────────────────────────────────────────┐
│                        HyperBFT 共识                             │
│                (~24–30 个验证者,HotStuff 家族)                   │
└─────────────────────────────────────────────────────────────────┘
           │                                            │
           ▼                                            ▼
┌────────────────────────────┐          ┌────────────────────────────┐
│        HyperCore           │          │        HyperEVM            │
│  ─ 原生 CLOB 状态机          │◀────────▶│  ─ 以太坊兼容 EVM           │
│  ─ 永续 + 现货 order book   │  同步读   │  ─ 通用智能合约             │
│  ─ 保证金 + 强平             │─────────▶│  ─ 双出块节奏               │
│  ─ Oracle + HLP Vault       │  异步写   │  ─ Precompile 做桥          │
└────────────────────────────┘          └────────────────────────────┘
```

### 4.1 HyperBFT — 共识层

HyperBFT 是 HotStuff 家族的 BFT 共识。

**一个快速的 BFT 共识谱系**(给不太熟的读者):

- PBFT(1999):Byzantine Fault Tolerance 的开山,但通信开销 O(n²),扩展性差
- Tendermint(2014):Cosmos 的底层共识,O(n²) 但工程优化,支持几十个验证者
- HotStuff(2018):Facebook Libra 起源,**把 view change 的开销从 O(n²) 压到 O(n)**,支持上百个验证者
- 各种 HotStuff 衍生:DiemBFT、Aptos 的 AptosBFT、MystenLabs 的 Narwhal-Bullshark 等

HyperBFT 在 HotStuff 基础上做了**流水线**优化:区块的提议、投票、最终化三个阶段并发重叠,吞吐显著提升。

**关键指标**:

- 出块时间 **~400ms**,与 Solana 一个量级
- Finality **单块**,不需要多轮确认
- 理论吞吐 **~200万 orders/sec**,实际约 **20万 orders/sec**
- 每个下单、撤单、成交都是 L1 交易,但 HyperCore 不收 gas

**为什么能这么快**:

1. 验证者少(24–30)→ 网络通信成本低
2. HotStuff 的 pipeline 重叠 → 吞吐接近理论上限
3. 状态机极度专用化 → 不需要跑通用虚拟机的所有开销

**代价**:验证者少意味着集中化风险(见第 5 节)。

### 4.2 HyperCore — 原生撮合引擎

这是整个架构里最独特的部分,也是理解其他一切的基础。

**它不是一个智能合约,是 L1 的原生状态机**。

HyperCore 维护的状态包括:

- **账户**(accounts)和**子账户**(sub-accounts):每个用户一个主账户,可以开多个子账户做不同策略隔离
- **保证金模型**:
  - Cross margin:跨仓位共享保证金,资本效率高
  - Isolated margin:单仓位独立保证金,风险隔离
- **每个永续市场的 order book**:price-time priority,和 Binance 撮合逻辑一样(类比国内 A 股的连续竞价)
- **资金费率**:每 8 小时结算一次,使永续价格锚定现货
- **强平引擎**:当账户保证金率跌破 maintenance margin,触发强平,未能成交的部分由 HLP vault 接手
- **HLP vault 状态**:后面单独讲

HyperCore 的精髓在于:**所有这些状态转换都是原生操作,不烧 EVM gas**。下单就是一次 opcode,撤单也是,成交还是。成本几乎为零,可以做到"每秒几万次撤单挂单"。

**对开发者**:你完全感知不到 HyperCore 的内部。你看到的只是一个"能读能写的 order book,刚好具备 CEX 级性能"。

### 4.3 HyperEVM — 智能合约层

标准以太坊虚拟机,Solidity 开箱即用,工具链(Foundry、Hardhat)全部兼容。

唯一的创新是**双出块节奏**:

| 类型 | 出块时间 | Gas limit | 用途 |
|---|---|---|---|
| Fast block(小块) | **2 秒** | ~2M | 延迟敏感,比如强平 keeper、小额交互 |
| Slow block(大块) | **~60 秒** | ~30M | 吞吐重活,比如批量结算、复杂 DeFi 交互 |

这个设计解决了一个传统 EVM 的老问题:同一条链要同时满足"响应要快"和"单块要容得下复杂计算",两个目标互相矛盾。HyperEVM 用两种块交替出,应用按需选择。

HyperEVM 上活跃的生态:vault、yield 策略、预测市场、结构化产品。任何想和 order book 集成的合约都跑在这一层。

### 4.4 Bridge — Precompile 和 `CoreWriter`

这是整个架构里**最巧妙**的工程决策,也是 Hyperliquid 可能被后来者抄得最多的一部分。

核心挑战:两个**不同范式**的状态机怎么对话而不互相污染?

Hyperliquid 的答案是一个**非对称桥**:

**读 precompile**(同步):

HyperEVM 合约可以通过专用 precompile 地址**读取** HyperCore 状态:

- 盘口中间价、最优买一卖一
- 单个 market 的资金费率
- 用户账户的保证金、持仓
- Oracle 价格

没有外部 oracle。你在 Solidity 里读到的价格就是**当前这一 block 刚结算的撮合价**。

```solidity
// 伪代码示意
uint256 midPrice = IHyperCoreReader.getMidPrice(marketId);
uint256 myMargin = IHyperCoreReader.getAccountMargin(msg.sender);
```

**`CoreWriter`**(异步):

一个 precompile,地址 `0x3333333333333333333333333333333333333333`。合约**通过它向 HyperCore 提交操作**:

- 下单(limit / market / post-only / IOC)
- 撤单
- 转账(HyperEVM ↔ HyperCore 资金迁移)
- 开/关子账户

```solidity
// 伪代码示意 —— 一个 vault 下单
ICoreWriter(0x3333...).placeOrder(
    marketId,
    size,
    limitPrice,
    OrderType.Limit,
    TimeInForce.GTC
);
```

**关键:`CoreWriter` 是"提交即不管"的**。你的 Solidity 交易里发出了指令,HyperCore 在**下一个 block** 真正撮合,你在**再下一个 block** 看到成交。

### 4.5 非对称性:为什么这是整个架构的承重柱

读同步 + 写异步。这个设计选择值得单独拎出来讲,因为**它是 Hyperliquid 可能被抄得最多的一部分**。

想象如果写是同步的 —— 即你的 `CoreWriter.placeOrder()` 调用会**立刻**触发 HyperCore 撮合,然后把结果回调到你的合约里:

- 撮合过程被绑进 EVM 的 gas metering,一个撮合卡住 → EVM 卡住 → 整条链卡住
- 跨层 reentrancy 成了**永久的 bug 类型**,任何一次合约 callback 都可能让 HyperCore 状态出现不一致
- 撮合引擎永远无法独立优化,因为要兼容 EVM 语义

**异步写彻底避开了这些**。代价是开发者不能"假装撮合是在自己这笔交易里完成的",但这个代价是值的 —— 因为**矛盾的根源就是"假装":假装撮合和智能合约是同一个东西**。一旦接受它们就是**两个独立但协作的系统**,很多架构问题自然消解。

这个设计在计算机系统里有个通用名字:**clock boundary crossing**。CPU 和 PCIe 设备之间也是这种关系 —— CPU 通过 MMIO 同步读设备状态,通过 DMA 队列异步下发命令。Hyperliquid 把这个几十年的系统设计原则引入了区块链架构。

### 4.6 HLP Vault — 经济机制的"保险丝"

HyperCore 的一个关键组件是 **HLP(Hyperliquidity Provider)Vault**。它是整个系统的"中央对手方"和"保险基金"的结合体。

**用户视角**:存 USDC 到 HLP,得到 vault 份额,被动获得市场做市 + 强平收益。类似存钱到一个"链上量化基金"。

**系统视角**:HLP 承担以下角色:

1. **主动做市**:在每个市场的盘口挂 maker 单,吃 spread
2. **接手强平余量**:当用户被强平,未能在市场成交的部分,HLP 按预设规则接手
3. **吃 taker 费用分成**:平台 taker fee 的一部分直接进 HLP
4. **异类市场的最后接盘方**:低流动性市场里,当普通做市商不愿意报价,HLP 兜底

**收益来源**:做市 spread + 强平 profit(接手价格通常好于市场价)+ fee rebate

**风险来源**:极端行情下的单边累积敞口,以及 —— 这是 JELLY 事件的核心 —— **低流动性市场被针对性狙击**

在第 5.2 节我会详细讲 JELLY 事件,那里 HLP 几乎资不抵债,是理解这个机制的最好案例。

### 4.7 HIP-1 / HIP-2 — 代币标准

Hyperliquid 不用 ERC-20。它有自己的代币标准:

- **HIP-1**:Hyperliquid 原生 spot token。铸造、转账、销毁都是 HyperCore 原生操作,不烧 EVM gas
- **HIP-2**:流动性激励标准,用于引导 spot 市场流动性(细节略)
- **ERC-20 桥**:HyperEVM 上的 ERC-20 和 HyperCore 上的 HIP-1 之间有一个原生桥,可以双向迁移

这个设计的好处是:spot 交易不需要跑 ERC-20 的 transfer 合约,成本和延迟都远低于在 EVM 上做 spot。但也意味着**HyperEVM 上的 DeFi 应用要和 spot 交易互操作时,需要走这个桥** —— 又是一个跨层边界,需要特别注意(见第 5.3 节攻击面分析)。

---

## 5. 三个必须认清的代价

架构不是免费的。下面三个代价是所有认真考虑"是否要基于 Hyperliquid 建东西"的团队必须理解的。

### 5.1 验证者集合的中心化

**24–30 个活跃验证者**。作为对比:

| 链 | 验证者/验证节点数 |
|---|---|
| 以太坊 | 超过 100 万 |
| Solana | ~1500 |
| Cosmos Hub | 175 |
| dYdX v4 | 60 |
| **Hyperliquid** | **~24–30** |

HotStuff 族协议本身可以扩展到几百个验证者,所以 24 个不是技术限制,是运营选择 —— **初期优先保证低延迟**。代价是:

- **串谋风险**:理论上 1/3+1 = 9 个节点串通就能停摆或分叉(BFT 安全边界)
- **监管风险**:验证者身份可追溯到明确的个人/机构,任何一方被施压都可能影响共识
- **地理集中**:目前验证者集中在北美和欧洲,亚洲节点少

机构验证者(Unit Labs、Figment-adjacent 团队等)在 2026 Q1–Q2 陆续接入,但这是一个**必须持续扩张**的过程 —— 验证者数量必须随成交量增长,不能落在后面。"对当前吞吐安全够用"在吞吐还在长的阶段,是一种**危险的思维框架**。

### 5.2 JELLY 事件深度复盘

这是目前为止 Hyperliquid 最严重的一次危机,也是架构成熟度最真实的压力测试。

**背景:JELLYJELLY 是什么**

JELLYJELLY 是 2025 年 3 月在 Solana 上上线的一个小型 meme 币,市值一度上到 $50M 左右。Hyperliquid 在 spot 和 perp 市场都快速上架了这个 Token,借上 meme 交易的热度。**但由于流动性浅,HLP 实际上是这个 perp 市场的主要做市方**。

**攻击时间线**(2025 年 3 月 26 日 UTC):

| 时间 | 动作 |
|---|---|
| T-24h 前 | 攻击者在 Hyperliquid 上开始分散建仓(三个账户) |
| T-6h | 攻击者在 HL 开出**累计 $1200 万名义价值的 JELLY 空单**,同时用数百万美元保证金 |
| T-3h | 攻击者在 Solana 上**拉升 JELLY 现货价格**(meme 币,流动性极浅,成本很低) |
| T-1h | JELLY 永续价跟随现货拉升,攻击者空头浮亏,保证金充足,**系统看起来正常** |
| **T+0** | 攻击者**主动提出保证金**(partial margin withdrawal),账户保证金率瞬间跌破 maintenance margin |
| T+1 分钟 | 强平引擎触发,要强制买入巨量 JELLY perp 来平空 —— **但市场上没有对手方** |
| T+5 分钟 | **HLP vault 按规则接手**整个强平头寸,在扭曲的价格上"吃"下了攻击者的空头 |
| T+15 分钟 | JELLY 价格继续被攻击者拉升,HLP 浮亏持续扩大 |
| T+30 分钟 | HLP 浮亏约 **$1000 万美元**,逼近其总资本的 10–15% |
| T+45 分钟 | 社区和团队紧急讨论,HLP 风险参数调整不够快 |
| T+1 小时 | **验证者紧急投票**,以 99%+ 的压倒性票数通过"下架 JELLYJELLY 永续市场,按危机前价格结算所有头寸" |
| T+2 小时 | 下架执行完成,用户头寸按预危机价平仓,HLP 恢复 |

**最终损失**:大约 **$0(用户)** + **HLP 承担几十万美元的技术调整**。攻击者获利微小并被锁定。

**这个事件证明了什么**(大部分报道写偏了,这里我要写精确):

1. **验证者干预能用,且快**。从问题爆发到投票通过下架,不到 2 小时。这是"砸玻璃"按钮,真的能按下去
2. **HLP vault 作为中央对手方,在异类市场上是单点故障**。架构上它更像 CEX 的保险基金,不是纯粹的去中心化拍卖机制
3. **系统具备应急响应能力,但这个能力本身就是中心化风险**。一次事件,两个属性同时暴露

**这个事件没证明什么**:

1. **HyperBFT 坏了** —— 没有。这是经济/保证金模型的漏洞,不是共识漏洞
2. **链上 CLOB 是错的** —— 没有。撮合引擎做的就是它该做的事,bug 在上游的上架流程和保证金参数
3. **Hyperliquid 和 Binance 一样中心化** —— 不对等。Hyperliquid 的干预路径是**显式、公开、由链上投票治理**的,和"一家公司单方面回滚交易"是不同范畴

**事件之后 Hyperliquid 改了什么**:

- **上架流程收紧**:新市场需要更高流动性门槛
- **HLP 风险参数重构**:单个市场的最大敞口被限制在 HLP 总资本的一定百分比
- **异类市场独立保证金池**:meme 币等高风险市场和主流市场分开计算 HLP 敞口
- **断路器(circuit breaker)机制**:价格偏离过大时自动暂停该市场,给人工干预留时间

**这些修复都是对的**,但根本的经济学问题没解决 —— **HLP 作为中央对手方,任何新的异类市场都会是新的尾部风险**。这是 Hyperliquid 在 HIP-3 permissionless 路线下必须长期和这个问题赛跑的。

### 5.3 桥是新的攻击面

`CoreWriter` 和读 precompile 坐在两个范式的交界处。这里任何 bug 都是**跨层 bug**:

- **Reentrancy 变种**:EVM 合约调 `CoreWriter`,HyperCore 在下一块撮合并通过事件通知 EVM,EVM 触发的后续逻辑**再次**调 `CoreWriter`。构成一个跨层 reentrancy 循环,传统 reentrancy 守卫可能不够用
- **Precompile 读和写的一致性**:你读到的价格是 block N 的,你下单按这个价格,但撮合在 block N+1 发生,价格可能已经变。需要应用层做 slippage 保护
- **HIP-1 和 ERC-20 的桥**:双向桥是新代码,是新 bug 源。已经有过 Hyperliquidity Composer 的 token decimals 问题

**对在 Hyperliquid 上建东西的团队的建议**:

1. 审计**每一条 precompile 调用路径**,不要只审 Solidity
2. 假设 `CoreWriter` 的调用**不是原子的**,所有依赖状态不变的逻辑都要做 defensive check
3. 用专门的工具(`hyper-evm-lib` 等)来本地模拟 precompile 行为,而不是只测试合约内部
4. 监控 HyperCore 和 HyperEVM 之间的状态一致性,跨层 bug 往往表现为"状态对不上"

---

## 6. HIP-3:从 venue 变成市场工厂

### 6.1 机制细节

HIP-3 在 2025 年 10 月 13 日上线。它开放了**永续市场的创建权**:任何合格的 builder 都可以部署并运营一个新的永续市场,不需要 core team 批准。

"合格"意味着:

- **质押 HYPE**:目前门槛是**100 万 HYPE**(按价值约 $50M 级别),锁仓
- **部署价格 oracle**:提供市场的标记价来源,可以是 Pyth/Chainlink,也可以是自定义
- **遵守 slashing 规则**:如果你的市场出现操纵、oracle 失效、保证金参数失当造成 HLP 损失,你的质押会被部分或全部罚没

这个设计的厉害之处:**创建市场的 builder 和系统的利益对齐**。你发了一个垃圾市场并且它炸了,你亏的比系统亏的多。你发了一个好市场并且跑起来了,你分得交易手续费。

### 6.2 已经发出来了什么

到 2026 年 5 月,HIP-3 上已经跑起来的市场包括:

- **tokenized 股票期货**:特斯拉、英伟达、苹果、Meta 等的永续合约(不是 token,是永续 perp)
- **大宗商品**:原油、黄金、天然气的永续
- **外汇**:EUR/USD、USD/JPY 等主要货币对
- **利率**:美债收益率的永续(量小但存在)
- **奇异市场**:选举概率、天气、AI 模型排名等(量小但存在)

到 2026 年 3 月,**HIP-3 总未平仓合约(OI)突破 $1.2B**。这个数字在持续增长。

### 6.3 这意味着什么

Hyperliquid **不再是"一个 perp DEX"**。

它变成了**一个 permissionless 的全球市场工厂**。任何人,花 $50M 级别的成本,可以上架一个新的衍生品市场,不需要和任何监管方、交易所、VC、项目方打交道。

这是金融市场在加密史上**第一次真正意义上的"去平台化"**。

对比传统金融:想在 CME 上架一个新期货产品,需要几年的合规、审批、流动性培育。在 Hyperliquid 上,从提案到上线可以在几天之内完成。

**对行业的影响**:

1. **长尾衍生品市场**终于有地方落地。那些"理论上应该有期货但一直没人做"的市场(某个小国股指、某个特定物价指数、某个 AI 模型性能),现在有了
2. **监管压力会变**。美国、欧盟、亚洲监管方已经注意到 HIP-3。2026 下半年可能会有第一批针对"permissionless perp"的监管动作
3. **Hyperliquid 的护城河质变**。从"我们产品最好"变成"**我们是任何需要 order book + 可编程逻辑的产品的默认结算层**"。后者是大得多的主张

### 6.4 HIP-4 和更远

HIP-4 在 2026 Q1 进入测试网,提供**固定期限合约**(不是永续),用于结构化产品、期权、预测市场。这是 Hyperliquid 从"只做永续"向"全品类衍生品平台"的扩张。

配合 LayerZero 做的 HyperCore ↔ HyperEVM ↔ 其他链 的 composer 模式,Hyperliquid 正在变成**跨链衍生品的结算中心**。

---

## 7. 2026 的竞争格局

Hyperliquid 不是在真空里赢。它面对几股正在重塑的竞争压力。

### 7.1 Solana + Alpenglow + BAM

Solana 正在进行共识层的大修:

- **Alpenglow**(目标 Q3 2026):替换 PoH + Tower BFT,**finality 从 12.8 秒压到约 150ms**。Votor 负责提议,Rotor 负责最终化。本质是 Solana 从"单链 pipeline"转向"真正的 BFT 协议"
- **BAM(Block Assembly Marketplace)**:在 Jito 领衔下,把交易排序从 validator 剥离到运行在 TEE 里的专用节点,为交易应用提供**公平排序和反 frontrun 保护**

两者叠加后,Solana 上一条**针对交易优化的 CLOB 协议**(比如升级后的 Phoenix)有机会在**延迟和公平性**上逼近 Hyperliquid。

**但**:Solana 仍然是通用 VM,CLOB 协议仍然是 user-space program。从 Hyperliquid 的视角看,这仍然是"给通用 VM 装 order book"的老路子,只是底子更好了。**结构劣势还在**。

### 7.2 Monad + 专用 order book

Monad 是并行 EVM,TPS 目标 10K+,EVM 完全兼容。有团队在 Monad 上构建原生的链上 CLOB,比如 Bebop 的衍生品分支。

**我的判断**:在通用 EVM 上 + 并行化提升,仍然打不过"撮合是原生状态机"的架构。但能把 AMM perp 的天花板抬很高,做到 GMX、Jupiter 的 3–5 倍规模。

### 7.3 Jupiter perps 的长大

Jupiter 在 Solana 上已经跑成最大的 perp 聚合器,2026 Q1 月成交量 $32B+,和 Hyperliquid 有可比性。但 Jupiter 是 AMM + oracle 模式,深度和精度有天花板。

**Jupiter 的路线选择**:继续优化 AMM 还是转型 CLOB?2026 年年底应该会见答案。

### 7.4 CEX 的反应

Binance、OKX、Bybit 都在做**"混合模式"**:在自己的链(BSC / X Layer / 等)上部署 perp DEX,和 CEX 账户打通,做"CEX 做行情 + DEX 做结算"。

这种模式**短期内对散户很香**,因为 CEX 体验 + 自托管。但**不是真去中心化**,监管一旦施压就会回退到 CEX。

**我的视角**(交易所工程师):CEX 的真正护城河不是撮合,是**用户规模、法币通道、合规、市场教育**。撮合技术被 Hyperliquid 这种纯 DeFi venue 追上,只是时间问题。CEX 得想清楚:如果五年后链上 perp 追到和 CEX 性能相当,**CEX 还剩什么**?

---

## 8. 工程师笔记 — 如果我来设计下一代

### 8.1 直接抄的 5 条

1. **撮合 = 原生状态机,不是合约**。这个决策永远不要重新讨论。
2. **非对称桥**:同步读,异步写。这让可组合性不会污染撮合,也让撮合不被 VM 语义绑架。
3. **Maker 免 gas 挂单**。任何没这条的平台都在向对手方交一个对手不交的税。
4. **跨产品线的共享保证金**。UX 和工程收益会复合。
5. **预发布紧急情况 playbook**。JELLY 是每一个链上交易平台迟早要面对的事的预览。

### 8.2 不抄或要重新思考的

- **24 个验证者的 quorum**。必须随成交量增长,不能落后。建议设计时就留好"逐步去中心化"的路径,而不是后期临时加
- **HLP 作为单一 vault**。在 HIP-3 permissionless 时代,单 vault 承担所有异类市场风险不可持续。应该设计**按市场分层的多 vault 结构**
- **HIP-1 原生代币标准**。性能好但生态割裂成本高,可能不值得。可以考虑"原生优化的 ERC-20"而不是自定义标准

### 8.3 集成方的实操 gotchas

给要在 Hyperliquid 上建东西的团队:

1. **Precompile 调用的 gas 预算**:读 precompile 比普通 SLOAD 贵几倍,批量读时要控制次数
2. **CoreWriter 的确认延迟**:你提交下单之后,要等 1–2 个 block 才能在链上看到结果,UI 层面要做"pending"状态
3. **多 RPC 下的状态一致性**:如果你用多个 RPC provider 做冗余,要注意 HyperCore 状态和 HyperEVM 状态可能不在完全同一个 block 上,需要做版本号校验
4. **HIP-1 和 ERC-20 桥的 decimal 问题**:已知的踩雷点,LayerZero 文档里有专门章节
5. **Fast block 和 slow block 的选择**:延迟敏感逻辑要确认落在 fast block 上,否则可能等 60 秒

---

## 9. 更深的思考 — 这对 Web3 意味着什么

上面都是技术和机制。最后这一节是**我自己跟踪这个赛道两年后的判断**,主观成分更多,欢迎反驳。

### 9.1 "为交易而生的 L1" 作为一个范畴的确立

加密行业过去五年的默认假设是:**一条够好的通用 L1(以太坊、Solana、Aptos…)最终能跑一切**。App-chain 是一个折衷,不是终极答案。

Hyperliquid 证明了相反的命题:**对某些场景,从头为场景设计的 L1 是结构性更优**,不只是性能上,还是经济模型上。

这预示着 2026–2028 会出现一批**"为特定场景优化的 L1"**:

- 为**稳定币支付**优化的(已经在做:Circle 生态、Stripe 的 Open Payments)
- 为 **AI agent 经济**优化的(AWS AgentCore + x402 rails 已经在跑)
- 为**预测市场**优化的(Polymarket 如果转专用链)
- 为 **RWA tokenization** 优化的

**通用 L1 不会消失**,但它的角色会从"跑所有东西的主战场"退到"各个专用 L1 互操作的结算层和公共基础设施"。这是 Cosmos 最早的愿景,十年后以另一种方式实现。

### 9.2 "on-chain vs off-chain" 的边界在被重画

2020 年,我们以为"链上"的终极形态是"AMM + 链上结算"。
2023 年,我们以为"链上 CLOB"是不可能的。
2026 年,Hyperliquid 证明**连撮合都可以完全链上**。

那下一个呢?

- **Clearing(清算)**:目前大部分跨市场清算仍在 CEX / 传统金融内部。Hyperliquid 在 HIP-3 上做的其实已经是原型:一个 builder 的市场爆仓,系统级别自动扣除其质押
- **KYC / AML 合规**:目前链上基本裸奔,但 zkKYC 的进展让"合规可以链上"成为可能
- **结构化产品**:Hyperliquid + HyperEVM 已经能跑简单的 vault,复杂衍生品结构(例如保险连结票据)也有望

**每一次"链上 vs 链下"的边界移动,都会产生一批新的 on-chain 公司和一批消失的 off-chain 公司**。Hyperliquid 刚刚在"撮合"这条线上把边界推动了一格。

### 9.3 AI agent × on-chain trading 的天然平台

这是我最近思考最多的方向。

**AI agent 做链上交易**需要什么?

1. **读市场状态的能力**,低延迟,无外部依赖
2. **下单的能力**,低成本,低摩擦
3. **管仓位的能力**,跨产品、跨市场
4. **可编程的风控和策略表达**

Hyperliquid 是**第一个四个能力都原生具备**的链上 venue:

- 读 precompile 直接拿价格,不用 oracle
- `CoreWriter` 下单几乎 0 成本
- 共享保证金天然跨市场
- HyperEVM 上可以写任意策略合约

对比 Solana、以太坊上做同样的事:

- 价格要从 oracle 读,延迟 + 可信假设
- 下单要通过 DEX 合约,高 gas
- 跨 DEX 仓位管理是地狱
- 策略合约要和 N 个不同 DEX 对接

**所以我预判**:2026–2027 年,**绝大多数严肃的链上 AI agent 交易产品,首选部署在 Hyperliquid**。这会反过来给 Hyperliquid 带来新的量级增长。

AWS 在 2026 年 5 月推出 Bedrock AgentCore Payments(Coinbase + Stripe 合作),让 AI agent 能用 stablecoin 付 API 费。**下一步 agent 经济缺的就是"交易场所"**。Hyperliquid 是目前最完美的候选。

### 9.4 对中心化交易所的长期影响

我在 CEX 做了几年,从内部视角说:**Hyperliquid 这类架构是 CEX 撮合技术护城河的长期威胁**。

但 CEX 的真正护城河从来不是撮合,是:

1. **用户规模 + 流动性飞轮**(在哪有人就在哪交易)
2. **法币通道 + 合规**(链上 DEX 进不来的那一半世界)
3. **市场教育 + 信任**(大多数用户还是不会用自托管钱包)
4. **产品延展性**(借贷、staking、卡、理财 全套组合)

**长期来看(5 年维度)**:

- **撮合技术不再是护城河**。CEX 和 DEX 在技术上会趋同
- **法币和合规仍然是**。CEX 仍会主导链接传统金融的部分
- **"纯加密原生交易者"会大量迁移到链上**。尤其是量化、做市商、AI agent
- **CEX 需要重新定义自己**:要么变成"链上交易的法币门户",要么真的把自己上链化(类似 Binance 推的 Uniswap X 集成)

这对我个人的判断:**未来 3-5 年,交易所工程师最应该学的不是更深的撮合优化,是深入理解链上架构**。因为这两个世界的边界正在快速消融。

---

## 10. 我在盯的开放问题

- **HyperBFT 能不能在验证者集合扩大到 100+ 后保持亚秒延迟?** HotStuff 家族能 scale,但每一个真实部署去中心化时都交过"延迟税"
- **Alpenglow 怎么改变竞争数学?** 纸面上 150ms finality 缩窄差距,真实压力下呢(拥堵、priority fee 飙升、验证者作恶)?
- **HyperEVM 会承接 DeFi 长尾,还是止步于 HyperCore 的薄壳?** 2026 年底的 fee 数据会给出答案
- **HLP vault 在 HIP-3 扩张下能不能保持稳健?** 每个新市场都是新的尾部风险源,HLP 的多 vault 化是必须的
- **监管会怎么动?** tokenized 股票期货是最敏感的信号,美国 SEC 和欧盟 ESMA 都已经在密切跟踪
- **Hyperliquid 会不会"做 CEX"?** 他们最近招了传统金融合规人员。长期来看,"合规 DeFi"可能是下一步

---

## 11. 延伸阅读

一手资料:

- [Hyperliquid 白皮书](https://chainclarity.io/hyperliquid) —— 重点读共识和账户模型
- [LayerZero 的 Hyperliquid composer 文档](https://docs.layerzero.network/v2/developers/hyperliquid/hyperliquid-concepts) —— precompile 和 `CoreWriter` 权威参考
- [Chainstack 的 HyperBFT + 子账户拆解](https://chainstack.com/hyperliquid-hyperbft-sub-accounts-spot-perp-accounting/) —— 共识层细节
- [hyper-evm-lib 文档](https://www.hyperlib.dev/) —— HyperEVM 开发者工具链
- [BAM 架构概览](https://bam.dev/overview/) —— Jito 给 Solana 的对应答案
- [Oak Research 的 JELLY 复盘](https://oakresearch.io/en/analyses/investigations/hyperliquid-jelly-attack-context-vulnerability-team-solution)

中文圈参考:

- Odaily、PANews、深潮、链捕手 的 Hyperliquid 专题 —— 可以交叉数据
- 各大研报平台的季度报告 —— Delphi、Messari、Galaxy 有多份

---

*发现事实错误请在 [web3-insider 仓库](https://github.com/survivorff/web3-insider) 开 issue。对结论有异议,在 X 上 @ 我更好玩 —— [@FrankFu2262](https://x.com/FrankFu2262)。*

*本仓库下一篇:Jito 的 BAM,以及关闭公开 mempool 到底意味着什么。*

---

## Go Deeper — 如果你想继续深挖

这篇文章是我对 Hyperliquid 架构的**观点文**。如果你想看更系统、更全面的技术拆解(不带个人判断,纯事实和机制),我做了一个完整的知识库:

**→ [hyperliquid_design](https://github.com/survivorff/hyperliquid_design)** — 8 篇基础介绍 + 8 个核心概念深度目录

按需查阅:

| 你想了解 | 去看 |
|---------|------|
| 平台全貌和核心数据 | [01-platform-overview](https://github.com/survivorff/hyperliquid_design/blob/main/docs/basics/01-platform-overview.md) |
| 链上永续的四代演化史 | [02-history-and-context](https://github.com/survivorff/hyperliquid_design/blob/main/docs/basics/02-history-and-context.md) |
| HyperBFT + HyperCore + HyperEVM 三层架构 | [03-technical-architecture](https://github.com/survivorff/hyperliquid_design/blob/main/docs/basics/03-technical-architecture.md) |
| 永续合约机制、订单类型、资金费率、清算 | [04-trading-mechanism](https://github.com/survivorff/hyperliquid_design/blob/main/docs/basics/04-trading-mechanism.md) |
| HYPE Token 经济、空投、Assistance Fund | [05-tokenomics](https://github.com/survivorff/hyperliquid_design/blob/main/docs/basics/05-tokenomics.md) |
| HyperEVM 生态、Builder Codes | [06-ecosystem](https://github.com/survivorff/hyperliquid_design/blob/main/docs/basics/06-ecosystem.md) |
| vs dYdX vs GMX vs Jupiter vs Vertex 全维度对比 | [07-competition](https://github.com/survivorff/hyperliquid_design/blob/main/docs/basics/07-competition.md) |
| JELLY 事件、Vault 风险、中心化争议、监管 | [08-risks-and-events](https://github.com/survivorff/hyperliquid_design/blob/main/docs/basics/08-risks-and-events.md) |

---

**Web3 Insider 系列其他文章:**

- [Episode 01: 你的 100 美元 meme 买单,实际付了 107 美元](https://blog.frankfu.cloud/posts/anatomy-of-100-dollar-meme-buy/)
- Episode 03: Jito 的 BAM,以及关闭公开 mempool 到底意味着什么(coming soon)

⭐ [Star web3-insider](https://github.com/survivorff/web3-insider) · 𝕏 [关注 @FrankFu2262](https://x.com/FrankFu2262)
