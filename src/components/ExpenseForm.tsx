"use client";

import { useActionState, useMemo, useState } from "react";
import { saveExpenseAction, type ActionState } from "@/app/actions";
import {
  defaultSplitValue,
  previewSplit,
  remainingToAssign,
  type ExpenseFormValues,
} from "@/lib/expense-form";
import { formatPeso } from "@/lib/money";
import { SPLIT_TYPES, type SplitType } from "@/lib/splits";
import { Spinner } from "./SubmitButton";
import { Avatar, CATEGORY_EMOJI } from "./ui";

const SPLIT_LABELS: Record<SplitType, { label: string; hint: string }> = {
  equal: { label: "Equally", hint: "Everyone ticked pays the same." },
  exact: { label: "Exact ₱", hint: "Type how much each person owes." },
  percent: { label: "Percent", hint: "Percentages must add up to 100%." },
  shares: { label: "Shares", hint: "Ate double? Give yourself 2 shares." },
};

interface Props {
  groupId: string;
  expenseId: string | null;
  members: { id: string; name: string }[];
  categories: readonly string[];
  initial: ExpenseFormValues;
}

export function ExpenseForm({ groupId, expenseId, members, categories, initial }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveExpenseAction.bind(null, groupId, expenseId),
    {},
  );
  const [values, setValues] = useState<ExpenseFormValues>(initial);
  const set = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const setSplitType = (splitType: SplitType) =>
    setValues((v) => ({
      ...v,
      splitType,
      splits: Object.fromEntries(members.map((m) => [m.id, defaultSplitValue(splitType, members.length)])),
    }));
  const setSplit = (memberId: string, raw: string) =>
    setValues((v) => ({ ...v, splits: { ...v.splits, [memberId]: raw } }));
  const setAllEqual = (included: boolean) =>
    setValues((v) => ({ ...v, splits: Object.fromEntries(members.map((m) => [m.id, included ? "1" : "0"])) }));

  const preview = useMemo(() => previewSplit(values), [values]);
  const remaining = useMemo(() => remainingToAssign(values), [values]);
  const shareOf = (id: string) => ("shares" in preview ? preview.shares.find((s) => s.memberId === id)?.amount : undefined);
  const everyoneIncluded = members.every((m) => values.splits[m.id] === "1");
  const hasAmount = values.amount.trim() !== "";

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="payload" value={JSON.stringify(values)} />

      {/* Amount first: it's the one thing everyone knows */}
      <div>
        <label className="label" htmlFor="amount">How much?</label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-2xl text-stone-400">
            ₱
          </span>
          <input
            id="amount"
            className="field money py-3 pl-10 text-3xl"
            inputMode="decimal"
            placeholder="0.00"
            autoFocus={!expenseId}
            autoComplete="off"
            value={values.amount}
            onChange={(e) => set("amount", e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">What was it for?</label>
        <input
          id="description"
          className="field"
          placeholder="e.g. Resort, 2 nights"
          autoComplete="off"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          required
        />
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={values.category === c}
              onClick={() => set("category", c)}
              className="chip min-h-8 py-0.5 pl-2.5 pr-3 text-xs capitalize"
            >
              <span aria-hidden>{CATEGORY_EMOJI[c]}</span>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <span className="label" id="paid-by-label">Paid by</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="paid-by-label">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={values.paidBy === m.id}
                onClick={() => set("paidBy", m.id)}
                className="chip"
              >
                <Avatar id={m.id} name={m.name} size="sm" />
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="spentOn">Date</label>
          <input
            id="spentOn"
            type="date"
            className="field"
            value={values.spentOn}
            onChange={(e) => set("spentOn", e.target.value)}
          />
        </div>
      </div>

      <div>
        <span className="label" id="split-label">Split</span>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-stone-100 p-1" role="radiogroup" aria-labelledby="split-label">
          {SPLIT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={values.splitType === t}
              onClick={() => setSplitType(t)}
              className={`min-h-9 rounded-lg px-1 text-sm font-medium transition ${
                values.splitType === t ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {SPLIT_LABELS[t].label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <p className="text-stone-500">{SPLIT_LABELS[values.splitType].hint}</p>
          {values.splitType === "equal" && (
            <button
              type="button"
              className="shrink-0 font-medium text-emerald-700 hover:underline"
              onClick={() => setAllEqual(!everyoneIncluded)}
            >
              {everyoneIncluded ? "Clear all" : "Select all"}
            </button>
          )}
          {remaining && hasAmount && <RemainingBadge {...remaining} />}
        </div>

        <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
          {members.map((m) => {
            const raw = values.splits[m.id] ?? "";
            const share = shareOf(m.id);
            const included = values.splitType === "equal" ? raw === "1" : raw.trim() !== "" && raw.trim() !== "0";
            return (
              <li key={m.id} className={`flex items-center gap-3 px-3 py-2 ${included ? "" : "bg-stone-50/70"}`}>
                {values.splitType === "equal" ? (
                  <label className="flex min-h-9 flex-1 cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-emerald-700"
                      checked={included}
                      onChange={(e) => setSplit(m.id, e.target.checked ? "1" : "0")}
                    />
                    <Avatar id={m.id} name={m.name} size="sm" />
                    <span className={included ? "" : "text-stone-400"}>{m.name}</span>
                  </label>
                ) : (
                  <>
                    <label htmlFor={`split-${m.id}`} className="flex flex-1 items-center gap-3 text-sm">
                      <Avatar id={m.id} name={m.name} size="sm" />
                      <span className={included ? "" : "text-stone-400"}>{m.name}</span>
                    </label>
                    {values.splitType === "shares" ? (
                      <Stepper
                        id={`split-${m.id}`}
                        name={m.name}
                        value={raw}
                        onChange={(v) => setSplit(m.id, v)}
                      />
                    ) : (
                      <div className="relative">
                        <input
                          id={`split-${m.id}`}
                          className="field money w-28 py-1.5 pr-7 text-right"
                          inputMode="decimal"
                          value={raw}
                          placeholder="0"
                          autoComplete="off"
                          onChange={(e) => setSplit(m.id, e.target.value)}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-2.5 grid place-items-center text-xs text-stone-400">
                          {values.splitType === "percent" ? "%" : "₱"}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <span className="money w-24 text-right text-sm text-stone-600">
                  {share !== undefined ? formatPeso(share) : <span className="text-stone-300">—</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{state.error}</p>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 rounded-b-2xl border-t border-stone-100 bg-white/95 p-4 backdrop-blur">
        <button className="btn-primary w-full text-base" disabled={pending || "error" in preview} aria-busy={pending}>
          {pending && <Spinner />}
          {pending
            ? "Saving…"
            : !hasAmount
              ? "Enter an amount to continue"
              : remaining && remaining.left !== 0
                ? remaining.left > 0
                  ? `Assign ${remaining.unit === "peso" ? formatPeso(remaining.left) : `${remaining.left / 100}%`} more to continue`
                  : "Split is more than the total"
                : "shares" in preview
              ? `${expenseId ? "Save" : "Add"} ${formatPeso(preview.shares.reduce((s, x) => s + x.amount, 0))} expense`
              : preview.error}
        </button>
      </div>
    </form>
  );
}

function RemainingBadge({ unit, left }: { unit: "peso" | "percent"; left: number }) {
  const fmt = (n: number) => (unit === "peso" ? formatPeso(n) : `${n / 100}%`);
  const done = left === 0;
  return (
    <span
      role="status"
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        done ? "bg-emerald-50 text-emerald-800" : left > 0 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"
      }`}
    >
      {done ? "✓ All assigned" : left > 0 ? `${fmt(left)} left` : `Over by ${fmt(-left)}`}
    </span>
  );
}

function Stepper({
  id,
  name,
  value,
  onChange,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const n = /^\d+$/.test(value) ? Number(value) : 0;
  const stepBtn = "grid h-9 w-9 place-items-center rounded-lg text-lg text-stone-600 hover:bg-stone-100 disabled:opacity-30";
  return (
    <div className="flex items-center rounded-lg border border-stone-300 bg-white">
      <button
        type="button"
        className={stepBtn}
        aria-label={`Fewer shares for ${name}`}
        disabled={n <= 0}
        onClick={() => onChange(String(Math.max(0, n - 1)))}
      >
        −
      </button>
      <input
        id={id}
        className="money w-8 bg-transparent text-center text-sm outline-none"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className={stepBtn}
        aria-label={`More shares for ${name}`}
        onClick={() => onChange(String(n + 1))}
      >
        +
      </button>
    </div>
  );
}
