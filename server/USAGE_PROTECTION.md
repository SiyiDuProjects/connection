# Provider traffic controls

Authenticated API calls are rate limited by the verified database user ID. Users
behind the same proxy no longer consume one shared API allowance. Missing or
invalid credentials are rate limited separately by the TCP socket address; the
server does not trust client-supplied forwarding headers. Invalid credentials
still require a database verification before being classified, so these limits
do not replace network-edge protection against authentication floods.

Actual search, reveal and draft operations share per-user and process-wide
concurrency limits. Each action has a failure circuit. Repeated upstream network,
429 or server errors stop new operations for a cooldown, then permit one recovery
probe. A late success from before an outage cannot prematurely close the circuit.
Normal no-result responses and client validation failures do not count as outages.
Circuit changes are recorded without input content in `provider.circuit_changed`.

Idempotent result replay happens before provider admission. Busy/circuit rejection
does not invoke the provider or debit credits, and the failed request claim can be
retried. A provider call that has already started retains its concurrency slot
until it settles, even if the client disconnects.

| Environment variable | Default | Purpose |
|---|---:|---|
| RATE_LIMIT_WINDOW_MS | 60000 | Request counting interval |
| RATE_LIMIT_MAX | 60 | Authenticated requests per user per interval |
| RATE_LIMIT_UNAUTHENTICATED_MAX | 60 | Rejected authentication requests per socket address per interval |
| PROVIDER_USER_CONCURRENCY | 2 | Simultaneous provider operations across all actions for one user |
| PROVIDER_GLOBAL_CONCURRENCY | 8 | Simultaneous provider operations in this server process |
| PROVIDER_FAILURE_THRESHOLD | 5 | Upstream failures before an action circuit opens |
| PROVIDER_CIRCUIT_COOLDOWN_MS | 30000 | Pause before one recovery probe |

Concurrency and circuit controls reset on process restart and are process-local.
The dollar budget is separate and persistent: `PROVIDER_DAILY_BUDGET_USD=10`
caps new Treg/OpenAI operations per UTC day across all users and replicas. Apply
database migration 0016 before enabling it. Missing database/schema or failed
admission blocks upstream calls. No automatic customer overage billing occurs.

Each HTTP call reserves a conservative maximum in a PostgreSQL transaction,
then settles its incremental provider cost. Timeouts and missing receipts retain
the entire hold until the UTC day ends; restarts do not free it. In-flight calls
are counted on the UTC day they were admitted. `provider_budget_days` records
spent plus reserved micro-USD; `provider_spend_reservations` is its receipt ledger.
Confirmed free Treg retries settle zero even when the header repeats original cost.
Unknown holds can reduce available service; reconcile them with provider receipts
before any manual release. Do not automatically release timeout holds.

Treg receives `X-Treg-Route-Max-Cost`: $0.0005 per requested search result or
$0.05 per reveal. Its current list prices are $0.00038/result and $0.026/enrichment.
OpenAI is restricted to the official gpt-5.6-luna Responses endpoint, 96 KB of
serialized text context, 4,096 output tokens, and pricing at least $0.20/$0.02/$1.20
per million input/cached/output tokens. Reservations include prompt/schema framing
headroom. OpenAI costs are token-based estimates; provider pricing changes require
review. An observed charge above its reservation records the actual cost and
blocks further calls that day. This is not a cap on other apps using the same keys
or infrastructure bills. Unsupported legacy providers are blocked while enabled.

80% budget admission and overrun/unknown/settlement events are logged without
request content. Health reports configuration/schema readiness, not remaining funds.
Operational alert delivery still requires a configured external monitor.

Run `npm run test:usage-guard` for the actual route/middleware fixture tests and
circuit tests. They use isolated account/provider doubles with no paid calls.
Run `npm run test:spend-budget` for PostgreSQL-backed concurrency, crash, timeout,
receipt, and failure-admission tests. These use PGlite locally, never production.
