import { describe, expect, it } from "vitest";
import { allocate, centavosToDecimalString, formatPeso, toCentavos } from "./money";

describe("toCentavos", () => {
  it.each([
    ["100", 10000],
    ["0.1", 10],
    ["0.10", 10],
    ["1,234.56", 123456],
    ["₱ 3,000", 300000],
    ["0.01", 1],
  ])("parses %s", (input, expected) => {
    expect(toCentavos(input)).toBe(expected);
  });

  it.each(["", "abc", "1.234", "-5", "1e3", "12.", ".5"])("rejects %j", (input) => {
    expect(() => toCentavos(input)).toThrow();
  });

  it("avoids float drift that 0.1 + 0.2 would cause", () => {
    expect(toCentavos("0.1") + toCentavos("0.2")).toBe(toCentavos("0.3"));
  });
});

describe("formatting", () => {
  it("formats pesos", () => {
    expect(formatPeso(123456)).toBe("₱1,234.56");
    expect(formatPeso(5)).toBe("₱0.05");
    expect(formatPeso(-500)).toBe("-₱5.00");
    expect(centavosToDecimalString(123405)).toBe("1234.05");
  });
});

describe("allocate", () => {
  it("splits ₱100 three ways without losing a centavo", () => {
    const parts = allocate(10000, [1, 1, 1]);
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(parts.reduce((a, b) => a + b)).toBe(10000);
  });

  it("gives leftovers to the largest remainders", () => {
    // 100 by 1:2 -> 33.33 / 66.67 -> remainder favors the second part
    expect(allocate(100, [1, 2])).toEqual([33, 67]);
  });

  it("respects zero weights", () => {
    expect(allocate(1000, [0, 1, 1])).toEqual([0, 500, 500]);
  });

  it("handles amounts large enough to overflow naive multiplication", () => {
    const total = 9_000_000_000_000; // ₱90 billion
    const parts = allocate(total, [3333, 3333, 3334]);
    expect(parts.reduce((a, b) => a + b)).toBe(total);
  });

  it("always sums to the total (randomized)", () => {
    for (let run = 0; run < 500; run++) {
      const total = Math.floor(Math.random() * 1_000_000);
      const weights: number[] = Array.from({ length: 1 + Math.floor(Math.random() * 10) }, () => Math.floor(Math.random() * 50));
      if (!weights.some((w) => w > 0)) weights[0] = 1;
      const parts = allocate(total, weights);
      expect(parts.reduce((a, b) => a + b)).toBe(total);
      parts.forEach((p, i) => {
        const exact = (total * weights[i]) / weights.reduce((a, b) => a + b);
        expect(Math.abs(p - exact)).toBeLessThan(1);
      });
    }
  });

  it("rejects invalid input", () => {
    expect(() => allocate(100, [0, 0])).toThrow();
    expect(() => allocate(-1, [1])).toThrow();
    expect(() => allocate(1.5, [1])).toThrow();
  });
});
