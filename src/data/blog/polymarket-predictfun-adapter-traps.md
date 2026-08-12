---
author: survivorff
pubDatetime: 2026-07-31T17:00:00+08:00
title: 两条链，一套代码：Polymarket 与 predict.fun 的同构与陷阱
slug: polymarket-predictfun-adapter-traps
featured: false
draft: false
tags:
  - web3
  - evm
  - deep-dive
description: Polymarket 和 predict.fun 的架构几乎一模一样——都是 Gnosis CTF、ERC-1155、链下 CLOB。我以为能写一套 adapter 通吃两家。真正让我流血的，全在常量里。
series:
  name: 预测市场聚合器实战
  order: 2
---

上一篇讲了[聚合器最难的事件对齐问题](/posts/prediction-market-event-matching/)。这篇讲交易链路——听起来简单得多，因为这两个平台的架构**真的**几乎一模一样。

同构到什么程度？我列一下：

| 维度 | Polymarket | predict.fun |
|---|---|---|
| 代币框架 | Gnosis Conditional Token Framework | 同 |
| 代币标准 | ERC-1155 | 同 |
| 撮合 | 链下 CLOB | 同 |
| 结算 | 链上原子结算 | 同 |
| 订单授权 | EIP-712 离线签名 | 同 |
| 核心恒等式 | `1 YES + 1 NO = $1` | 同 |
| 执行方式 | Direct Match / Mint / Merge | 同 |
| 二元 / 多结果 | 两套 Exchange 合约 | 同 |
| API 认证 | L1 钱包签名 → L2 HMAC | 同 |

看到这张表，任何一个后端工程师的第一反应都是：**抽一个 `PredictionMarketAdapter` 接口，两个实现，收工。**

我也是这么想的。然后我又一次验证了自己[两年前那篇文章的标题](/posts/multi-chain-exchange-pitfalls/)——"不就是加个 adapter 吗"，这句话每次说完都要付学费。

这篇就写清楚：**架构同构的地方骗你，常量不同的地方害你。**

> 口径说明：Polymarket 侧的合约地址、端点都有完整公开文档，可以硬编码进测试用例。predict.fun 迭代较快，我的做法是**合约地址和端点一律从官方 SDK 的常量与官方开发者文档动态取**，不写死在代码里。下面涉及它的具体数值，都请以官方源为准。

---

## 陷阱一：抵押品精度不一样（最阴的一个）

这是我最想放在第一位讲的坑，因为它**不会报错，只会算错**。

- Polymarket 的抵押品是 Polygon 上的 **USDC.e**，`decimals = 6`
- predict.fun 在 BNB Chain 上用稳定币，而 **BSC 上的主流稳定币普遍是 18 位精度**

所以同样是"1 美元"：

```
Polymarket:    1 USDC.e   = 1_000_000              (1e6)
predict.fun:   1 稳定币    = 1_000_000_000_000_000_000  (1e18)
```

差 **12 个数量级**。

为什么这个坑特别阴？因为如果你从 Polymarket 的集成开始写（大部分人都会，它文档最全），你会很自然地在代码里留下 `1e6` 这个假设。它可能出现在：

- 金额换算的工具函数里
- 订单构造的 `makerAmount` / `takerAmount`
- 展示层的格式化
- 测试用例的期望值
- **风控的阈值判断里**（最危险）

然后你接第二个平台，如果哪一处漏改，结果不是抛异常，而是**金额差 1 万亿倍**。它可能表现为"订单直接被拒"（幸运），也可能表现为"下了一个你根本没想下的单"（不幸）。

我的处理方式，就一条铁律：

> **代码里不允许出现精度字面量。所有精度必须运行时从合约 `decimals()` 读取并缓存。**

```ts
// ❌ 永远不要这样
const amount = usd * 1e6;

// ✅ 精度是平台配置的一部分，运行时取
const dec = await tokenMeta.decimals(chain, collateralAddress); // 带缓存
const amount = parseUnits(usd.toFixed(dec), dec);
```

顺带一个建议：**内部统一用整数最小单位 + 显式精度传递，不要用浮点数在层与层之间传金额。** 预测市场的价格是 `$0` 到 `$1` 之间的小数，份额数量又常常很大，浮点误差在这种量级组合下特别容易咬人。

---

## 陷阱二：tokenId 不能当跨平台的 key

上一篇已经提过，这里从代码角度再说一次，因为它会直接影响你的数据模型设计。

`tokenId` 的派生里混着**抵押品合约地址**：

```
collectionId = getCollectionId(conditionId, indexSet)
tokenId      = uint256(keccak256(collateralAddress, collectionId))
```

而 `conditionId` 又混着 **oracle 地址**：

```
conditionId = keccak256(oracle, questionId, outcomeSlotCount)
```

结论：**同一个现实事件，在两个平台的 tokenId 必然不同，且没有任何数学关系可以互相推导。**

所以数据模型必须是两层的：

```
内部事件 ID（你自己生成的，事件对齐系统的产物）
   ├── Polymarket 侧：{ conditionId, yesTokenId, noTokenId, negRisk }
   └── predict.fun 侧：{ conditionId, yesTokenId, noTokenId, negRisk }
```

**不要试图让链上 ID 充当业务主键。** 链上 ID 是"某个平台内部的地址"，你的业务主键必须是你自己的。

另外一个实务提醒：**别自己算 tokenId。** 两个平台的市场接口都会直接返回 YES / NO 的 token id，读接口比自己 keccak 靠谱得多——自己算一旦哪个参数顺序错了，你会得到一个语法上合法、实际不存在的 tokenId。

---

## 陷阱三：两套 Exchange 合约，路由错了直接回滚

两个平台都是同一个模式：**二元市场和多结果（negRisk）市场走不同的 Exchange 合约。**

- Polymarket：CTF Exchange（二元）/ NegRisk CTF Exchange（多结果）
- predict.fun：同样是两个（其 SDK 明确要求对两个 Exchange 都做授权）

下单时必须按市场的 `negRisk` 字段选合约，**用错不是滑点变差，是交易直接 revert**。

这个坑本身不难，难的是它和上一个坑叠加之后的组合爆炸。看一下你需要维护的授权矩阵：

```
2 个平台
  × 2 条链（Polygon / BNB Chain）
  × 2 个 Exchange（binary / negRisk）
  × 2 类授权（ERC-20 approve / ERC-1155 setApprovalForAll）
= 16 个授权状态
```

每一个都可能处于"没授权 / 授权中 / 已授权 / 被用户撤销"四种状态。而且用户可以在任何时刻从链上撤销任意一个。

我的做法：

1. **把授权状态当成一等公民的状态机**，而不是"下单前检查一下"的临时判断
2. **下单前从链上校验，不信本地缓存的"应该已经授权了"**（缓存只用来决定"要不要展示授权引导"，不用来决定"能不能下单"）
3. **授权失败要能精确告诉用户是哪一个缺了**，"授权失败"这种报错等于没报错

---

## 陷阱四：两条链的"确认"不是一回事

这条是我[之前那篇多链踩坑](/posts/multi-chain-exchange-pitfalls/)的直接延续，在这里换了个场景又出现了一次。

Polygon 和 BNB Chain 都是 EVM，`eth_getTransactionReceipt` 长得一模一样。但：

- **出块节奏和最终性模型不同**（Polygon PoS 有 Bor 出块 + Heimdall checkpoint 的双层结构，软确认和最终确认之间有很长的窗口）
- **短暂重组的概率和深度不同**
- **RPC 的行为差异**：同一个 `pending` 语义，不同供应商的实现和一致性表现并不一致

对聚合器的实际影响是：**你不能用同一个"等 N 个确认"的常量去对待两条链。**

我最后是把它做成平台配置的一部分：

```jsonc
{
  "platform": "polymarket",
  "chain": "polygon",
  "confirmations": { "optimistic": 1, "safe": 12 },   // 具体值按实测调
  "reorgToleranceBlocks": 5
}
```

关键不在于这几个数字填多少（那要靠实测和业务容忍度决定），而在于**它们必须是配置，不能是散落在代码里的字面量**。

---

## 陷阱五：手续费模型根本不是同一种东西

这条严格说不算"陷阱"，算"抽象失败"。我原本想在 adapter 接口上放一个 `getFee()`，结果发现两个平台的费用**在语义上就不对齐**：

- Polymarket 的模式是**结算时对净利润抽成**（而非按笔交易收固定比例）
- predict.fun 是**交易手续费**，同时它还有一个反向项——**抵押品在持仓期间生息**（这是它的核心差异化，用来解决"下注资金闲置"的问题）

这意味着什么？意味着：

> **在 predict.fun，持有一个仓位到结算，中间是有正收益的；在 Polymarket，是纯机会成本。**

一个 `getFee(): number` 的接口根本表达不了这件事。你需要的是一个**成本模型**，而不是一个费率数字：

```ts
interface CostModel {
  takerFeeBps: number;          // 成交时
  settlementFeeOnProfit: number; // 结算时对利润抽成
  holdingYieldApy: number;       // 持仓期收益（可能为 0）
  gasEstimate: bigint;
  // ...
}
```

而且注意 `holdingYieldApy` 会把"时间"引入定价——**同样的名义价差，持有 3 天和持有 3 个月，可执行性完全不同。** 这个话题我留到下一篇专门讲。

---

## 那这个 adapter 到底该抽在哪一层

踩完这一圈，我对"抽象边界应该画在哪"的理解变了。

**可以安全抽象的**（两个平台真的同构）：

- 订单的生命周期语义（构造 → EIP-712 签名 → 提交 → 撮合 → 链上结算）
- 三种执行方式的概念（Direct Match / Mint / Merge）
- 订单簿的形状（bid / ask / 深度）
- `1 YES + 1 NO = $1` 这条恒等式，以及由它推出的镜像关系
- 认证的两级结构（L1 签名换凭证 → L2 HMAC 调用）

**必须下沉到平台实现、不要试图统一的**：

- 一切常量：精度、合约地址、端点、确认数、tick size
- 手续费与收益模型（语义不同，别硬塞进一个数字）
- 结算路径与时间特征（预言机机制不同）
- 链的确认与重组行为
- 授权矩阵的具体组合

我总结成一句自己用的话：

> **抽象"流程"，不要抽象"常量"。流程是同构的，常量是平台的身份。**

上一篇说事件对齐时我讲过一句类似的：一个市场的真正身份是它的结算规则。放到这里就是——**一个平台的真正身份，是它那一堆不起眼的常量。**

---

## 一份自检清单

如果你要接第二个预测市场平台，这些是我会逐条过的：

- [ ] 代码里搜一遍 `1e6` / `1e18` / `10 ** 6`，一个都不该留
- [ ] 金额是否全程用整数最小单位传递，没有浮点参与
- [ ] 精度是否从 `decimals()` 运行时读取并缓存
- [ ] 业务主键是否是自己生成的，而不是链上 ID
- [ ] tokenId 是否来自接口返回，而不是自己 keccak
- [ ] 下单是否按 `negRisk` 正确路由到对应 Exchange
- [ ] 授权矩阵是否被建模成状态机，下单前是否链上校验
- [ ] 确认数 / 重组容忍是否是按链配置，而非全局常量
- [ ] 手续费是否建模成成本模型（含持仓收益），而非单一费率
- [ ] 合约地址与端点是否动态获取，没有硬编码

---

## 小结

Polymarket 和 predict.fun 的架构相似度高到让人放松警惕——**而这种"看起来一样"恰恰是最危险的状态**，因为它会让你把平台差异当成实现细节，而不是当成需要显式建模的东西。

真正让我流血的，没有一个是架构问题。全是常量。

[下一篇](/posts/prediction-market-price-normalization/)写价格：既然两个平台都遵守 `1 YES + 1 NO = $1`，为什么跨平台看到的价差**大部分都不是套利机会**。

---

## 延伸阅读

- [同一个事件，在两个平台是两个世界](/posts/prediction-market-event-matching/) —— 本系列第 1 篇，事件对齐
- [「不就是加个 adapter 吗？」——多链扩展的三个血泪教训](/posts/multi-chain-exchange-pitfalls/) —— 同一类错误在交易所场景的版本
- [预测市场的 2026](/posts/prediction-markets-2026/) —— CTF / CLOB / 结算机制的基础
- [在交易所做后端：我学到的 10 个反直觉的事](/posts/exchange-backend-lessons/) —— 为什么"宁可停机不能错账"

---

_预测市场聚合器实战系列，持续更新。[订阅 RSS](/rss.xml) 或 [关注 X](https://x.com/FrankFu2262)。_
