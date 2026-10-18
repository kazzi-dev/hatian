import type { Centavos } from "./money";

export interface ExpenseForBalance {
  paidBy: string;
  amount: Centavos;
  shares: { memberId: string; amount: Centavos }[];
}

export interface SettlementForBalance {
  fromMember: string;
  toMember: string;
  amount: Centavos;
}

/**
 * Net balance per member. Positive = the group owes them; negative = they owe the group.
 * The balances of a group always sum to exactly zero.
 */
export function computeBalances(
  memberIds: string[],
  expenses: ExpenseForBalance[],
  settlements: SettlementForBalance[],
): Map<string, Centavos> {
  const balances = new Map<string, Centavos>(memberIds.map((id) => [id, 0]));
  const add = (id: string, delta: Centavos) => balances.set(id, (balances.get(id) ?? 0) + delta);

  for (const e of expenses) {
    add(e.paidBy, e.amount);
    for (const s of e.shares) add(s.memberId, -s.amount);
  }
  for (const s of settlements) {
    // Paying someone back raises your balance and lowers theirs.
    add(s.fromMember, s.amount);
    add(s.toMember, -s.amount);
  }

  const total = [...balances.values()].reduce((a, b) => a + b, 0);
  if (total !== 0) throw new Error(`Balances do not sum to zero (off by ${total} centavos)`);
  return balances;
}

/**
 * The "naive" way to settle: everyone pays back whoever fronted each expense,
 * netted per pair of people. Used to show how many payments simplification saves.
 */
export function pairwiseDebtCount(expenses: ExpenseForBalance[], settlements: SettlementForBalance[]): number {
  const net = new Map<string, Centavos>(); // key "a|b" with a < b: positive means a owes b
  const owe = (debtor: string, creditor: string, amount: Centavos) => {
    if (debtor === creditor || amount === 0) return;
    const [a, b, sign] = debtor < creditor ? [debtor, creditor, 1] : [creditor, debtor, -1];
    const key = `${a}|${b}`;
    net.set(key, (net.get(key) ?? 0) + sign * amount);
  };
  for (const e of expenses) for (const s of e.shares) owe(s.memberId, e.paidBy, s.amount);
  for (const s of settlements) owe(s.toMember, s.fromMember, s.amount);
  return [...net.values()].filter((v) => v !== 0).length;
}
