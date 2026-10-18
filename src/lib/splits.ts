import { allocate, formatPeso, type Centavos } from "./money";

export const SPLIT_TYPES = ["equal", "exact", "percent", "shares"] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

/**
 * What the user entered for one member. Meaning of `value` depends on the split type:
 *  - equal:   1 = included, 0 = excluded
 *  - exact:   centavos this member owes
 *  - percent: basis points (25.5% = 2550), must total 10000
 *  - shares:  integer shares ("I ate double" = 2)
 */
export interface SplitInput {
  memberId: string;
  value: number;
}

export interface SplitShare {
  memberId: string;
  amount: Centavos;
}

export class SplitError extends Error {}

/** Turn an expense amount + split inputs into the exact centavos each member owes. */
export function computeSplit(amount: Centavos, type: SplitType, inputs: SplitInput[]): SplitShare[] {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new SplitError("Amount must be greater than zero");
  for (const input of inputs) {
    if (!Number.isSafeInteger(input.value) || input.value < 0) {
      throw new SplitError("Split values must be whole, non-negative numbers");
    }
  }
  const ids = inputs.map((i) => i.memberId);
  if (new Set(ids).size !== ids.length) throw new SplitError("A member appears twice in the split");

  const active = inputs.filter((i) => i.value > 0);
  if (active.length === 0) throw new SplitError("Pick at least one person to split with");

  let amounts: Centavos[];
  switch (type) {
    case "equal":
      amounts = allocate(amount, active.map(() => 1));
      break;
    case "exact": {
      amounts = active.map((i) => i.value);
      const sum = amounts.reduce((a, b) => a + b, 0);
      if (sum !== amount) {
        throw new SplitError(`Exact amounts add up to ${formatPeso(sum)}, but the expense is ${formatPeso(amount)}`);
      }
      break;
    }
    case "percent": {
      const bps = active.reduce((a, i) => a + i.value, 0);
      if (bps !== 10000) throw new SplitError(`Percentages add up to ${bps / 100}%, not 100%`);
      amounts = allocate(amount, active.map((i) => i.value));
      break;
    }
    case "shares":
      amounts = allocate(amount, active.map((i) => i.value));
      break;
    default:
      throw new SplitError(`Unknown split type: ${type satisfies never}`);
  }

  return active.map((i, idx) => ({ memberId: i.memberId, amount: amounts[idx] }));
}

export function isSplitType(value: unknown): value is SplitType {
  return typeof value === "string" && (SPLIT_TYPES as readonly string[]).includes(value);
}
