import { publicError } from './http.js';

// Process-local traffic controls. These do not measure or cap provider spend.
export function createRateLimiter({ windowMs, max, now = Date.now }) {
  const buckets = new Map();
  let nextCleanup = 0;
  return id => {
    const time = now();
    if (time >= nextCleanup) {
      for (const [key, bucket] of buckets) if (time - bucket.startedAt >= windowMs) buckets.delete(key);
      nextCleanup = time + windowMs;
    }
    let bucket = buckets.get(id);
    if (!bucket || time - bucket.startedAt >= windowMs) {
      bucket = {count:0, startedAt:time}; buckets.set(id,bucket);
    }
    if (bucket.count >= max) throw publicError('Too many requests. Try again shortly.',429,
      {retryAfter:Math.max(1,Math.ceil((bucket.startedAt+windowMs-time)/1000))});
    bucket.count += 1;
  };
}

export function createProviderUsageGuard({
  userConcurrency, globalConcurrency, failureThreshold, cooldownMs,
  now = Date.now, onCircuitChange = () => {},
}) {
  let active = 0;
  const users = new Map();
  const circuits = new Map();

  function rejected(message, status, retryAfter) {
    return publicError(message, status, { usageGuard: true, retryAfter });
  }

  return {
    async run(action, userId, operation) {
      if (!userId) throw new Error('A verified user is required for provider access.');
      let circuit = circuits.get(action);
      if (!circuit) {
        circuit = { failures: 0, openUntil: 0, probe: false, generation: 0 };
        circuits.set(action, circuit);
      }
      const time = now();
      if (circuit.openUntil > time || circuit.probe) {
        throw rejected('This service is temporarily unavailable. Please try again shortly.', 503,
          Math.max(1, Math.ceil((circuit.openUntil - time) / 1000)));
      }
      if ((users.get(userId) || 0) >= userConcurrency) {
        throw rejected('Please wait for your current request to finish.', 429, 2);
      }
      if (active >= globalConcurrency) {
        throw rejected('The service is busy. Please try again shortly.', 503, 2);
      }
      const probe = circuit.openUntil !== 0;
      if (probe) circuit.probe = true;
      const generation = circuit.generation;
      active += 1;
      users.set(userId, (users.get(userId) || 0) + 1);

      try {
        const result = await operation();
        // A response from before an outage must not close a newly opened circuit.
        if (generation === circuit.generation) {
          circuit.failures = 0;
          if (probe) {
            circuit.openUntil = 0;
            circuit.generation += 1;
            onCircuitChange({ action, state: 'closed' });
          }
        }
        return result;
      } catch (error) {
        const status = Number(error?.status || 0);
        const providerFailure = !error?.budgetGuard && (!status || status === 429 || status >= 500);
        if (generation === circuit.generation && providerFailure) {
          circuit.failures += 1;
          if (probe || circuit.failures >= failureThreshold) {
            circuit.openUntil = now() + cooldownMs;
            circuit.generation += 1;
            onCircuitChange({ action, state: 'open', retryAfter: Math.ceil(cooldownMs / 1000) });
          }
        } else if (generation === circuit.generation && probe) {
          // A client validation error says nothing about provider recovery.
          circuit.openUntil = now() + cooldownMs;
        }
        throw error;
      } finally {
        if (probe) circuit.probe = false;
        active -= 1;
        const remaining = users.get(userId) - 1;
        if (remaining) users.set(userId, remaining);
        else users.delete(userId);
      }
    },
  };
}
