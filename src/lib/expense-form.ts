import { toCentavos, centavosToDecimalString, type Centavos } from "./money";
import { computeSplit, type SplitInput, type SplitShare, type SplitType } from "./splits";

/**
 * The expense form works with strings (what the user typed). These helpers convert
 * them to the integer inputs the split engine expects. Shared by the client-side
 * live preview and the server action, so both always agree.
 */
export interface ExpenseFormValues {
  description: string;
  category: string;
  amount: string;
  paidBy: string;
  splitType: SplitType;
  spentOn: string;
  splits: Record<string, string>; // memberId -> raw input ("1"/"0" for equal)
}

export function parseSplitValue(type: SplitType, raw: string): number {
  const value = raw.trim();
  if (value === "") return 0;
  switch (type) {
    case "equal":
      return value === "1" ? 1 : 0;
    case "exact":
      return toCentavos(value);
    case "percent":
      // "25.5" percent -> 2550 basis points; same 2-decimal rule as pesos.
      return toCentavos(value);
    case "shares": {
      if (!/^\d+$/.test(value)) throw new Error(`"${raw}" isn't a whole number of shares`);
      return Number(value);
    }
  }
}

export function toSplitInputs(values: ExpenseFormValues): SplitInput[] {
  return Object.entries(values.splits).map(([memberId, raw]) => ({
    memberId,
    value: parseSplitValue(values.splitType, raw),
  }));
}

export function previewSplit(values: ExpenseFormValues): { shares: SplitShare[] } | { error: string } {
  try {
    const amount = toCentavos(values.amount);
    return { shares: computeSplit(amount, values.splitType, toSplitInputs(values)) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid split" };
  }
}

/**
 * For exact and percent splits: how much is still unassigned, so the form can say
 * "₱200.00 left" or "over by 5%" while the user types. Units are centavos / basis points.
 */
export function remainingToAssign(values: ExpenseFormValues): { unit: "peso" | "percent"; left: number } | null {
  if (values.splitType !== "exact" && values.splitType !== "percent") return null;
  try {
    const assigned = toSplitInputs(values).reduce((sum, s) => sum + s.value, 0);
    const target = values.splitType === "percent" ? 10000 : toCentavos(values.amount || "0");
    return { unit: values.splitType === "percent" ? "percent" : "peso", left: target - assigned };
  } catch {
    return null;
  }
}

/** Turn a stored share back into what the form field should show. */
export function formatSplitValue(type: SplitType, inputValue: number): string {
  switch (type) {
    case "equal":
      return inputValue > 0 ? "1" : "0";
    case "exact":
    case "percent":
      return centavosToDecimalString(inputValue as Centavos).replace(/\.00$/, "");
    case "shares":
      return String(inputValue);
  }
}

/** Sensible starting value for each split type when the user switches modes. */
export function defaultSplitValue(type: SplitType, memberCount: number): string {
  switch (type) {
    case "equal":
      return "1";
    case "exact":
      return "";
    case "percent":
      return memberCount ? String(Math.floor(10000 / memberCount) / 100) : "";
    case "shares":
      return "1";
  }
}
