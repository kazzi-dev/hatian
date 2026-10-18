import type { Centavos } from "./money";

export interface Transfer {
  from: string;
  to: string;
  amount: Centavos;
}

/** Above this many non-zero balances the exact search (O(n·2ⁿ)) falls back to greedy. */
export const EXACT_LIMIT = 16;

/**
 * Find the fewest payments that bring every balance to zero.
 *
 * Any group of k people whose balances sum to zero can always be settled with k-1
 * payments (greedy does that). So the fewest payments overall is
 *     n − (max number of disjoint zero-sum subgroups)
 * Finding that partition is NP-hard in general, but for the size of a barkada a bitmask DP
 * over subsets is instant: dp[mask] = max zero-sum groups that `mask` can be cut into.
 *
 * Example: A owes B ₱100, B owes C ₱100, C owes A ₱100 → everyone nets to 0 → no payments.
 */
export function simplifyDebts(balances: Map<string, Centavos>): Transfer[] {
  const people = [...balances.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const total = people.reduce((sum, [, amount]) => sum + amount, 0);
  if (total !== 0) throw new Error(`Balances must sum to zero (got ${total})`);
  if (people.length === 0) return [];
  if (people.length > EXACT_LIMIT) return greedySettle(people);

  return zeroSumGroups(people.map(([, amount]) => amount)).flatMap((group) =>
    greedySettle(group.map((i) => people[i])),
  );
}

/**
 * Partition indices of `amounts` into the maximum number of zero-sum groups.
 * Works by building a removal order along an optimal DP path: every prefix of that
 * order with sum 0 marks the end of one group.
 */
function zeroSumGroups(amounts: number[]): number[][] {
  const n = amounts.length;
  const full = (1 << n) - 1;
  const sum = new Float64Array(1 << n);
  const dp = new Int8Array(1 << n);

  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask;
    sum[mask] = sum[mask ^ low] + amounts[31 - Math.clz32(low)];
    let best = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) best = Math.max(best, dp[mask ^ (1 << i)]);
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
  }

  // Walk back from the full set, always removing an element that stays on an optimal path.
  const order: number[] = [];
  let mask = full;
  while (mask) {
    const target = dp[mask] - (sum[mask] === 0 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i) && dp[mask ^ (1 << i)] === target) {
        order.unshift(i);
        mask ^= 1 << i;
        break;
      }
    }
  }

  const groups: number[][] = [];
  let current: number[] = [];
  let running = 0;
  for (const i of order) {
    current.push(i);
    running += amounts[i];
    if (running === 0) {
      groups.push(current);
      current = [];
    }
  }
  return groups;
}

/**
 * Repeatedly match the biggest debtor with the biggest creditor. Each payment zeroes
 * at least one person, so k people take at most k−1 payments — but it can miss
 * zero-sum subgroups, which is why simplifyDebts partitions first.
 */
export function greedySettle(entries: [string, Centavos][]): Transfer[] {
  const creditors = entries.filter(([, a]) => a > 0).map(([id, a]) => ({ id, left: a }));
  const debtors = entries.filter(([, a]) => a < 0).map(([id, a]) => ({ id, left: -a }));
  const byLeftDesc = (x: { id: string; left: number }, y: { id: string; left: number }) =>
    y.left - x.left || (x.id < y.id ? -1 : 1);

  const transfers: Transfer[] = [];
  for (;;) {
    creditors.sort(byLeftDesc);
    debtors.sort(byLeftDesc);
    const c = creditors[0];
    const d = debtors[0];
    if (!c || !d || c.left === 0 || d.left === 0) break;
    const amount = Math.min(c.left, d.left);
    transfers.push({ from: d.id, to: c.id, amount });
    c.left -= amount;
    d.left -= amount;
  }
  return transfers;
}
