---
author: survivorff
pubDatetime: 2026-06-01T10:00:00Z
title: 从 Web2 后端视角学 Solana 编程：一份真诚的路线图
slug: learning-solana-from-web2-backend
featured: false
draft: true
tags:
  - notes
  - solana
  - engineering
  - tutorial
description: 作为一个传统后端转 Web3 的人，我记录从零学 Solana 开发的完整路径，避开我踩过的所有坑。
---

## 为什么写这篇

我 4 年前从传统后端转 Web3 时，Solana 已经存在两年了，但中文学习资料极少。大多数教程要么过于入门（"什么是区块链"），要么过于专业（"如何优化 Rust 代码的 Compute Unit"），中间那段最重要的"从一个后端工程师到 Solana 开发者"的路径反而没人写。

这篇文章把我走过的路整理出来，配合你已有的后端知识，最快速度上手 Solana 开发。

---

## 为什么 Solana 对后端工程师友好

先说结论：**Solana 的心智模型比以太坊更接近传统后端**。

对比：

| 概念 | 以太坊 | Solana |
|------|--------|--------|
| 账户模型 | Account（状态和代码绑在一起） | Account（状态和代码分离） |
| 执行模型 | 顺序执行 | 并行执行（你需要声明读写） |
| 状态更新 | 每个合约自己管理 | 所有状态都在 account 里 |
| 语言 | Solidity | Rust |

特别是 Solana 的 **"所有状态都是 account，合约只是纯函数"** 这个设计，和后端工程师熟悉的"数据 + 业务逻辑分离"非常像。

---

## 路线图（推荐学习顺序）

### 第 1 阶段：基础概念（1-2 周）

**需要理解的核心概念：**

1. **Account（账户）**
   - 所有数据都是 account：用户账户、程序账户、Token 账户、data account
   - 每个 account 有 owner，只有 owner 可以修改它的数据
   - Rent（租金）：存储数据需要"押金"，少了会被回收

2. **Program（程序）**
   - 就是"智能合约"，但是纯函数，不带状态
   - 状态由它"拥有"的 accounts 保存
   - 一个 program 可以管理无数个 account

3. **Instruction（指令）**
   - 一笔交易可以包含多个 instruction，原子执行
   - 每个 instruction 指定：要调用哪个 program、要访问哪些 account、参数

4. **PDA（Program Derived Address）**
   - 由 program + seed 推导出来的地址，program 可以代为签名
   - 相当于"程序内部的钱包"，用于保存业务状态

**推荐资源：**

- [Solana Cookbook](https://solanacookbook.com) — 最实用的入门材料
- Helius 的 [Solana 白皮书解读](https://www.helius.dev/blog/solana-slots-blocks-and-epochs)
- [Anchor by Example](https://examples.anchor-lang.com/) — 框架层面的实战

### 第 2 阶段：写第一个 Program（1-2 周）

不要急着学 Rust 语法。**先用 Anchor 框架写个 hello world**。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod hello {
    use super::*;

    pub fn greet(ctx: Context<Greet>, name: String) -> Result<()> {
        let greeting = &mut ctx.accounts.greeting;
        greeting.message = format!("Hello, {}!", name);
        Ok(())
    }
}

#[account]
pub struct Greeting {
    pub message: String,
}

#[derive(Accounts)]
pub struct Greet<'info> {
    #[account(init, payer = user, space = 8 + 256)]
    pub greeting: Account<'info, Greeting>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

这 30 行代码包含了 Solana 开发 80% 的核心概念：

- 声明一个 program（`#[program]`）
- 定义业务方法（`greet`）
- 定义一个 account 的结构（`Greeting`）
- 定义指令需要的所有 account（`Greet`）
- 用 `#[account(...)]` 注解描述每个 account 的约束

**重点理解：** Solana 把"要访问什么 account"放在最前面声明，这是为了支持并行执行。以太坊不用，因为它顺序执行。

### 第 3 阶段：客户端交互（1 周）

后端用的时候，你是在写 TypeScript（或 Python、Rust）去调用 program。

```typescript
import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";

const program = new Program(idl, programId, provider);

// 创建一个新的 greeting
const greeting = web3.Keypair.generate();
await program.methods
  .greet("World")
  .accounts({
    greeting: greeting.publicKey,
    user: provider.wallet.publicKey,
    systemProgram: web3.SystemProgram.programId,
  })
  .signers([greeting])
  .rpc();
```

**几个关键点：**

- `idl` 是 program 的接口描述，类似 Web2 里的 OpenAPI schema
- 每笔交易需要签名者（signers）
- `.rpc()` 真正发送交易，返回签名

### 第 4 阶段：生产级 Solana 开发（持续）

如果你要做真实的项目（比如交易平台），需要掌握：

1. **交易构建优化**
   - Compute Unit 精确设置
   - Priority Fee 动态调整
   - Versioned Transaction + ALT

2. **RPC 管理**
   - 多 RPC 负载均衡
   - WebSocket 订阅 vs 轮询
   - Staked Connection

3. **Jito / MEV 基础设施**
   - Bundle 构建
   - Tip 定价策略
   - DontFront 使用

4. **高频数据处理**
   - Geyser 插件
   - 链上事件解析
   - 实时行情计算

（这些话题在[交易系统系列](/posts/lifecycle-of-solana-tx/)里有详细写过。）

---

## 常见的误区

### 误区 1：Rust 很难，所以 Solana 很难

Solana 用 Rust，但你**不需要精通 Rust** 就能开发。

Anchor 框架包装了绝大部分 Rust 的复杂度。实际你要写的是"填空式"的代码：声明 account 结构，填业务逻辑。

需要真正懂 Rust 的场景：性能优化、写 Anchor 不支持的高级特性、贡献到 Solana 客户端。这些都是后期才遇到的。

### 误区 2：Solana 就是"快的以太坊"

心智模型差异巨大：

- 以太坊合约直接持有状态；Solana 合约持有对 account 的访问权限
- 以太坊一个交易调用一个合约；Solana 一个交易可以调用多个 program 多个 account
- 以太坊顺序执行；Solana 并行（需要声明读写依赖）

**以太坊经验对学 Solana 是减项，不是加项。** 忘掉 EVM 的思维，从零学。

### 误区 3：本地测试足够

Solana 的 `solana-test-validator` 是强大的，但真实环境的坑它测不出来：

- 网络拥堵下的行为
- Jito Tip 竞价的实际效果
- 多个 RPC 的数据一致性
- MEV 攻击下的交易表现

**必须在 Devnet 和 Mainnet 小额测试后才能上生产。**

---

## 工具推荐

| 工具 | 用途 |
|------|------|
| [Solana CLI](https://docs.solana.com/cli) | 必装，所有命令行操作 |
| [Anchor](https://www.anchor-lang.com/) | 框架，强烈推荐 |
| [Solana Playground](https://beta.solpg.io/) | 在线 IDE，新手友好 |
| [@coral-xyz/anchor](https://www.npmjs.com/package/@coral-xyz/anchor) | TypeScript 客户端 |
| [Helius](https://helius.dev) | RPC + 附加工具（推荐） |
| [Solscan](https://solscan.io) | 区块浏览器 |

---

## 学习曲线估计

假设你有 2-3 年后端经验：

- **入门到能写 CRUD 级别的 program**：2-4 周
- **能独立做一个完整的 DApp**：2-3 个月
- **能做生产级的交易系统**：6-12 个月
- **能做 Solana 核心基础设施开发**：2 年+

---

## 下一步

这篇是入门路径。接下来我会写：

- 《Solana 账户模型详解：从 Web2 数据库视角类比》
- 《Anchor 的魔法：一个框架是如何把 Rust 变简单的》
- 《一个完整的 Solana Telegram Bot：代码走读》

想看的话 [订阅 RSS](/rss.xml) 或 [关注 X](https://x.com/FrankFu2262)。
