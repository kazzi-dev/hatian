import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteExpenseAction } from "@/app/actions";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ConfirmSubmitButton } from "@/components/SubmitButton";
import { formatSplitValue } from "@/lib/expense-form";
import { centavosToDecimalString } from "@/lib/money";
import { CATEGORIES, getExpense, getGroup, listMembers } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ groupId: string; expenseId: string }>;
}) {
  const { groupId, expenseId } = await params;
  const group = getGroup(groupId);
  const expense = group && getExpense(groupId, expenseId);
  if (!group || !expense) notFound();
  const members = listMembers(groupId);
  const inputs = new Map(expense.shares.map((s) => [s.memberId, s.inputValue]));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/g/${groupId}`} className="text-sm text-stone-500 hover:text-stone-800">← {group.name}</Link>
      <div className="mb-6 mt-1 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Edit expense</h1>
        <form action={deleteExpenseAction.bind(null, groupId, expenseId)}>
          <ConfirmSubmitButton className="btn-ghost text-red-700 hover:bg-red-50" confirmText="Tap again to delete">
            Delete
          </ConfirmSubmitButton>
        </form>
      </div>
      <div className="card">
        <ExpenseForm
          groupId={groupId}
          expenseId={expenseId}
          members={members}
          categories={CATEGORIES}
          initial={{
            description: expense.description,
            category: expense.category,
            amount: centavosToDecimalString(expense.amount),
            paidBy: expense.paidBy,
            splitType: expense.splitType,
            spentOn: expense.spentOn,
            splits: Object.fromEntries(
              members.map((m) => [m.id, formatSplitValue(expense.splitType, inputs.get(m.id) ?? 0)]),
            ),
          }}
        />
      </div>
      <p className="mt-3 text-xs text-stone-500">
        Every edit and deletion is recorded in the group&apos;s activity log.
      </p>
    </div>
  );
}
