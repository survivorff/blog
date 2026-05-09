---
author: survivorff
pubDatetime: 2026-06-05T10:00:00Z
title: Solana 账户模型详解：从 Web2 数据库视角类比
slug: solana-account-model
featured: false
draft: true
tags:
  - notes
  - solana
  - engineering
  - deep-dive
description: Solana 的 Account 模型是它的核心设计。用后端工程师熟悉的数据库概念来理解它，会快 10 倍。
---

## 为什么这个模型重要

做 Solana 开发，你要反复面对一个词：**Account**。

你的用户钱包是 account。
Token mint 是 account。
用户持有的 Token 余额也是一个 account（ATA）。
你的程序自己是 account。
程序里存的每一条业务数据都在某个 account 里。

**一切都是 account。**

对以太坊开发者来说，这是一个完全陌生的世界。但对后端工程师来说，它非常像数据库。这篇文章就用数据库类比讲清楚。

---

## 核心类比

| Solana 概念 | 数据库对应 |
|------------|-----------|
| Account | 一条记录（row） |
| Account 的 address | 主键（primary key） |
| Account 的 data | 记录的字段值 |
| Account 的 owner | 哪个"表"的（program id = 表名） |
| Program | 一段存储过程 / API 服务 |
| Instruction | 一次 RPC 调用 |

**最关键的类比：**

- 数据库里：记录在表里，表决定了这条记录能被谁修改
- Solana 里：account 有 owner（某个 program），只有 owner 能改它的 data

---

## Account 的物理结构

每个 account 有固定的字段：

```
┌──────────────────────────────────────┐
│ Address (32 bytes) — 唯一标识         │
├──────────────────────────────────────┤
│ Lamports (u64) — 账户余额（SOL）     │
├──────────────────────────────────────┤
│ Owner (PubKey) — 哪个 program 拥有   │
├──────────────────────────────────────┤
│ Executable (bool) — 是不是 program   │
├──────────────────────────────────────┤
│ Data (bytes) — 任意二进制数据        │
├──────────────────────────────────────┤
│ Rent Epoch (u64) — 租金到期时间      │
└──────────────────────────────────────┘
```

- **Address**：32 字节公钥，就是"主键"
- **Lamports**：这个 account 的 SOL 余额（1 SOL = 10^9 lamports）
- **Owner**：决定了谁可以修改 `data` 字段
- **Data**：可以存任意数据，由 owner program 定义格式
- **Executable**：true 说明这个 account 本身是一段代码（program）

---

## 三种 account 类型

### 1. 用户钱包（User Account）

```
Address: Alice 的公钥
Lamports: 10 SOL
Owner: System Program（系统程序）
Data: 空
Executable: false
```

用户钱包是最简单的 account：由 System Program 拥有，data 是空的。

**谁能改它？**
- 只有 System Program 能减少它的 lamports（比如转账、付 rent）
- Alice 签名后，System Program 才会执行转账

### 2. 程序账户（Program Account）

```
Address: Pump.fun 的程序地址
Lamports: （一点点）
Owner: BPF Upgradeable Loader
Data: Pump.fun 的 Rust 编译字节码
Executable: true
```

Program account 的 data 字段存的是**可执行代码**。它本身由 loader program 拥有。

**谁能改它？**
- 如果是可升级 program：由升级 authority 签名才能改
- 如果是不可升级：永远不能改（真正的去中心化）

### 3. 数据账户（Data Account）

```
Address: 某个 PDA 或 keypair
Lamports: 2 SOL（交租金）
Owner: 你的 program
Data: { user: Alice, balance: 1000, ... }
Executable: false
```

这是最常用的类型。你的 program 为每个业务对象创建一个 data account，存储状态。

**谁能改它？**
- **只有它的 owner program** 能修改 data 字段
- 其他人（包括 Alice 本人）都不行
- 要改，必须通过调用 owner program 的 instruction

---

## 关键的心智转换

### Web2 数据库的写法

```python
# 一切在一个数据库里
db.users.update({id: alice_id}, {balance: 1000})
```

### Solana 的写法（概念上）

```
# 发一笔交易，调用你的 program
Transaction:
  Instruction:
    program: my_program (地址)
    accounts:
      - alice_account (owned by my_program, 要被修改)
      - alice_wallet (Alice 的钱包, 要签名)
    data: { action: "deposit", amount: 1000 }
```

**区别：**
1. 要**显式声明**要访问哪些 account（这是 Solana 并行执行的基础）
2. 修改 account 要通过 program 的 instruction，不能直接改
3. 所有涉及的 account 必须列出来，即使你只是读

---

## PDA：程序派生地址

这是 Solana 最特别的概念之一。

**问题**：一个 program 怎么创建和管理"自己的" account？

普通 account 的地址对应一个私钥，只有私钥持有者能签名。但 program 没有私钥，怎么签名？

**答案**：PDA（Program Derived Address）。

```rust
// 推导一个地址
let (pda, bump) = Pubkey::find_program_address(
    &[b"user-data", alice.as_ref()],
    &my_program_id
);
```

这个 PDA 地址：
- 由 program id + seeds 决定性地派生出来
- **没有对应的私钥**
- 但 program 可以"代为签名"（通过 `invoke_signed`）

**数据库类比：**

想象一个用户档案表，主键是 "user-data-{user_id}"。
- Web2：数据库 server 可以随时读写任何 row
- Solana：program 用 seed 算出 PDA，然后代为签名创建/修改

---

## ATA：Token Account 的特殊例子

`Associated Token Account`（ATA）是 PDA 的最常见应用。

当 Alice 要持有 USDC：
- 系统不把 USDC 余额存在 Alice 的钱包里
- 而是创建一个专属的 ATA，地址由 `(Alice 的钱包, USDC mint)` 决定性派生

结果：
- Alice 的钱包 account（owned by System Program）
- Alice 的 USDC ATA（owned by Token Program）
- Alice 的 BONK ATA（owned by Token Program）
- …每种 Token 一个 ATA

查一个地址有多少 Token：用 `getTokenAccountsByOwner(alice, USDC)` 找它的 ATA，读余额。

---

## Rent：数据库的"存储费用"

Solana 里存数据要付钱。不是一次性的，是租金（rent）。

规则：
- 每个 account 存储数据，按大小和时间收费
- 如果你押的 lamports 足够覆盖"2 年的 rent"，就 **rent exempt**，永远不被回收
- 如果不够，慢慢被扣，扣到 0 时 account 被删

现在几乎所有 program 都让 account 一次性 rent exempt，避免数据丢失。

**数据库类比：** 类似 Amazon S3 的存储费，但要提前一次性存够"2 年的"。

---

## 为什么这样设计：并行执行

Solana 交易要显式声明访问哪些 account。为什么？

**为了并行执行。**

两笔交易如果：
- 都只是读某个 account
- 或者改的是不同的 account

就可以**同时执行**。

```
Tx 1: 改 account A
Tx 2: 改 account B
→ 可以并行
```

```
Tx 1: 改 account A
Tx 2: 改 account A
→ 必须顺序
```

以太坊没这个机制，所有 tx 全部顺序，这是它 TPS 只有 15 的根本原因。

---

## 数据库类比的局限

类比帮助理解，但也有边界：

1. **Solana 的"数据库"是链上的**，所有人都能读，所有变更都是公开的
2. **没有索引** — 你要自己维护（或用 Geyser 等工具）
3. **事务成本不同** — Solana 每笔交易几百到几千 lamports，不像数据库本地操作
4. **schema 是程序定义的**，改 schema 要升级 program（如果可升级的话）

---

## 实战：设计 account 结构的原则

做一个真实的程序时，我的设计原则：

### 原则 1：一个业务对象一个 account

比如做一个投票系统：
- 一个"提案" = 一个 account（ProposalAccount）
- 每个"投票"也是一个 account（VoteAccount）
- 不要把多个对象挤在一个 account 里

### 原则 2：用 PDA 管理全局资源

- 全局配置：`find_program_address(&[b"config"], program_id)`
- 用户档案：`find_program_address(&[b"user", user.as_ref()], program_id)`

这样任何人都能算出地址，不需要查询。

### 原则 3：考虑 account 大小

- account 创建时要确定大小，之后不能改（要 realloc）
- 预留空间给未来可能加的字段
- 但也别太浪费，rent 是真的要钱

### 原则 4：读操作尽量在客户端

- Solana RPC 支持直接读 account data
- 客户端能完成的查询，不要放 program 里
- Program 只做"写"相关的逻辑

---

## 总结

Solana 的 Account 模型：

- **一切都是 account** —— 用户、程序、业务状态
- **Account 有 owner** —— 只有 owner 能改 data
- **显式声明依赖** —— 为了并行执行
- **PDA 是关键** —— 程序管理自己的 account

用数据库类比：
- Account ≈ 数据库的一条记录
- Owner ≈ 这条记录在哪个表
- Program ≈ 存储过程
- Instruction ≈ 一次 RPC 调用
- PDA ≈ 以函数生成的主键

理解了这个模型，Solana 开发就通了一半。

---

_下一篇会讲 Anchor 框架是如何包装这些底层概念、让开发变简单的。[订阅](/rss.xml) 或[关注](https://x.com/FrankFu2262)。_
