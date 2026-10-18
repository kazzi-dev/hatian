/**
 * All money in Hatian is an integer number of centavos (₱1 = 100 centavos).
 * Floats never touch a balance: ₱0.10 + ₱0.20 is exactly 30, not 30.000000000000004.
 */
export type Centavos = number;

const PESO_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Parse user input like "1,234.5" or "₱ 99" into centavos. Throws on anything ambiguous. */
export function toCentavos(input: string): Centavos {
  const cleaned = input.replace(/[₱,\s]/g, "");
  if (!PESO_PATTERN.test(cleaned)) {
    throw new Error(`"${input}" is not a valid peso amount (use up to 2 decimal places)`);
  }
  const [whole, frac = ""] = cleaned.split(".");
  const centavos = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos)) throw new Error(`"${input}" is too large`);
  return centavos;
}

/** 123456 -> "₱1,234.56", -500 -> "-₱5.00" */
export function formatPeso(centavos: Centavos): string {
  assertInteger(centavos);
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}₱${whole}.${frac}`;
}

/** 123456 -> "1234.56" (for form inputs and CSV) */
export function centavosToDecimalString(centavos: Centavos): string {
  assertInteger(centavos);
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Split `total` centavos proportionally to integer `weights` so the parts always
 * sum back to exactly `total` (largest remainder method).
 *
 *   allocate(10000, [1, 1, 1]) -> [3334, 3333, 3333]
 *
 * Leftover centavos go to the parts with the largest fractional remainder; ties go
 * to the earliest index, so the result is deterministic.
 */
export function allocate(total: Centavos, weights: number[]): Centavos[] {
  assertInteger(total);
  if (total < 0) throw new Error("Cannot allocate a negative amount");
  weights.forEach((w) => {
    assertInteger(w);
    if (w < 0) throw new Error("Weights must be non-negative");
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) throw new Error("At least one weight must be positive");

  // BigInt so total * weight can't overflow 2^53 for large amounts.
  const T = BigInt(total);
  const W = BigInt(weightSum);
  const parts = weights.map((w) => {
    const product = T * BigInt(w);
    return { base: Number(product / W), remainder: product % W };
  });

  let leftover = total - parts.reduce((sum, p) => sum + p.base, 0);
  const order = parts
    .map((p, index) => ({ index, remainder: p.remainder }))
    .sort((a, b) => (a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1));

  const result = parts.map((p) => p.base);
  for (const { index } of order) {
    if (leftover === 0) break;
    result[index] += 1;
    leftover -= 1;
  }
  return result;
}

function assertInteger(n: number) {
  if (!Number.isSafeInteger(n)) throw new Error(`Expected an integer, got ${n}`);
}
