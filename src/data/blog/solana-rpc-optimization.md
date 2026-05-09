---
author: survivorff
pubDatetime: 2026-05-08T07:30:00Z
title: Solana RPC 成本优化：从 $50K 到 $10K 的实战记录
slug: solana-rpc-optimization
featured: false
draft: false
tags:
  - engineering
  - solana
  - backend
  - review
description: 做 Solana 交易基建最大的成本项不是服务器，是 RPC。分享我们把月 RPC 费用砍掉 80% 的具体方法。
---

## 一张让我失眠的账单

某个月的某一天，财务发给我一张 RPC 服务商的账单：**$52,430**。

那个月我们的用户量不算大，日活 3-5K，但 RPC 请求量接近 2 亿次。按 Helius 的 business plan 计费，单月花了 5 万多美元。

作为平台方，这个成本吃掉了相当一部分利润。老板盯着问："能不能降下来？"

接下来两个月，我们把 RPC 月费用从 $50K+ 砍到了 $10K 以内，而且用户体验没有下降。

这篇文章分享具体做法。如果你也在做 Solana 基建，可能有帮助。

---

## 为什么 RPC 这么贵

先理解成本结构。Solana RPC 的主要消耗：

### 1. 查询类调用（占 60%+）

- `getAccountInfo` — 查单个账户
- `getMultipleAccounts` — 批量查
- `getTokenAccountsByOwner` — 查某地址的所有 token
- `getProgramAccounts` — 查某个 program 下所有账户（最贵）
- `getBalance` — 查 SOL 余额

每个活跃用户每分钟可能产生 10-50 次这类调用（同步持仓、检查余额等）。

### 2. 交易类调用（占 20%）

- `simulateTransaction` — 模拟交易
- `sendTransaction` — 发交易
- `getTransaction` — 查交易状态

### 3. 订阅类调用（占 15%）

- WebSocket 订阅账户变更
- 订阅日志
- 订阅交易

### 4. 其他（占 5%）

- `getRecentBlockhash`、`getSlot` 等

**高成本的几个"陷阱"：**

- `getProgramAccounts` 对大 program 可能返回几 MB 数据，按流量和调用次数双重收费
- WebSocket 订阅即使空闲也算"并发连接数"，高并发会进入更贵的套餐
- 某些高级 API（如 Helius 的 DAS API）按不同费率计算

---

## 优化方法总览

按"效果 / 投入"排序，我们实际做了的事：

```
优化手段                     降本效果     实施难度
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
缓存 token 元数据           30%         低
批量查询代替单次查询         20%         低
WebSocket 替代轮询          15%         中
读写分离 + RPC 分级          10%         中
按用户分层（VIP vs 普通）     8%         中
自建部分节点                  5%         高
去掉非必要的查询              5%         中
```

累计下来，就是 80% 的降本。

---

## 方法 1：缓存 Token 元数据（效果最大）

我们观察到的现象：

> 用户页面每次刷新，都要查每个持仓 token 的元数据（名字、符号、图标、小数位）。一个活跃用户持仓 30 个 token，每次刷新就是 30 次 RPC 调用。

问题是：**这些元数据几乎不会变**。Token 一旦创建，名字和符号基本不会改。

**做法**：

1. 第一次查到某个 token 的元数据后，缓存到 Redis
2. TTL 设 7 天（偶尔会有更新）
3. 对于已经"毕业"的 token（市值高、有一定交易量），永久缓存

```typescript
async function getTokenMetadata(mint: string) {
  // L1: 本地 LRU 缓存（最快）
  const l1 = lruCache.get(mint);
  if (l1) return l1;

  // L2: Redis 缓存
  const l2 = await redis.get(`token:meta:${mint}`);
  if (l2) {
    lruCache.set(mint, JSON.parse(l2));
    return JSON.parse(l2);
  }

  // L3: RPC
  const data = await rpc.getAccountInfo(mint);
  const meta = parseTokenMetadata(data);

  await redis.set(`token:meta:${mint}`, JSON.stringify(meta), "EX", 7 * 86400);
  lruCache.set(mint, meta);

  return meta;
}
```

**效果**：token 元数据类请求量下降 95%+。

---

## 方法 2：批量查询代替单次查询

Solana RPC 支持 `getMultipleAccounts` — 一次查最多 100 个账户。但很多代码习惯单个查。

例子：一个用户有 30 个 token，查持仓：

❌ **错误做法**（30 次请求）：

```typescript
const balances = [];
for (const tokenAccount of userTokenAccounts) {
  const balance = await rpc.getTokenAccountBalance(tokenAccount);
  balances.push(balance);
}
```

✅ **正确做法**（1 次请求）：

```typescript
const accountInfos = await rpc.getMultipleAccounts(userTokenAccounts);
const balances = accountInfos.map(parseBalance);
```

**效果**：账户查询类请求量下降 60-80%。

---

## 方法 3：WebSocket 替代轮询

"检查用户的 token 余额有没有变化"这种场景，我们一开始是每几秒轮询一次。

改成 WebSocket 订阅：

```typescript
// 订阅用户的 token account 变更
const subscriptionId = rpc.onAccountChange(tokenAccount, (accountInfo) => {
  const newBalance = parseBalance(accountInfo);
  updateUserBalance(userId, mint, newBalance);
});
```

好处：
- 只在余额真变化时才消耗请求
- 延迟更低（实时推送 vs 几秒轮询）

**注意**：WebSocket 有连接数限制，要做好**复用** — 一个 WS 连接可以订阅多个账户。

**效果**：监控类请求下降 70%。

---

## 方法 4：读写分离 + RPC 分级

我们用了 3 种不同级别的 RPC：

```
┌─────────────────────────────────────────┐
│ Tier 1: Premium Staked Connection       │
│   用途：交易提交、狙击、大额交易         │
│   成本：最贵（约 $0.005 / 请求）         │
│   占比：5% 的请求                       │
├─────────────────────────────────────────┤
│ Tier 2: Business Plan                   │
│   用途：实时数据、WebSocket、用户查询    │
│   成本：中（约 $0.0005 / 请求）         │
│   占比：30% 的请求                      │
├─────────────────────────────────────────┤
│ Tier 3: 公共 RPC 或便宜的节点            │
│   用途：非关键查询（统计、后台任务）     │
│   成本：几乎免费                         │
│   占比：65% 的请求                      │
└─────────────────────────────────────────┘
```

关键是**把请求正确分流**。常见错误是所有请求都用最贵的 Tier 1 节点。

实现上用一个 RPC Client Pool：

```typescript
class RpcPool {
  private tier1: RpcClient;  // Staked
  private tier2: RpcClient;  // Business
  private tier3: RpcClient;  // Public

  async call(method: string, params: any[], priority: "high" | "normal" | "low") {
    const client = {
      high: this.tier1,
      normal: this.tier2,
      low: this.tier3,
    }[priority];

    return client.call(method, params);
  }
}
```

**效果**：在不影响关键路径体验的前提下，把大部分请求导到便宜的节点，降本 40%。

---

## 方法 5：按用户分层

不是所有用户都需要最好的 RPC 服务：

- **VIP 用户**（交易量大、付费订阅）：用 Tier 1，最快最稳
- **普通活跃用户**：用 Tier 2，正常体验
- **非活跃用户**：用 Tier 3，可以接受略高延迟

这是一个敏感话题（歧视用户？）。但从商业角度，**资源有限时，优先服务贡献最多收入的用户**是合理的。

**效果**：头部用户体验更好，整体成本更低。

---

## 方法 6：自建部分节点

终极优化：自己跑一个 Solana validator 或 non-voting RPC 节点。

**投入**：
- 硬件：$2-5K（高配机器）或云上 $1-2K/月
- 运维：需要一个懂 Solana 的工程师
- 带宽：$500-1000/月（Solana 节点流量很大）

**收益**：
- 常用查询无限次（不按调用收费）
- 更低延迟（节点在自己机房）
- 对关键路径更可控

**适合场景**：
- 月 RPC 账单超过 $10K
- 团队有 DevOps 能力
- 对延迟敏感

我们最后自建了 2 个节点，专门处理高频查询。

**效果**：降低了约 20% 的外部 RPC 调用。

---

## 反模式：不要做的事

### 1. 全部自建节点

**幻想**："全自建就不用付 RPC 钱了"
**现实**：维护成本远超预期。节点同步出问题、磁盘爆满、网络抖动...每一个都能让平台瘫痪。

**建议**：自建补充，不要替代。主力还是用商业 RPC 服务。

### 2. 只追求最便宜

**幻想**："用最便宜的 RPC 省钱"
**现实**：便宜的 RPC 延迟高、落链率低，用户体验变差，流失更多。

**建议**：分级使用，关键路径不省钱。

### 3. 一次性大改造

**幻想**："大重构一次全部优化"
**现实**：风险极高，可能引入新问题。

**建议**：小步迭代，每次优化一个类别，监控效果，稳定后再下一步。

---

## 监控怎么做

降本优化的前提是知道钱花在哪。我们的监控设置：

### 1. 按 method 统计

每个 RPC 方法的请求量、总耗时、错误率。能看出哪个 API 调用占成本大头。

### 2. 按业务模块统计

哪个服务（用户查询？交易引擎？监控？）贡献了多少 RPC 请求。

### 3. 按 tier 统计成本

每天 Tier 1 / Tier 2 / Tier 3 各花了多少钱。

### 4. 异常告警

请求量突然暴涨？立即告警，可能有代码 bug 或被攻击。

---

## 总结

RPC 成本优化的核心思路：

1. **减少请求** — 缓存 + 批量 + 订阅
2. **分级使用** — 不是所有请求都值得用最贵的节点
3. **自建补充** — 大量高频查询自己搞定
4. **持续监控** — 没有数据，优化是瞎猜

**具体效果**：我们从月 $50K 降到 $10K，用了 2 个月的工程时间。ROI 非常可观。

如果你也在做 Solana 基建，希望这些经验有帮助。有问题可以在[评论区](#comments)讨论。

---

_关注 [X @FrankFu2262](https://x.com/FrankFu2262) 看更多交易系统工程实战。_
