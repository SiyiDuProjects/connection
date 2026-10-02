# Reachard 月费定价与 Stripe 上线核对

核对日期：2026-09-04（美国洛杉矶）。以下原始审计记录保留作为发现依据，**最新执行结果见下方更新**；不能将原始问题清单全部视为仍未修复。

## 执行更新

- 用户明确授权“直接覆盖，那个旧项目不要了”后，已将现有正式 Stripe 接收端覆盖为 Reachard，保存后 Dashboard 显示“Reachard monthly subscriptions / 使用中”、URL `https://reachard.co/api/stripe/webhook`、7 个事件。原接收端 ID `we_1U7W6a0nhgFoMCt946nCUnS5` 保留，未轮换签名密钥；API 版本保留 `2026-04-22.dahlia`。该授权替代下方原始审计中的“新增独立接收端”建议，未删除旧网站或其他文件。
- 已保存事件：`checkout.session.completed`、`checkout.session.async_payment_succeeded`、`invoice.paid`、`invoice.payment_succeeded`、`customer.subscription.created`、`customer.subscription.updated`、`customer.subscription.deleted`。已移除原拍卖项目的 Checkout 失败/过期与 Refund 事件。实际本地处理器覆盖以上 7 个事件。
- 正式回调地址 GET 返回 HTTP 405 且无重定向；无签名空 POST 返回 HTTP 400 / `Webhook signature verification failed.`。这证明路由可达且拒绝未认证请求，**不能证明签名密钥匹配或支付/续费交付成功**。未复制、展示或修改密钥，部署端签名绑定仍待核验。
- 用户批准后，Stripe 业务问卷已提交并显示“审核中”，并非审核通过。详见 [提交记录](STRIPE_BUSINESS_REVIEW_DRAFT.md)。
- 已修复本地首购/续费处理：兼容 Basil 和旧 invoice 订阅字段；接收 invoice.paid；付款通知先到时恢复 Checkout 开通；行锁保证重复首次/续费回调不重复发放；旧订阅事件按最新 Stripe 状态同步，避免覆盖新订阅；免费试用及零额账单不触发付费邀请奖励。
- 已增加重复结账保护和 Stripe 客户归属校验；同计划复用未完成 Checkout，换计划先使旧未完成会话过期；past_due/unpaid/incomplete/paused 阻止再开一份订阅；历史订阅用户不再次获得新客试用。
- 客户门户使用独立配置，保留期末取消、付款方式和账单；暂不提供尚未完成额度联动的套餐升级/降级和数量修改。
- 会员访问期写入账本 metadata.periodEnd；Contacts API 在非 beta 模式下要求有效会员及未结束的访问期。状态允许 active/trialing，以及仍在已获授访问期内的 past_due；没有额外宽限期。余额规则继续保留现有累计方式，未擅自决定月末清零。
- 默认 beta 绕过改为关闭，示例配置显式 false；**生产环境未修改**，线上健康接口实际仍为 betaUnlimited=true。上线需前后端同时配置，不能仅部署一侧。
- 价格页、通用界面文案、侧栏、条款和 API 消息改为月费会员/使用额度，原有 20/60 包含额度仍公开显示；正式价格仍 USD 8/12。未擅自把建议价或无限调用写成正式承诺。
- 本地 17 个支付测试通过（含已取消订阅账户的删除流程防回归），另有 13 个既有邮箱验证测试通过；TypeScript 检查、扩展静态检查通过。已查看真实应用的 localhost:3012/pricing 页面及截图：使用会员卡片文案；本地无付款凭据时显示不可购买，未用假价格伪装可购买状态。
- 新增 `cd web && npm run check:billing`：只读检查正式账户身份、价格、Reachard Webhook、门户、账本索引和旧会员访问期；只输出检查结果及非敏感配置状态。脚本尚未在完整正式 web 环境执行，本地无该环境凭据。

### 正式只读核验结果

通过当前电脑已有 SSH 身份访问 Docker 内的正式 Contacts 服务。数据库查询在 READ ONLY 事务和 15 秒查询限制下执行，无数据写入，无付费供应商调用。

- /health：ready=true，betaUnlimited=true。
- teams 中绑定 Stripe subscription 的记录数：0；订阅额度发放记录数：0。因此本次数据库快照没有需回填旧访问期的记录，但发布前仍要再检查。
- 首次订阅/续费账本唯一索引均已存在；schema 声明已对齐，无需重新执行旧去重 DELETE 迁移。
- 初次只读核验时，Stripe Workbench 唯一可见接收地址为 `https://worldbid-map.dusiyi0916.chatgpt.site/api/stripe/webhook`（6 个事件）。随后按用户明确授权覆盖，当前状态以上方执行更新为准。

| 最近 30 天动作 | 调用总数 | 含成本记录数 | 已记录成本 USD |
| --- | --- | --- | --- |
| 搜索 | 11 | 7 | 0.066500 |
| 邮箱查询 | 1 | 1 | 0.026000 |
| 草稿 | 1 | 1 | 0.000693 |

仅 1 位活跃用户，4 次搜索没有成本信息，已记录合计 USD 0.093193。不能把缺失成本当零，也不能用这个样本宣称毛利率或 P95 稳定。

若仅作敏感性演算，暂取已记录搜索均值 USD 0.0095/次、邮箱 USD 0.026/次、草稿 USD 0.000693/次：100 次搜索 + 50 次邮箱 + 100 次草稿约 USD 2.3193；500 + 200 + 500 次约 USD 10.2965。此为极小样本外推，不是报价或实测月成本；已经足以说明 USD 19 无限使用需要明确的成本控制，不能直接承诺。

### 发布前仍未完成

Stripe 最终审核、正式 Webhook 签名 secret 与部署端匹配核验、专属门户接入、完整测试环境 Checkout/续费投递验证、部署、真实付款、最终套餐用量/价格决定、退款/争议与奖励回收流程。Webhook 地址和事件覆盖已完成；新增的本地测试、可达性检查及业务说明提交不能替代完整联调。没有移动或删除旧网站及项目文件、发布工作区其他改动或修改正式价格。

## 已确定的产品方向

用户购买 Reachard 月费会员，获得寻找合适公司联系人、获取可用工作邮箱、生成个性化联络草稿和管理使用记录的能力。不出售独立 Contact Kit，不按 Kit 向 Stripe 报量计费。内部可以继续记录供应商消耗，但不能把计量术语当作产品本身。

月费并不自动意味着无条件无限调用。尚待确定的是：正常个人求职使用配合理使用规则，还是明确的月度邮箱获取额度。若存在数量上限，必须在购买前说明，不能用“无限”掩盖实际限制。

## 现有 Stripe 项目：已经找到

在已登录的 Stripe Dashboard 中，当前账户明确显示 Reachard，地址不含测试模式路径，首页展示 live 公钥标识（未揭示或复制密钥）。正式产品目录有两个激活产品：

| 产品 | 现有价格 | 计费周期 | 产品 ID |
| --- | --- | --- | --- |
| Base | USD 8 | 每月 | prod_URqd7OxSbjwpvr |
| Plus | USD 12 | 每月 | prod_URqdXQhF7FjubC |

[现有产品目录](https://dashboard.stripe.com/acct_1TSwqZ0nhgFoMCt9/products?active=true)。应复用现有账户和产品；不要运行 `web/lib/db/seed.ts` 来“补配置”，该脚本会再次创建产品和测试用户。真实价格修改应在定价确定后新建对应 Price，并绑定明确 Price ID；不迁移已有订阅，除非另行确定适用范围。

**账户审核是当前最紧急的阻碍。** [账户状态](https://dashboard.stripe.com/acct_1TSwqZ0nhgFoMCt9/account/status) 显示“提供所售商品或服务的信息”尚未提交；若未解决，提现会在 **2026-09-06** 暂停。页面给出与受监管业务相关的通用审核原因，未说明具体哪项功能触发；不能推断只是措辞问题，也不能保证补充说明后一定通过。需如实说明第三方工作联系信息能力。

问卷要求：销售的产品/服务、目标客户、可选的定价/交付等细节、是否销售实物。[审核回答草稿](STRIPE_BUSINESS_REVIEW_DRAFT.md) 已准备，未填入或提交表单。

## 定价建议：先验证，不把旧价格当结论

保留 Base/Plus 时，可先把 **Base USD 12/月、Plus USD 24/月** 作为实验方案。两档都应包含完整核心流程；Plus 必须有清楚且已经实现的额外价值。当前主要差异是 20/60 的使用额度及页面上的 Priority support，尚不能证明支持服务已具备履约条件。

如果两档都承诺正常求职使用不限次数，又没有实际的功能或服务区别，建议讨论首发只开放一个 **USD 19/月** 的会员，再在有数据后决定 Plus。此处只是替代方案，未改变现有两卡设计。

建议首发只做月付，取消在已付费周期结束时生效；暂不增加年付、自动超额扣款和额外充值包。试用必须有独立的成本预算，不能直接把旧脚本中的 7 天完整试用当作已批准政策。价格、试用、用量边界、退款规则最终确定后，再同步价格页、结账页、条款和账户页。

作为支付意愿参考，Teal+ 当前官方报价为 USD 29/30 天，Huntr Pro 为 USD 40/月；二者功能更广，不能据此证明 Reachard 同价可卖。[Teal](https://www.tealhq.com/pricing)、[Huntr](https://huntr.co/pricing)。建议价格是待验证假设，并非市场验证结果。

## 月费能承担的成本

仅以美国标准在线银行卡费率 2.9% + USD 0.30，另加 Stripe Billing 按量方案 0.7% 做预算示例；尚未核对本账户合同费率、国际卡、换汇、税费及其他附加费用。[Payments](https://stripe.com/pricing)、[Billing](https://stripe.com/billing/pricing)。

以税前会员收入为分母，示例成本贡献率目标 80%：

`其他月度成本预算 = 月费 × (1 - 80% - 3.6%) - 0.30`

| 月费 | 示例支付 + Billing 费用 | 扣上述费用后收入 | 保持 80% 成本贡献率的其他成本预算 |
| --- | --- | --- | --- |
| USD 8 | USD 0.588 | USD 7.412 | USD 1.012 |
| USD 12 | USD 0.732 | USD 11.268 | USD 1.668 |
| USD 19 | USD 0.984 | USD 18.016 | USD 2.816 |
| USD 24 | USD 1.164 | USD 22.836 | USD 3.636 |

“其他成本”应包括供应商调用、模型、按用户分摊的基础设施、支持及退款/推荐活动成本。这个计算不是盈利承诺。尤其不能把“搜索对用户不额外收费”理解成搜索没有供应商成本。

成本记录已存在：Treg 从返回信息记录实际收费；OpenAI 从 token 用量估算，保存在 `api_usage.response.internalCost`。下一步应只读汇总现有记录，统计每个用户每个订阅周期的搜索、成功/未找到邮箱、草稿及重试成本，计算 P50/P90/P95、最高使用用户、缺失成本比例和供应商账单差异。本轮没有读取生产使用账本，因此无法确认旧价或新价的实际毛利；缺失成本不能视为零。

合理使用模式至少需要单用户并发、持续速率、月度成本预算和异常自动化控制。若实际执行的是月度数量上限，应公开这个上限。现有每分钟 API 限流不足以构成整月成本控制。

推荐奖励也须计入：现有逻辑按邀请人的套餐价给一个月余额抵扣，可能出现低价新客户带来高价奖励。需要决定奖励上限、实际付款门槛和退款后的处理；不能靠预计未来续费解释首月亏损。

## 上线前必修的实现问题

| 优先级 | 当前证据与影响 | 需要完成的结果 |
| --- | --- | --- |
| P0 | `server/src/index.js` 与 `web/app/api/account/route.ts` 未配置时默认 `BETA_UNLIMITED_USAGE=true` | 正式环境显式使用经确定的会员政策；前后端一致；防止未付费无限供应商调用 |
| P0 | `web/app/api/stripe/webhook/route.ts` 续费仍读 `invoice.subscription`，SDK 固定 Basil，而该字段已迁至 `invoice.parent.subscription_details.subscription` | 修复兼容字段读取并验证实际 webhook 版本；续费成功必须更新权益。未获取 Stripe 端点版本，故尚不能断言线上已经漏发 |
| P0 | API 的 `requireCredits` 只判断余额；余额通过历史账本求和，无订阅到期限制或周期过期语义 | 确定并实现订阅有效期、续费失败/取消/退款后的访问规则；不能把停止续费等同于立即失去已付款期间访问权 |
| P0 | `checkout.ts` 接受 `no_payment_required` 后也调用邀请购买奖励 | 将试用、零元折扣、真实付费、余额支付区分清楚，按确定的奖励资格发放，不让开始试用直接触发付费奖励 |
| P0 | `createCheckoutSession` 仅拦截本地 active/trialing，幂等键每分钟变化 | 防止多个未完成 Checkout、并发窗口或 past_due 用户产生重复订阅 |
| P1 | 续费只处理 `invoice.payment_succeeded`，不是覆盖所有已付账单状态；找不到 team/member 会返回并将事件标记完成 | 统一账单已付后的权益处理；覆盖余额抵扣、零额账单和乱序到达；暂未映射的本产品事件应可重试/告警 |
| P1 | 客户门户拿账户的第一个配置；新配置只含当前产品且允许 quantity 修改 | 使用 Reachard 专属配置及固定 quantity=1；Base/Plus 切换和按比例计费必须与权益同步 |
| P1 | 订阅变更直接采用事件快照；成功页重复调用可再次覆盖订阅信息 | 用最新对象及归属校验防止旧事件、旧 Checkout 覆盖当前订阅 |
| P1 | webhook 未处理退款/争议；条款没有明确退款办理规则 | 明确政策和人工/自动处理路径，处理权益及推荐奖励，不对用户承诺未实现流程 |
| P1 | `0011_billing_grant_idempotency.sql` 有首次/续费唯一索引，但 schema 声明未包含它们 | 只读确认生产索引实际存在；不能仅靠 `.onConflictDoNothing()` 认定幂等成立；不要盲跑含 DELETE 的旧迁移 |
| P1 | 定价页、条款、API 错误仍使用 Contact Kit；额度采用历史累加 | 按最终会员方案统一描述和周期语义；未确定结转规则前不可声称额度每月重置 |

字段变更依据：[Stripe Basil 官方说明](https://docs.stripe.com/changelog/basil/2025-03-31/adds-new-parent-field-to-invoicing-objects)。订阅 webhook 应包含续费、失败和状态变化的验证：[Stripe 官方订阅说明](https://docs.stripe.com/billing/subscriptions/webhooks)。

## 可执行的验收顺序

1. 核实审核草稿中的业务事实并提交给 Stripe，跟踪审核结果；不能把“已提交”报告成“已通过”。
2. 确定套餐价格、用量规则、试用、取消/退款及推荐规则，形成一份唯一的套餐定义。
3. 在独立测试配置修复上述生命周期问题；检查事件版本、签名和数据库唯一索引。
4. 验证首购且不访问成功页、重复/并发 webhook、跨月续费、失败重试、零额账单、邀请抵扣、升级降级、期末取消、退款以及重复 Checkout。金额与权益分别核对。
5. 只读核对正式 Price ID、Webhook 地址/事件、BASE_URL、专属 Customer Portal 配置、正式凭据是否安全配置，及生产实际使用政策。敏感值不进入代码或日志；服务端使用最小所需权限。
6. 税务另行核对销售地区、已有税务登记、产品分类和含税/未税价格；不能只打开 automatic_tax 就认定税务就绪。[Stripe Tax](https://docs.stripe.com/billing/taxes/collect-taxes)。
7. 部署和真实支付验证另行按具体范围执行。当前未做测试 Checkout、续费模拟、生产数据库核验或真实扣款，不能称已具备收款上线条件。
