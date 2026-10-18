import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSettlementAction, recordSettlementAction, setIdentityAction } from "@/app/actions";
import { AddMemberForm } from "@/components/AddMemberForm";
import { BarList } from "@/components/BarList";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { IdentityPicker } from "@/components/IdentityPicker";
import { LiveSync } from "@/components/LiveSync";
import { SubmitButton } from "@/components/SubmitButton";
import { Avatar, AvatarStack, CATEGORY_EMOJI, EmptyState } from "@/components/ui";
import { currentMember } from "@/lib/identity";
import { formatPeso } from "@/lib/money";
import {
  getGroup,
  latestActivityId,
  listActivity,
  listExpenses,
  listMembers,
  listSettlements,
  summarize,
  type Expense,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const group = getGroup(groupId);
  if (!group) notFound();

  const members = listMembers(groupId);
  const expenses = listExpenses(groupId);
  const settlements = listSettlements(groupId);
  const activity = listActivity(groupId, 30);
  const me = await currentMember(groupId);
  const summary = summarize(members, expenses, settlements);
  const member = (id: string) => members.find((m) => m.id === id) ?? { id, name: "?" };
  const isMe = (id: string) => me?.id === id;
  const label = (id: string) => (isMe(id) ? "You" : member(id).name);
  const myBalance = me ? (summary.balances.get(me.id) ?? 0) : 0;
  const maxAbsBalance = Math.max(1, ...[...summary.balances.values()].map(Math.abs));

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <LiveSync groupId={groupId} version={latestActivityId(groupId)} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">← All groups</Link>
          <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{group.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-stone-500">
            <AvatarStack people={members} />
            <span>
              {members.length} people · <span className="money text-stone-700">{formatPeso(summary.totalSpent)}</span>{" "}
              spent
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyLinkButton />
          <a href={`/g/${groupId}/export`} className="btn-ghost" download>
            Export CSV
          </a>
          <Link href={`/g/${groupId}/expenses/new`} className="btn-primary hidden lg:inline-flex">
            + Add expense
          </Link>
        </div>
      </div>

      <IdentityPicker members={members} meId={me?.id ?? ""} action={setIdentityAction.bind(null, groupId)} />

      {/* Personal summary: the one number people open the app for */}
      {me && expenses.length > 0 && (
        <div
          className={`rounded-2xl p-5 ${
            myBalance > 0 ? "bg-emerald-700 text-white" : myBalance < 0 ? "bg-stone-900 text-white" : "bg-white card"
          }`}
        >
          <p className="text-sm opacity-80">
            {myBalance > 0 ? "You're owed" : myBalance < 0 ? "You owe" : "You're all square"}
          </p>
          {myBalance !== 0 && <p className="money mt-1 text-4xl">{formatPeso(Math.abs(myBalance))}</p>}
          <p className="mt-1 text-sm opacity-80">
            {myBalance === 0
              ? "Nothing to pay, nothing to collect."
              : `See "Settle up" for exactly who ${myBalance > 0 ? "pays you" : "to pay"}.`}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {/* Settle up */}
          <section className="card" aria-labelledby="settle-heading">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 id="settle-heading" className="text-lg font-semibold">Settle up</h2>
              {summary.transfers.length > 0 && (
                <span className="text-sm text-stone-500">
                  {summary.transfers.length} payment{summary.transfers.length === 1 ? "" : "s"}
                  {summary.naivePaymentCount > summary.transfers.length && (
                    <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      saved {summary.naivePaymentCount - summary.transfers.length}
                    </span>
                  )}
                </span>
              )}
            </div>
            {summary.transfers.length === 0 ? (
              expenses.length ? (
                <EmptyState icon="🎉" title="All settled up">Walang utang! Nobody owes anybody.</EmptyState>
              ) : (
                <EmptyState icon="🧾" title="No expenses yet">
                  Add the first one and Hatian will work out who owes whom.
                  <div className="mt-4">
                    <Link href={`/g/${groupId}/expenses/new`} className="btn-primary">+ Add expense</Link>
                  </div>
                </EmptyState>
              )
            ) : (
              <ul className="space-y-2">
                {summary.transfers.map((t) => {
                  const mine = isMe(t.from) || isMe(t.to);
                  return (
                    <li
                      key={`${t.from}-${t.to}`}
                      className={`flex flex-wrap items-center gap-3 rounded-xl p-3 ${
                        mine ? "bg-amber-50 ring-1 ring-amber-200" : "bg-stone-50"
                      }`}
                    >
                      <div className="flex w-full min-w-0 items-center gap-2 text-sm sm:w-auto sm:flex-1">
                        <Avatar id={t.from} name={member(t.from).name} />
                        <span className="truncate font-medium">{label(t.from)}</span>
                        <span className="text-stone-400" aria-label="pays">→</span>
                        <Avatar id={t.to} name={member(t.to).name} />
                        <span className="truncate font-medium">{label(t.to)}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-3">
                        <span className="money text-lg">{formatPeso(t.amount)}</span>
                        <form action={recordSettlementAction.bind(null, groupId)}>
                          <input type="hidden" name="from" value={t.from} />
                          <input type="hidden" name="to" value={t.to} />
                          <input type="hidden" name="amount" value={t.amount} />
                          <SubmitButton className="btn-ghost min-h-8 px-3 py-1 text-xs" pendingText="Saving…">
                            Mark paid
                          </SubmitButton>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Expenses */}
          <section className="card" aria-labelledby="expenses-heading">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="expenses-heading" className="text-lg font-semibold">Expenses</h2>
              <span className="text-sm text-stone-500">{expenses.length}</span>
            </div>
            {expenses.length === 0 ? (
              <p className="py-4 text-sm text-stone-500">Nothing logged yet.</p>
            ) : (
              groupByDay(expenses).map(([day, items]) => (
                <div key={day}>
                  <h3 className="sticky top-0 bg-white py-2 text-xs font-medium uppercase tracking-wide text-stone-400">
                    {day}
                  </h3>
                  <ul>
                    {items.map((e) => {
                      const myShare = e.shares.find((s) => isMe(s.memberId))?.amount ?? 0;
                      const lent = isMe(e.paidBy) ? e.amount - myShare : 0;
                      return (
                        <li key={e.id}>
                          <Link
                            href={`/g/${groupId}/expenses/${e.id}`}
                            className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-stone-50"
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-xl" aria-hidden>
                              {CATEGORY_EMOJI[e.category] ?? "🧾"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{e.description}</div>
                              <div className="truncate text-xs text-stone-500">
                                {label(e.paidBy)} paid · split {e.splitType === "equal" ? "equally" : `by ${e.splitType}`}{" "}
                                among {e.shares.length}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="money">{formatPeso(e.amount)}</div>
                              {me && (
                                <div
                                  className={`text-xs ${
                                    lent ? "text-emerald-700" : myShare ? "text-red-700" : "text-stone-400"
                                  }`}
                                >
                                  {isMe(e.paidBy)
                                    ? `you lent ${formatPeso(lent)}`
                                    : myShare
                                      ? `you owe ${formatPeso(myShare)}`
                                      : "not involved"}
                                </div>
                              )}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </section>

          {/* Payments */}
          {settlements.length > 0 && (
            <section className="card" aria-labelledby="payments-heading">
              <h2 id="payments-heading" className="mb-3 text-lg font-semibold">Payments made</h2>
              <ul className="divide-y divide-stone-100">
                {settlements.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="text-emerald-600" aria-hidden>✓</span>
                      <span className="truncate">
                        {label(s.fromMember)} paid {isMe(s.toMember) ? "you" : member(s.toMember).name}
                      </span>
                      <span className="money">{formatPeso(s.amount)}</span>
                    </span>
                    <form action={deleteSettlementAction.bind(null, groupId, s.id)}>
                      <SubmitButton className="btn min-h-8 px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-red-700">
                        Undo
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {/* Balances: diverging bars, green = gets back, red = owes */}
          <section className="card" aria-labelledby="balances-heading">
            <h2 id="balances-heading" className="mb-4 text-lg font-semibold">Balances</h2>
            <ul className="space-y-3">
              {members.map((m) => {
                const bal = summary.balances.get(m.id) ?? 0;
                const pct = (Math.abs(bal) / maxAbsBalance) * 50;
                return (
                  <li key={m.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar id={m.id} name={m.name} size="sm" />
                        <span className={`truncate ${isMe(m.id) ? "font-semibold" : ""}`}>
                          {m.name}
                          {isMe(m.id) && <span className="ml-1 text-xs font-normal text-stone-400">(you)</span>}
                        </span>
                      </span>
                      <span
                        className={`money text-sm ${bal > 0 ? "text-emerald-700" : bal < 0 ? "text-red-700" : "text-stone-400"}`}
                      >
                        {bal === 0 ? "settled" : `${bal > 0 ? "+" : "−"}${formatPeso(Math.abs(bal))}`}
                      </span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-stone-100" aria-hidden>
                      <div className="absolute inset-y-0 left-1/2 w-px bg-stone-300" />
                      {bal !== 0 && (
                        <div
                          className={`absolute inset-y-0 rounded-full ${bal > 0 ? "left-1/2 bg-emerald-600" : "right-1/2 bg-red-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {expenses.length > 0 && (
            <section className="card space-y-5" aria-labelledby="spending-heading">
              <h2 id="spending-heading" className="text-lg font-semibold">Spending</h2>
              <BarList
                title="By category"
                items={[...summary.byCategory].map(([cat, amount]) => ({
                  label: `${CATEGORY_EMOJI[cat] ?? ""} ${cat}`,
                  amount,
                }))}
              />
              <BarList
                title="By person (their share)"
                items={members.map((m) => ({ label: m.name, amount: summary.spentBy.get(m.id) ?? 0 }))}
              />
            </section>
          )}

          <section className="card" aria-labelledby="members-heading">
            <h2 id="members-heading" className="mb-3 text-lg font-semibold">People</h2>
            <ul className="mb-4 flex flex-wrap gap-2">
              {members.map((m) => (
                <li key={m.id} className="chip cursor-default hover:border-stone-300">
                  <Avatar id={m.id} name={m.name} size="sm" />
                  {m.name}
                </li>
              ))}
            </ul>
            <AddMemberForm groupId={groupId} />
          </section>

          <section className="card" aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="mb-3 text-lg font-semibold">Activity</h2>
            <ActivityList items={activity.slice(0, 6)} />
            {activity.length > 6 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-emerald-700">
                  Show {activity.length - 6} older
                </summary>
                <div className="mt-3">
                  <ActivityList items={activity.slice(6)} />
                </div>
              </details>
            )}
          </section>
        </div>
      </div>

      {/* Mobile: the main action stays in thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/90 p-3 backdrop-blur lg:hidden">
        <Link href={`/g/${groupId}/expenses/new`} className="btn-primary w-full text-base">
          + Add expense
        </Link>
      </div>
    </div>
  );
}

function ActivityList({ items }: { items: { id: number; message: string; createdAt: string }[] }) {
  return (
    <ol className="relative space-y-4 border-l border-stone-200 pl-4">
      {items.map((a) => (
        <li key={a.id} className="text-sm">
          <span className="absolute -left-[4.5px] mt-1.5 h-2 w-2 rounded-full bg-stone-300" aria-hidden />
          <div className="text-stone-700">{a.message}</div>
          <time className="text-xs text-stone-400" dateTime={a.createdAt}>{timeAgo(a.createdAt)}</time>
        </li>
      ))}
    </ol>
  );
}

function groupByDay(expenses: Expense[]): [string, Expense[]][] {
  const today = new Date();
  const iso = (d: Date) => d.toLocaleDateString("en-CA");
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    const label =
      e.spentOn === iso(today)
        ? "Today"
        : e.spentOn === iso(yesterday)
          ? "Yesterday"
          : new Date(`${e.spentOn}T00:00:00`).toLocaleDateString("en-PH", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
    groups.set(label, [...(groups.get(label) ?? []), e]);
  }
  return [...groups];
}

function timeAgo(isoDate: string) {
  const seconds = Math.round((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(isoDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}
