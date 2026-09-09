import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { publicError, writeLog } from './http.js';

let connection;
let budget;
const MICRO_USD = 1_000_000;

export function dailyBudgetMicroUsd() {
  const raw = process.env.PROVIDER_DAILY_BUDGET_USD;
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || Math.round(value * MICRO_USD) <= 0 || !Number.isSafeInteger(Math.round(value * MICRO_USD))) {
    throw new Error('PROVIDER_DAILY_BUDGET_USD must be a positive USD amount.');
  }
  return Math.round(value * MICRO_USD);
}

export function providerBudgetEnabled() { return dailyBudgetMicroUsd() !== null; }

function unavailable(message = 'This service has reached its daily usage limit. Please try again tomorrow.') {
  return publicError(message, 503, { budgetGuard: true, usageGuard: true });
}

function getBudget() {
  if (!process.env.POSTGRES_URL) throw unavailable('This service is temporarily unavailable. Please try again later.');
  if (!connection) connection = postgres(process.env.POSTGRES_URL, { max: 3, connect_timeout: 10 });
  if (!budget) budget = createSpendBudget(connection);
  return budget;
}

// The callback returns its result and the provider's incremental charge. null
// means unknown, never zero. Unknown outcomes retain their complete reservation.
export async function withProviderBudget(details, operation) {
  const limitMicroUsd = dailyBudgetMicroUsd();
  if (limitMicroUsd === null) return (await operation()).value;
  const store = getBudget();
  return runBudgetedOperation(store, { ...details, limitMicroUsd }, operation);
}

export async function runBudgetedOperation(store, details, operation) {
  const hold = await store.reserve(details);
  let outcome;
  try { outcome = await operation(); }
  catch (error) {
    // A transport failure can hide a charged response. Do not release its hold.
    writeLog('warn', 'provider.budget_outcome_unknown', { reservationId: hold.id, provider: details.provider });
    throw error;
  }
  try {
    const settled = await store.settle(hold.id, outcome.costMicroUsd);
    if (settled.breached) writeLog('error', 'provider.budget_price_exceeded', {
      reservationId: hold.id, provider: details.provider, reservedMicroUsd: details.maximumMicroUsd,
      actualMicroUsd: outcome.costMicroUsd,
    });
  } catch {
    // The original hold is durable and stays unavailable to other callers.
    writeLog('error', 'provider.budget_settlement_failed', { reservationId: hold.id, provider: details.provider });
  }
  return outcome.value;
}

export function createSpendBudget(sql) {
  return {
    async reserve({ provider, action, customerId, maximumMicroUsd, limitMicroUsd }) {
      for (const amount of [maximumMicroUsd, limitMicroUsd]) {
        if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid budget amount.');
      }
      return sql.begin(async tx => {
        const [clock] = await tx`select (current_timestamp at time zone 'UTC')::date::text as day`;
        const day = clock.day;
        await tx`insert into provider_budget_days (day, limit_micro_usd)
          values (${day}, ${limitMicroUsd}) on conflict (day) do nothing`;
        // Atomic admission is shared by all processes. A restarted server never
        // resets spend. An older replica cannot increase today's configured cap.
        const [admitted] = await tx`update provider_budget_days
          set reserved_micro_usd = reserved_micro_usd + ${maximumMicroUsd},
              limit_micro_usd = least(limit_micro_usd, ${limitMicroUsd}), updated_at = now()
          where day = ${day} and not breached
            and spent_micro_usd + reserved_micro_usd + ${maximumMicroUsd} <= least(limit_micro_usd, ${limitMicroUsd})
          returning day, spent_micro_usd, reserved_micro_usd, limit_micro_usd, alert_emitted`;
        if (!admitted) throw unavailable();
        const id = randomUUID();
        await tx`insert into provider_spend_reservations
          (id, day, provider, action, customer_id, reserved_micro_usd)
          values (${id}, ${day}, ${String(provider).slice(0,80)}, ${String(action).slice(0,80)},
            ${customerId == null ? null : String(customerId).slice(0,80)}, ${maximumMicroUsd})`;
        if (!admitted.alert_emitted && Number(admitted.spent_micro_usd) + Number(admitted.reserved_micro_usd) >= Number(admitted.limit_micro_usd) * 0.8) {
          await tx`update provider_budget_days set alert_emitted = true where day = ${day}`;
          writeLog('warn', 'provider.daily_budget_80_percent', { day, limitMicroUsd: Number(admitted.limit_micro_usd) });
        }
        return { id, day };
      });
    },

    async settle(id, costMicroUsd) {
      if (costMicroUsd == null || !Number.isSafeInteger(costMicroUsd) || costMicroUsd < 0) return { unknown: true };
      return sql.begin(async tx => {
        const [row] = await tx`select * from provider_spend_reservations where id = ${id} for update`;
        if (!row) throw new Error('Unknown provider reservation.');
        if (row.actual_micro_usd != null) return { replayed: true, breached: Number(row.actual_micro_usd) > Number(row.reserved_micro_usd) };
        const breached = costMicroUsd > Number(row.reserved_micro_usd);
        await tx`update provider_spend_reservations set actual_micro_usd = ${costMicroUsd}, settled_at = now() where id = ${id}`;
        await tx`update provider_budget_days
          set reserved_micro_usd = reserved_micro_usd - ${Number(row.reserved_micro_usd)},
              spent_micro_usd = spent_micro_usd + ${costMicroUsd},
              breached = breached or ${breached}, updated_at = now()
          where day = ${row.day}`;
        return { breached };
      });
    },
  };
}

export async function checkProviderBudget() {
  const limit = dailyBudgetMicroUsd();
  if (limit === null) return { enabled: false };
  getBudget();
  const [schema] = await connection`select to_regclass('public.provider_budget_days') is not null
    and to_regclass('public.provider_spend_reservations') is not null as ready`;
  if (!schema?.ready) throw new Error('Provider budget schema is missing.');
  return { enabled: true, dailyLimitUsd: limit / MICRO_USD, timezone: 'UTC', persistent: true };
}

export async function closeProviderBudget() { if (connection) await connection.end(); }
