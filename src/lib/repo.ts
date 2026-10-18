import "server-only";
import { randomBytes } from "node:crypto";
import { computeBalances, pairwiseDebtCount } from "./balances";
import { db, transaction } from "./db";
import { formatPeso, type Centavos } from "./money";
import { simplifyDebts, type Transfer } from "./settle";
import { computeSplit, type SplitInput, type SplitType } from "./splits";

export const CATEGORIES = ["food", "transport", "lodging", "activities", "groceries", "drinks", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Group {
  id: string;
  name: string;
  createdAt: string;
}
export interface Member {
  id: string;
  name: string;
}
export interface Expense {
  id: string;
  description: string;
  category: Category;
  amount: Centavos;
  paidBy: string;
  splitType: SplitType;
  spentOn: string;
  createdAt: string;
  updatedAt: string;
  shares: { memberId: string; inputValue: number; amount: Centavos }[];
}
export interface Settlement {
  id: string;
  fromMember: string;
  toMember: string;
  amount: Centavos;
  createdAt: string;
}
export interface Activity {
  id: number;
  kind: string;
  message: string;
  details: string | null;
  createdAt: string;
}
export interface ExpenseInput {
  description: string;
  category: Category;
  amount: Centavos;
  paidBy: string;
  splitType: SplitType;
  spentOn: string;
  splits: SplitInput[];
}

export class NotFoundError extends Error {}
export class ValidationError extends Error {}

/** Unguessable, URL-safe id. The group id doubles as its invite link. */
const newId = (bytes = 9) => randomBytes(bytes).toString("base64url");
const now = () => new Date().toISOString();

type Row = Record<string, string | number | null>;

// ---------- groups & members ----------

export function listGroups(): (Group & { memberCount: number; totalSpent: Centavos })[] {
  const rows = db
    .prepare(
      `SELECT g.id, g.name, g.created_at,
         (SELECT COUNT(*) FROM members m WHERE m.group_id = g.id) AS member_count,
         (SELECT COALESCE(SUM(amount_centavos), 0) FROM expenses e WHERE e.group_id = g.id AND e.deleted_at IS NULL) AS total
       FROM groups g ORDER BY g.created_at DESC`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    createdAt: String(r.created_at),
    memberCount: Number(r.member_count),
    totalSpent: Number(r.total),
  }));
}

export function createGroup(name: string, memberNames: string[]): string {
  const groupName = name.trim();
  const names = [...new Set(memberNames.map((n) => n.trim()).filter(Boolean))];
  if (!groupName) throw new ValidationError("Give the group a name");
  if (names.length < 2) throw new ValidationError("Add at least two members");

  return transaction(() => {
    const id = newId();
    const ts = now();
    db.prepare("INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)").run(id, groupName, ts);
    const insert = db.prepare("INSERT INTO members (id, group_id, name, created_at) VALUES (?, ?, ?, ?)");
    for (const n of names) insert.run(newId(), id, n, ts);
    log(id, "group.created", `Created the group with ${names.join(", ")}`);
    return id;
  });
}

export function getGroup(id: string): Group | null {
  const r = db.prepare("SELECT id, name, created_at FROM groups WHERE id = ?").get(id) as Row | undefined;
  return r ? { id: String(r.id), name: String(r.name), createdAt: String(r.created_at) } : null;
}

export function listMembers(groupId: string): Member[] {
  const rows = db
    .prepare("SELECT id, name FROM members WHERE group_id = ? ORDER BY created_at, name")
    .all(groupId) as Row[];
  return rows.map((r) => ({ id: String(r.id), name: String(r.name) }));
}

export function addMember(groupId: string, name: string, actor: string | null): void {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError("Name can't be empty");
  requireGroup(groupId);
  if (listMembers(groupId).some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new ValidationError(`${trimmed} is already in the group`);
  }
  transaction(() => {
    db.prepare("INSERT INTO members (id, group_id, name, created_at) VALUES (?, ?, ?, ?)").run(
      newId(),
      groupId,
      trimmed,
      now(),
    );
    log(groupId, "member.added", `${who(actor)} added ${trimmed} to the group`);
  });
}

// ---------- expenses ----------

export function listExpenses(groupId: string): Expense[] {
  const rows = db
    .prepare(
      `SELECT * FROM expenses WHERE group_id = ? AND deleted_at IS NULL
       ORDER BY spent_on DESC, created_at DESC`,
    )
    .all(groupId) as Row[];
  const shareRows = db
    .prepare(
      `SELECT s.* FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
       WHERE e.group_id = ? AND e.deleted_at IS NULL`,
    )
    .all(groupId) as Row[];

  const sharesByExpense = new Map<string, Expense["shares"]>();
  for (const s of shareRows) {
    const list = sharesByExpense.get(String(s.expense_id)) ?? [];
    list.push({ memberId: String(s.member_id), inputValue: Number(s.input_value), amount: Number(s.amount_centavos) });
    sharesByExpense.set(String(s.expense_id), list);
  }
  return rows.map((r) => toExpense(r, sharesByExpense.get(String(r.id)) ?? []));
}

export function getExpense(groupId: string, expenseId: string): Expense | null {
  return listExpenses(groupId).find((e) => e.id === expenseId) ?? null;
}

/** Create (no expenseId) or update an expense. Shares are recomputed and stored in centavos. */
export function saveExpense(groupId: string, input: ExpenseInput, actor: string | null, expenseId?: string): string {
  requireGroup(groupId);
  const members = listMembers(groupId);
  const memberIds = new Set(members.map((m) => m.id));
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "someone";

  const description = input.description.trim();
  if (!description) throw new ValidationError("Describe the expense");
  if (!memberIds.has(input.paidBy)) throw new ValidationError("The payer isn't in this group");
  if (input.splits.some((s) => !memberIds.has(s.memberId))) throw new ValidationError("Split includes a non-member");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.spentOn)) throw new ValidationError("Pick a valid date");

  const shares = computeSplit(input.amount, input.splitType, input.splits);
  const inputByMember = new Map(input.splits.map((s) => [s.memberId, s.value]));

  return transaction(() => {
    const ts = now();
    let id = expenseId;
    if (id) {
      const before = getExpense(groupId, id);
      if (!before) throw new NotFoundError("Expense not found");
      db.prepare(
        `UPDATE expenses SET description = ?, category = ?, amount_centavos = ?, paid_by = ?,
           split_type = ?, spent_on = ?, updated_at = ? WHERE id = ?`,
      ).run(description, input.category, input.amount, input.paidBy, input.splitType, input.spentOn, ts, id);
      db.prepare("DELETE FROM expense_shares WHERE expense_id = ?").run(id);

      const changes = describeChanges(before, { ...input, description }, name);
      log(
        groupId,
        "expense.edited",
        `${who(actor)} edited "${before.description}"${changes.length ? `: ${changes.join("; ")}` : ""}`,
        { before: snapshot(before), after: { ...input, description } },
      );
    } else {
      id = newId();
      db.prepare(
        `INSERT INTO expenses (id, group_id, description, category, amount_centavos, paid_by, split_type,
           spent_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, groupId, description, input.category, input.amount, input.paidBy, input.splitType, input.spentOn, ts, ts);
      log(
        groupId,
        "expense.added",
        `${who(actor)} added "${description}" — ${formatPeso(input.amount)} paid by ${name(input.paidBy)}, split ${input.splitType} among ${shares.length}`,
      );
    }

    const insertShare = db.prepare(
      "INSERT INTO expense_shares (expense_id, member_id, input_value, amount_centavos) VALUES (?, ?, ?, ?)",
    );
    for (const s of shares) insertShare.run(id, s.memberId, inputByMember.get(s.memberId) ?? 0, s.amount);
    return id;
  });
}

export function deleteExpense(groupId: string, expenseId: string, actor: string | null): void {
  const expense = getExpense(groupId, expenseId);
  if (!expense) throw new NotFoundError("Expense not found");
  transaction(() => {
    db.prepare("UPDATE expenses SET deleted_at = ? WHERE id = ?").run(now(), expenseId);
    log(groupId, "expense.deleted", `${who(actor)} deleted "${expense.description}" (${formatPeso(expense.amount)})`, {
      before: snapshot(expense),
    });
  });
}

// ---------- settlements ----------

export function listSettlements(groupId: string): Settlement[] {
  const rows = db
    .prepare("SELECT * FROM settlements WHERE group_id = ? AND deleted_at IS NULL ORDER BY created_at DESC")
    .all(groupId) as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    fromMember: String(r.from_member),
    toMember: String(r.to_member),
    amount: Number(r.amount_centavos),
    createdAt: String(r.created_at),
  }));
}

export function recordSettlement(
  groupId: string,
  fromMember: string,
  toMember: string,
  amount: Centavos,
  actor: string | null,
): void {
  const members = listMembers(groupId);
  const from = members.find((m) => m.id === fromMember);
  const to = members.find((m) => m.id === toMember);
  if (!from || !to) throw new ValidationError("Both people must be in the group");
  if (from.id === to.id) throw new ValidationError("Can't pay yourself");
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new ValidationError("Amount must be greater than zero");
  transaction(() => {
    db.prepare(
      "INSERT INTO settlements (id, group_id, from_member, to_member, amount_centavos, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(newId(), groupId, fromMember, toMember, amount, now());
    log(groupId, "settlement.added", `${who(actor)} recorded: ${from.name} paid ${to.name} ${formatPeso(amount)}`);
  });
}

export function deleteSettlement(groupId: string, settlementId: string, actor: string | null): void {
  const s = listSettlements(groupId).find((x) => x.id === settlementId);
  if (!s) throw new NotFoundError("Payment not found");
  const members = listMembers(groupId);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "someone";
  transaction(() => {
    db.prepare("UPDATE settlements SET deleted_at = ? WHERE id = ?").run(now(), settlementId);
    log(
      groupId,
      "settlement.deleted",
      `${who(actor)} removed the payment ${name(s.fromMember)} → ${name(s.toMember)} ${formatPeso(s.amount)}`,
    );
  });
}

// ---------- activity ----------

export function listActivity(groupId: string, limit = 50): Activity[] {
  const rows = db
    .prepare("SELECT * FROM activity WHERE group_id = ? ORDER BY id DESC LIMIT ?")
    .all(groupId, limit) as Row[];
  return rows.map((r) => ({
    id: Number(r.id),
    kind: String(r.kind),
    message: String(r.message),
    details: r.details === null ? null : String(r.details),
    createdAt: String(r.created_at),
  }));
}

/** Cheap change marker for live sync: bumps whenever anything in the group changes. */
export function latestActivityId(groupId: string): number {
  const r = db.prepare("SELECT MAX(id) AS id FROM activity WHERE group_id = ?").get(groupId) as Row | undefined;
  return Number(r?.id ?? 0);
}

// ---------- summary ----------

export interface GroupSummary {
  balances: Map<string, Centavos>;
  transfers: Transfer[];
  naivePaymentCount: number;
  totalSpent: Centavos;
  spentBy: Map<string, Centavos>; // what each member consumed (their shares)
  paidBy: Map<string, Centavos>; // what each member fronted
  byCategory: Map<Category, Centavos>;
}

export function summarize(members: Member[], expenses: Expense[], settlements: Settlement[]): GroupSummary {
  const forBalance = expenses.map((e) => ({ paidBy: e.paidBy, amount: e.amount, shares: e.shares }));
  const balances = computeBalances(
    members.map((m) => m.id),
    forBalance,
    settlements,
  );

  const spentBy = new Map<string, Centavos>();
  const paidBy = new Map<string, Centavos>();
  const byCategory = new Map<Category, Centavos>();
  for (const e of expenses) {
    paidBy.set(e.paidBy, (paidBy.get(e.paidBy) ?? 0) + e.amount);
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    for (const s of e.shares) spentBy.set(s.memberId, (spentBy.get(s.memberId) ?? 0) + s.amount);
  }

  return {
    balances,
    transfers: simplifyDebts(balances),
    naivePaymentCount: pairwiseDebtCount(forBalance, settlements),
    totalSpent: expenses.reduce((sum, e) => sum + e.amount, 0),
    spentBy,
    paidBy,
    byCategory,
  };
}

// ---------- helpers ----------

function requireGroup(groupId: string) {
  if (!getGroup(groupId)) throw new NotFoundError("Group not found");
}

function who(actor: string | null) {
  return actor ?? "Someone";
}

function log(groupId: string, kind: string, message: string, details?: unknown) {
  db.prepare("INSERT INTO activity (group_id, kind, message, details, created_at) VALUES (?, ?, ?, ?, ?)").run(
    groupId,
    kind,
    message,
    details === undefined ? null : JSON.stringify(details),
    now(),
  );
}

function toExpense(r: Row, shares: Expense["shares"]): Expense {
  return {
    id: String(r.id),
    description: String(r.description),
    category: String(r.category) as Category,
    amount: Number(r.amount_centavos),
    paidBy: String(r.paid_by),
    splitType: String(r.split_type) as SplitType,
    spentOn: String(r.spent_on),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    shares,
  };
}

function snapshot(e: Expense) {
  const { id, description, category, amount, paidBy, splitType, spentOn, shares } = e;
  return { id, description, category, amount, paidBy, splitType, spentOn, shares };
}

function describeChanges(before: Expense, after: ExpenseInput, name: (id: string) => string): string[] {
  const changes: string[] = [];
  if (before.description !== after.description) changes.push(`renamed to "${after.description}"`);
  if (before.amount !== after.amount) changes.push(`amount ${formatPeso(before.amount)} → ${formatPeso(after.amount)}`);
  if (before.paidBy !== after.paidBy) changes.push(`payer ${name(before.paidBy)} → ${name(after.paidBy)}`);
  if (before.category !== after.category) changes.push(`category ${before.category} → ${after.category}`);
  if (before.spentOn !== after.spentOn) changes.push(`date ${before.spentOn} → ${after.spentOn}`);
  if (before.splitType !== after.splitType) changes.push(`split ${before.splitType} → ${after.splitType}`);
  else {
    const beforeInputs = new Map(before.shares.map((s) => [s.memberId, s.inputValue]));
    const afterInputs = after.splits.filter((s) => s.value > 0);
    const same =
      afterInputs.length === beforeInputs.size && afterInputs.every((s) => beforeInputs.get(s.memberId) === s.value);
    if (!same) changes.push("split changed");
  }
  return changes;
}
