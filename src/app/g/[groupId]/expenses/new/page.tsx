import Link from "next/link";
import { notFound } from "next/navigation";
import { ExpenseForm } from "@/components/ExpenseForm";
import { currentMember } from "@/lib/identity";
import { CATEGORIES, getGroup, listMembers } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function NewExpensePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const group = getGroup(groupId);
  if (!group) notFound();
  const members = listMembers(groupId);
  const me = await currentMember(groupId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/g/${groupId}`} className="text-sm text-stone-500 hover:text-stone-800">← {group.name}</Link>
      <h1 className="mb-6 mt-1 text-2xl font-semibold tracking-tight">Add an expense</h1>
      <div className="card">
        <ExpenseForm
          groupId={groupId}
          expenseId={null}
          members={members}
          categories={CATEGORIES}
          initial={{
            description: "",
            category: "food",
            amount: "",
            paidBy: me?.id ?? members[0]?.id ?? "",
            splitType: "equal",
            spentOn: new Date().toLocaleDateString("en-CA"),
            splits: Object.fromEntries(members.map((m) => [m.id, "1"])),
          }}
        />
      </div>
    </div>
  );
}
