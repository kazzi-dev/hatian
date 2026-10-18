import Link from "next/link";
import { CreateGroupForm } from "@/components/CreateGroupForm";
import { AvatarStack, EmptyState } from "@/components/ui";
import { formatPeso } from "@/lib/money";
import { listGroups, listMembers } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function Home() {
  const groups = listGroups();
  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1.1fr]">
      <section>
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Wait, who paid for the gas?</h1>
        <p className="mt-3 text-lg text-stone-600 text-pretty">
          Log what everyone paid. Hatian works out the fewest payments to settle up, down to the centavo.
        </p>
        <ol className="mt-5 space-y-2 text-sm text-stone-600">
          {["Create a group and share the link", "Add expenses as you go", "Settle up in as few payments as possible"].map(
            (step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
                  {i + 1}
                </span>
                {step}
              </li>
            ),
          )}
        </ol>
        <div className="card mt-8">
          <h2 className="mb-4 text-lg font-semibold">Start a group</h2>
          <CreateGroupForm />
        </div>
      </section>

      <section aria-labelledby="groups-heading">
        <h2 id="groups-heading" className="label">Your groups</h2>
        {groups.length === 0 ? (
          <EmptyState icon="🏝️" title="No groups yet">Your trips and shared houses will show up here.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/g/${g.id}`}
                  className="card flex items-center justify-between gap-4 transition hover:-translate-y-0.5 hover:border-emerald-600 hover:shadow-md"
                >
                  <div className="min-w-0">
                    <div className="truncate text-lg font-medium">{g.name}</div>
                    <div className="mt-1.5 flex items-center gap-2 text-sm text-stone-500">
                      <AvatarStack people={listMembers(g.id)} />
                      {g.memberCount} people
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="money">{formatPeso(g.totalSpent)}</div>
                    <div className="text-xs text-stone-500">spent</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
