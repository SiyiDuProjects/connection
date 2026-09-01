# Reachard 联系人数据供应商测试计划

更新时间：2026-08-30

## 1. 目标

等回到美国并取得各供应商试用密钥后，用同一批查询同时验证：

- 能不能找到正确的人；
- 当前公司、职位、学校、地点是否准确；
- 是否返回可直接打开的 LinkedIn 个人主页；
- 工作邮箱命中率和错误率；
- 延迟、限流和故障率；
- 每次搜索、每个有效邮箱、每个完整 Contact Kit 的真实成本；
- 是否书面允许把数据展示给 Reachard 的付费用户。

本测试不发送邮件、不自动访问 LinkedIn、不把 API 密钥或原始个人数据提交到 Git。

## 2. 待测方案

| 编号 | 搜人 | 邮箱 | 定位 |
| --- | --- | --- | --- |
| A | Fresh LinkedIn Scraper / SaleLeads | Hunter Email Finder | 当前低成本基线 |
| B | Crustdata indexed Person Search | Hunter Email Finder | 首选候选架构 |
| C | Crustdata indexed Person Search | Crustdata Person Enrich + business email | 单供应商候选 |
| D | Apollo People Search | Apollo People Match | 技术和成本参考；标准套餐不能用于外部 SaaS |
| E | People Data Labs 或 Coresignal | 各自联系人能力 | 仅用免费试用作质量上限参考 |

不测试 Crustdata 的 live person search，除非 indexed search 的新鲜度不达标。Live search 为每个 profile 2 credits，成本远高于 indexed search 的每个结果 0.03 credits。

## 3. Reachard 的硬性要求

任何最终方案都必须满足：

1. 结果包含有效且可点击的 `linkedin.com/in/...` URL。
2. 支持当前公司、职位/职能、地点和学校/校友筛选。
3. 默认只揭示工作邮箱，不揭示个人邮箱和电话。
4. 错人邮箱率低于 1%。
5. 供应商书面允许 API 数据出现在 Reachard 这类外部付费产品中。
6. 可处理删除、更正和退出数据请求，并明确缓存保留期限。
7. 满负载时，单个成功 Contact Kit 的数据成本目标不超过 $0.05，绝对上限 $0.08。

Reachard 当前套餐的满额收入基准：

- Base：$8 / 20 Kits = $0.40/Kit；
- Plus：$12 / 60 Kits = $0.20/Kit。

以上只是数据成本预算，不包含 Stripe 手续费、AI、服务器和客服成本。

## 4. 分阶段测试

### 阶段 0：合同与价格门槛

在调用真实数据前取得以下书面答案。没有通过这一阶段的供应商只能做内部参考，不能上线。

**Crustdata**

- $95/月最低档实际包含多少 credits，超额 credit 单价是多少；
- 是否包含 indexed `/person/search` 和 `/person/enrich`；
- 是否允许在 Reachard 中向终端用户展示姓名、职位、学校、公司和 LinkedIn URL；
- 是否允许缓存，允许多久，取消服务后怎样删除；
- business email 缺失时到底消耗 0、1 还是 2 credits；
- 生产速率、SLA、接口变更通知和数据更正/删除机制。

**Hunter**

- 确认 Reachard 的第三方产品/API 使用方式受当前套餐许可；
- 确认低量 Data Platform 的实际结账价格；
- 确认 Email Finder 自动验证后是否无需另购 Verification credits；
- 确认用 LinkedIn handle 与“姓名 + 公司域名”查询时的计费一致。

**Fresh / SaleLeads**

- 在已登录 RapidAPI 的 Pricing 页记录当天套餐、请求额度、超额费和速率；
- 取得外部 SaaS 展示权、数据来源、缓存期限、SLA 和下线通知的书面说明。

### 阶段 1：20 个查询冒烟测试

所有方案跑完全相同的 20 个查询，每个查询最多取 10 人。目的不是决胜，只是排除：字段不够、URL 缺失、明显错人、接口不稳定或成本模型不成立的供应商。

20 个查询至少包含：

- 5 个大型美国科技公司；
- 4 个中型科技公司；
- 3 个创业公司；
- 3 个非科技行业公司；
- 3 个带学校条件的查询；
- 2 个易混淆案例，如同名公司、子公司、相近职位或 remote 地点。

阶段 1 淘汰线：

- 有效 LinkedIn URL 比例低于 95%；
- 当前公司准确率低于 90%；
- 学校条件无法工作；
- 20 次中出现超过 1 次不可恢复的 5xx/timeout；
- 无法获得外部产品使用许可。

### 阶段 2：100 个查询主测试

只让阶段 1 最好的两套方案参加。冻结 100 个查询，提供商收到完全相同的原始条件，第一轮不得做供应商专属调参。

建议构成：

- 25 个大型公司；
- 20 个中型公司；
- 15 个创业公司；
- 15 个金融、咨询、医疗或制造公司；
- 15 个学校/校友强约束查询；
- 10 个同名、子公司、地点或职位边界案例。

每个查询人工检查前 5 名；随机再检查第 6–10 名中的 2 人。优先打开供应商返回的 LinkedIn URL，记录当日页面上可见的当前公司、职位、学校和地点。不要通过自动化脚本抓取 LinkedIn。

### 阶段 3：200 人邮箱测试

从阶段 2 中按公司规模、职位、学校和地区分层抽取 200 人。两套候选方案使用同一个人和同一公司域名揭示邮箱。

记录：

- 是否找到邮箱；
- 是否为当前公司域名；
- 是否匹配正确的人；
- provider 的 verification/status/source；
- 是否 catch-all、unknown 或 risky；
- 没找到时是否仍扣费；
- 延迟和真实账单消耗。

不通过发信来验证邮箱。需要更强 ground truth 时，使用独立 verifier 只验证 finalists 的结果；任何真实外联另行批准。

## 5. 指标与计算

### 搜人质量

- `Result yield`：返回非重复候选数 / 请求候选数；
- `LinkedIn URL coverage`：有效个人主页 URL / 返回结果；
- `Current company precision`：当前公司正确 / 人工检查结果；
- `Role precision@5`：前 5 名中职位/职能符合条件的比例；
- `School precision`：带学校条件时学校正确的比例；
- `Location precision`：地点符合条件的比例；
- `Duplicate rate`：重复人物 / 返回结果；
- `Freshness`：已离职、旧职位或旧公司的记录比例。

### 邮箱质量

- `Found rate`：找到工作邮箱 / reveal 尝试；
- `Usable rate`：valid 或可接受状态的工作邮箱 / reveal 尝试；
- `Wrong-person rate`：邮箱属于错误人物 / 找到邮箱；
- `Current-domain rate`：当前公司域名一致 / 找到邮箱；
- `Cost per usable email`：邮箱总支出 / usable 邮箱数。

### 工程稳定性

- p50 / p95 延迟；
- 429、5xx、timeout 和 schema error 比例；
- 一次重试后的恢复率；
- 实测持续吞吐量；
- API 字段或计费与文档不一致的次数。

### 总成本

统一使用真实账单增量，而不是只用供应商声称的 credit 数：

```text
每次搜索成本 = 搜索相关总支出 / 搜索次数
每个合格候选人成本 = 搜索相关总支出 / 人工确认合格人数
每个有效邮箱成本 = reveal 相关总支出 / usable 邮箱数
每个成功 Kit 成本 = (搜索 + reveal 的可归属支出) / 成功 Kit 数
```

固定月费同时给出两种结果：

1. `边际成本`：只看 credits/overage；
2. `全摊成本`：月费 + overage 全部除以当月实际成功量。

## 6. 评分与决策

合规许可是硬门槛，不进入加权评分。通过许可门槛后：

| 维度 | 权重 |
| --- | ---: |
| 搜人准确度、学校能力和 URL 完整度 | 40% |
| 邮箱有效命中率与错人率 | 25% |
| 真实全摊成本 | 20% |
| 延迟、限流和稳定性 | 15% |

最终上线门槛：

- LinkedIn URL coverage ≥ 95%；
- Current company precision ≥ 95%；
- Role precision@5 ≥ 80%；
- Wrong-person email rate < 1%；
- 不可恢复请求失败率 < 2%；
- 成功 Kit 数据成本目标 ≤ $0.05，最多不超过 $0.08；
- 已取得明确的外部 SaaS 展示许可。

若两套方案总分相差不超过 5 分，选择依赖更少、合同更清楚、迁移更容易的一套，而不是为微小命中率差异增加复杂度。

## 7. 测试记录格式

每一行记录一个 provider 返回的人：

```csv
scenario_id,provider,query_company,query_domain,query_title,query_location,query_school,rank,returned_name,returned_title,returned_company,linkedin_url,url_valid,current_company_correct,role_relevant,school_correct,location_correct,duplicate,search_latency_ms,search_cost_units,reveal_attempted,email_found,email_domain_match,verification_status,reveal_latency_ms,reveal_cost_units,reviewer,reviewed_at,notes
```

保存原则：

- API key 仅放本地 `.env`，不能进入测试 CSV、日志或 Git；
- 原始 JSON 放本地 gitignored 目录，并设置自动删除日期；
- 可提交的汇总只保留指标，不保留邮箱；
- 10% 样本隔一天复核一次，降低人工判断偏差。

## 8. 当前公开价格快照

价格随时会变，正式测试当天重新截图或导出账单。

| 供应商 | 公开价格/计费 | 对 Reachard 的含义 |
| --- | --- | --- |
| Crustdata | indexed person search 为 0.03 credits/结果；base profile 1 credit，business email 再加 1；最低档公开称约 $95/月，但每 credit 美元价格未公开 | 10 人搜索消耗 0.3 credits，但现阶段无法算出美元成本；低流量时 $95 固定费可能较重 |
| Hunter Data Platform | 官方帮助中心示例：1,000 Search + 1,000 Verification 为 $61/年，其中 Search $50；没找到邮箱不扣 Search credit | 低量约 $0.05/成功找到邮箱；需确认当前结账页和是否必须购买 Verification |
| Hunter Starter | $34/月，按年付 $408，24,000 credits/年 | 满额使用约 $0.017/成功找到邮箱；量上来后比低量包更便宜 |
| Apollo Basic | $49/seat/月，年付；30,000 credits/年；email 1 credit | 理论约 $0.0196/email，但标准套餐明确只许内部使用，不能直接用于 Reachard |
| Fresh / SaleLeads | 供应商旧公开页及近期第三方快照约 $49/月、20,000 requests，超额约 $0.008/request；必须在 RapidAPI 登录页复核 | 若平均 4 个请求/搜索，摊薄约 $0.0098/搜索；若当前实现最坏 10 个请求则约 $0.0245/搜索 |
| People Data Labs | Person Pro 从 $98/月、350 records 起 | 入门约 $0.28/record，作为当前套餐主数据源明显偏贵 |
| Coresignal | Mini $49/月、2,500 credits；employee record 10–20 credits，contact enrichment 20 credits | 约 $0.196–$0.392/employee record，10 人搜索约 $1.96–$3.92，当前定价承受不了 |

公开资料：

- [Crustdata pricing](https://docs.crustdata.com/general/pricing)
- [Crustdata Person Search](https://docs.crustdata.com/person-docs/search/introduction)
- [Crustdata minimum-plan context](https://www.crustdata.com/blog/data-enrichment-cost)
- [Hunter Data Platform](https://help.hunter.io/en/articles/9920427-data-platform-plans-for-api-users)
- [Hunter pricing](https://hunter.io/pricing/)
- [Hunter API credits and rate limits](https://help.hunter.io/en/articles/12149400-hunter-api-for-data-plans)
- [Hunter Terms of Service](https://hunter.io/terms-of-service)
- [Apollo pricing and external-use restriction](https://www.apollo.io/pricing)
- [SaleLeads documented API](https://docs.saleleads.ai/api-reference/search/search-people)
- [Recent third-party Fresh/SaleLeads price snapshot](https://coldiq.com/tools/saleleads)
- [People Data Labs self-serve pricing](https://docs.peopledatalabs.com/docs/create-an-account)
- [People Data Labs data license](https://privacy.peopledatalabs.com/policies?name=services-subscription-agreement)
- [Coresignal pricing](https://coresignal.com/pricing/)
- [LinkedIn crawling terms](https://www.linkedin.com/legal/crawling-terms)

## 9. 当前暂定结论

1. **最好用的候选架构**：Crustdata indexed Person Search + Hunter Email Finder。它满足公司、职位、学校、地点和可点击 LinkedIn URL，搜索与邮箱也能独立替换。
2. **公开价格下最容易做便宜的架构**：优化后的 Fresh + Hunter。但 Fresh 的确切 RapidAPI 价格需登录确认，而且 scraper 的连续性与 LinkedIn 平台风险高于数据库型供应商。
3. **不能直接作为生产答案**：Apollo 的标准价技术上很便宜，但其公开定价页明确禁止用标准套餐为外部客户产品供数；只有拿到 custom agreement 后才可重新比较。
4. **Crustdata 是否真是性价比最高仍未证明**：必须先拿到 $/credit、包含额度和外部展示许可。若 Crustdata 的全摊搜索成本超过 $0.01/次，或者成功 Kit 总数据成本超过 $0.08，它就不适合 Reachard 当前 $8/$12 套餐。
5. **保留一个简化选项**：阶段 3 同时比较 Hunter 与 Crustdata business email。若 Crustdata 邮箱的 usable rate 不低于 Hunter、且每个有效邮箱更便宜，可改成 Crustdata 单供应商，减少一次集成。

在完成阶段 0–3 前，不更换生产 provider。
