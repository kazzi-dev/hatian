import { describe, expect, it } from "vitest";
import { computeBalances, pairwiseDebtCount } from "./balances";
import { greedySettle, simplifyDebts, type Transfer } from "./settle";

const balancesOf = (obj: Record<string, number>) => new Map(Object.entries(obj));

/** Apply transfers and check that everyone ends at exactly zero. */
function expectSettles(balances: Map<string, number>, transfers: Transfer[]) {
  const after = new Map(balances);
  for (const t of transfers) {
    expect(t.amount).toBeGreaterThan(0);
    after.set(t.from, (after.get(t.from) ?? 0) + t.amount);
    after.set(t.to, (after.get(t.to) ?? 0) - t.amount);
  }
  for (const v of after.values()) expect(v).toBe(0);
}

/** Brute force: n − (max zero-sum subsets) by trying every partition. Only for tiny n. */
function bruteMinTransfers(amounts: number[]): number {
  const nonzero = amounts.filter((a) => a !== 0);
  const best = (items: number[]): number => {
    if (items.length === 0) return 0;
    const [first, ...rest] = items;
    let groups = 0;
    // choose the zero-sum group containing `first`
    for (let mask = 0; mask < 1 << rest.length; mask++) {
      const chosen = rest.filter((_, i) => mask & (1 << i));
      if (chosen.reduce((a, b) => a + b, first) !== 0) continue;
      const remaining = rest.filter((_, i) => !(mask & (1 << i)));
      groups = Math.max(groups, 1 + best(remaining));
    }
    return groups;
  };
  return nonzero.length - best(nonzero);
}

describe("computeBalances", () => {
  it("tracks who paid and who owes", () => {
    const balances = computeBalances(
      ["ana", "ben", "carlo"],
      [
        {
          paidBy: "ben",
          amount: 300000,
          shares: [
            { memberId: "ana", amount: 100000 },
            { memberId: "ben", amount: 100000 },
            { memberId: "carlo", amount: 100000 },
          ],
        },
      ],
      [{ fromMember: "ana", toMember: "ben", amount: 40000 }],
    );
    expect(Object.fromEntries(balances)).toEqual({ ana: -60000, ben: 160000, carlo: -100000 });
  });
});

describe("simplifyDebts", () => {
  it("settles the example from the pitch", () => {
    const balances = balancesOf({ ana: -60000, ben: 100000, carlo: -40000 });
    const transfers = simplifyDebts(balances);
    expect(transfers).toEqual([
      { from: "ana", to: "ben", amount: 60000 },
      { from: "carlo", to: "ben", amount: 40000 },
    ]);
  });

  it("cancels a cycle (A owes B, B owes C, C owes A) to zero payments", () => {
    const shares = (debtor: string) => [{ memberId: debtor, amount: 10000 }];
    const expenses = [
      { paidBy: "B", amount: 10000, shares: shares("A") },
      { paidBy: "C", amount: 10000, shares: shares("B") },
      { paidBy: "A", amount: 10000, shares: shares("C") },
    ];
    expect(pairwiseDebtCount(expenses, [])).toBe(3);
    const balances = computeBalances(["A", "B", "C"], expenses, []);
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it("beats greedy when there is a hidden zero-sum subgroup", () => {
    // {A:-5, B:+2, C:+3} and {D:-4, E:+4} each net to zero.
    const balances = balancesOf({ A: -500, B: 200, C: 300, D: -400, E: 400 });
    const greedy = greedySettle([...balances.entries()]);
    const optimal = simplifyDebts(balances);
    expect(greedy).toHaveLength(4);
    expect(optimal).toHaveLength(3);
    expectSettles(balances, optimal);
  });

  it("matches brute force on random groups", () => {
    for (let run = 0; run < 300; run++) {
      const n = 2 + Math.floor(Math.random() * 7);
      const amounts = Array.from({ length: n - 1 }, () => (Math.floor(Math.random() * 9) - 4) * 100);
      amounts.push(0 - amounts.reduce((a, b) => a + b, 0));
      const balances = new Map(amounts.map((a, i) => [`m${i}`, a]));
      const transfers = simplifyDebts(balances);
      expectSettles(balances, transfers);
      expect(transfers).toHaveLength(bruteMinTransfers(amounts));
    }
  });

  it("falls back to greedy for very large groups and still settles", () => {
    const amounts = Array.from({ length: 30 }, (_, i) => (i % 2 ? 1 : -1) * (i + 1) * 100);
    amounts.push(0 - amounts.reduce((a, b) => a + b, 0));
    const balances = new Map(amounts.map((a, i) => [`m${String(i).padStart(2, "0")}`, a]));
    expectSettles(balances, simplifyDebts(balances));
  });

  it("refuses balances that don't sum to zero", () => {
    expect(() => simplifyDebts(balancesOf({ a: 100, b: -99 }))).toThrow();
  });
});
