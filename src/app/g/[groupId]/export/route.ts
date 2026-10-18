import { centavosToDecimalString } from "@/lib/money";
import { getGroup, listExpenses, listMembers, listSettlements } from "@/lib/repo";

export const dynamic = "force-dynamic";

const csvCell = (value: string | number) => {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per expense with a column per member's share, then the payments. */
export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const group = getGroup(groupId);
  if (!group) return new Response("Not found", { status: 404 });

  const members = listMembers(groupId);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "";
  const rows: (string | number)[][] = [
    ["Date", "Description", "Category", "Paid by", "Amount (PHP)", "Split", ...members.map((m) => `${m.name} share`)],
  ];
  for (const e of [...listExpenses(groupId)].reverse()) {
    const shares = new Map(e.shares.map((s) => [s.memberId, s.amount]));
    rows.push([
      e.spentOn,
      e.description,
      e.category,
      name(e.paidBy),
      centavosToDecimalString(e.amount),
      e.splitType,
      ...members.map((m) => centavosToDecimalString(shares.get(m.id) ?? 0)),
    ]);
  }
  const settlements = listSettlements(groupId);
  if (settlements.length) {
    rows.push([], ["Payments"], ["Date", "From", "To", "Amount (PHP)"]);
    for (const s of [...settlements].reverse()) {
      rows.push([s.createdAt.slice(0, 10), name(s.fromMember), name(s.toMember), centavosToDecimalString(s.amount)]);
    }
  }

  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const filename = `${group.name.replace(/[^\w-]+/g, "_") || "hatian"}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
