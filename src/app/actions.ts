"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { toSplitInputs, type ExpenseFormValues } from "@/lib/expense-form";
import { currentMember, identityCookie } from "@/lib/identity";
import { toCentavos } from "@/lib/money";
import {
  addMember,
  CATEGORIES,
  createGroup,
  deleteExpense,
  deleteSettlement,
  recordSettlement,
  saveExpense,
  type Category,
} from "@/lib/repo";
import { isSplitType } from "@/lib/splits";

export type ActionState = { error?: string; ok?: boolean };

async function actorName(groupId: string) {
  return (await currentMember(groupId))?.name ?? null;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong";
}

export async function createGroupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const members = String(form.get("members") ?? "").split(/[\n,]/);
    id = createGroup(String(form.get("name") ?? ""), members);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  redirect(`/g/${id}`);
}

export async function setIdentityAction(groupId: string, form: FormData) {
  const memberId = String(form.get("memberId") ?? "");
  const jar = await cookies();
  if (memberId) jar.set(identityCookie(groupId), memberId, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  else jar.delete(identityCookie(groupId));
  revalidatePath(`/g/${groupId}`);
}

export async function addMemberAction(groupId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    addMember(groupId, String(form.get("name") ?? ""), await actorName(groupId));
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/g/${groupId}`);
  return { ok: true };
}

export async function saveExpenseAction(
  groupId: string,
  expenseId: string | null,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const values = JSON.parse(String(form.get("payload"))) as ExpenseFormValues;
    if (!isSplitType(values.splitType)) throw new Error("Unknown split type");
    const category = (CATEGORIES as readonly string[]).includes(values.category)
      ? (values.category as Category)
      : "other";
    saveExpense(
      groupId,
      {
        description: values.description,
        category,
        amount: toCentavos(values.amount),
        paidBy: values.paidBy,
        splitType: values.splitType,
        spentOn: values.spentOn,
        splits: toSplitInputs(values),
      },
      await actorName(groupId),
      expenseId ?? undefined,
    );
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/g/${groupId}`);
  redirect(`/g/${groupId}`);
}

export async function deleteExpenseAction(groupId: string, expenseId: string) {
  deleteExpense(groupId, expenseId, await actorName(groupId));
  revalidatePath(`/g/${groupId}`);
  redirect(`/g/${groupId}`);
}

export async function recordSettlementAction(groupId: string, form: FormData) {
  recordSettlement(
    groupId,
    String(form.get("from")),
    String(form.get("to")),
    Number(form.get("amount")),
    await actorName(groupId),
  );
  revalidatePath(`/g/${groupId}`);
}

export async function deleteSettlementAction(groupId: string, settlementId: string) {
  deleteSettlement(groupId, settlementId, await actorName(groupId));
  revalidatePath(`/g/${groupId}`);
}
