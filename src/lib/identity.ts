import "server-only";
import { cookies } from "next/headers";
import { listMembers, type Member } from "./repo";

export const identityCookie = (groupId: string) => `hatian_me_${groupId}`;

/** Until real auth lands, "who am I" is a per-group cookie pointing at a member. */
export async function currentMember(groupId: string): Promise<Member | null> {
  const id = (await cookies()).get(identityCookie(groupId))?.value;
  return listMembers(groupId).find((m) => m.id === id) ?? null;
}
