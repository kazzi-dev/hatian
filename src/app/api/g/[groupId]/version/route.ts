import { latestActivityId } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return Response.json({ version: latestActivityId(groupId) });
}
