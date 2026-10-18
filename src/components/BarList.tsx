import { formatPeso, type Centavos } from "@/lib/money";

export function BarList({ title, items }: { title: string; items: { label: string; amount: Centavos }[] }) {
  const sorted = [...items].filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((s, i) => s + i.amount, 0) || 1;
  const max = Math.max(1, ...sorted.map((i) => i.amount));
  return (
    <div>
      <h3 className="label">{title}</h3>
      <ul className="space-y-2.5">
        {sorted.map((i) => (
          <li key={i.label}>
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="truncate capitalize">{i.label}</span>
              <span className="shrink-0 text-stone-600">
                <span className="money">{formatPeso(i.amount)}</span>
                <span className="ml-1.5 text-xs text-stone-400">{Math.round((i.amount / total) * 100)}%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100" aria-hidden>
              <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${(i.amount / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
