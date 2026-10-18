import { describe, expect, it } from "vitest";
import { computeSplit, SplitError } from "./splits";

const amountsOf = (shares: { memberId: string; amount: number }[]) =>
  Object.fromEntries(shares.map((s) => [s.memberId, s.amount]));

describe("computeSplit", () => {
  it("equal: ₱3,000 resort among 5", () => {
    const inputs = ["ana", "ben", "carlo", "dani", "eli"].map((memberId) => ({ memberId, value: 1 }));
    const shares = computeSplit(300000, "equal", inputs);
    expect(shares.every((s) => s.amount === 60000)).toBe(true);
  });

  it("equal: excluded members owe nothing", () => {
    const shares = computeSplit(10000, "equal", [
      { memberId: "a", value: 1 },
      { memberId: "b", value: 0 },
      { memberId: "c", value: 1 },
    ]);
    expect(amountsOf(shares)).toEqual({ a: 5000, c: 5000 });
  });

  it("exact: must add up to the total", () => {
    expect(
      amountsOf(
        computeSplit(1000, "exact", [
          { memberId: "a", value: 700 },
          { memberId: "b", value: 300 },
        ]),
      ),
    ).toEqual({ a: 700, b: 300 });
    expect(() =>
      computeSplit(1000, "exact", [
        { memberId: "a", value: 700 },
        { memberId: "b", value: 200 },
      ]),
    ).toThrow(/add up to ₱9.00/);
  });

  it("percent: basis points must total 100%", () => {
    const shares = computeSplit(10000, "percent", [
      { memberId: "a", value: 5000 },
      { memberId: "b", value: 3333 },
      { memberId: "c", value: 1667 },
    ]);
    expect(amountsOf(shares)).toEqual({ a: 5000, b: 3333, c: 1667 });
    expect(() => computeSplit(10000, "percent", [{ memberId: "a", value: 9000 }])).toThrow(/90%/);
  });

  it("shares: 'I ate double, count me twice'", () => {
    const shares = computeSplit(90000, "shares", [
      { memberId: "a", value: 2 },
      { memberId: "b", value: 1 },
    ]);
    expect(amountsOf(shares)).toEqual({ a: 60000, b: 30000 });
  });

  it("never loses a centavo on odd splits", () => {
    const shares = computeSplit(10001, "shares", [
      { memberId: "a", value: 1 },
      { memberId: "b", value: 1 },
      { memberId: "c", value: 1 },
    ]);
    expect(shares.reduce((s, x) => s + x.amount, 0)).toBe(10001);
  });

  it("rejects bad input", () => {
    expect(() => computeSplit(0, "equal", [{ memberId: "a", value: 1 }])).toThrow(SplitError);
    expect(() => computeSplit(100, "equal", [{ memberId: "a", value: 0 }])).toThrow(/at least one/);
    expect(() =>
      computeSplit(100, "equal", [
        { memberId: "a", value: 1 },
        { memberId: "a", value: 1 },
      ]),
    ).toThrow(/twice/);
    expect(() => computeSplit(100, "shares", [{ memberId: "a", value: 1.5 }])).toThrow(/whole/);
  });
});
