/** Small presentational pieces shared across pages (safe in server and client components). */

const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
];

/** Same person always gets the same color, so people are recognizable at a glance. */
export function avatarColor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function Avatar({ id, name, size = "md" }: { id: string; name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sizes = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" };
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ${sizes[size]} ${avatarColor(id)}`}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({ people, max = 5 }: { people: { id: string; name: string }[]; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="flex -space-x-2">
      {shown.map((p) => (
        <span key={p.id} className="rounded-full ring-2 ring-white">
          <Avatar id={p.id} name={p.name} size="sm" />
        </span>
      ))}
      {people.length > max && (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-stone-200 text-[10px] font-semibold text-stone-600 ring-2 ring-white">
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-300 px-6 py-10 text-center">
      <span className="text-3xl" aria-hidden>{icon}</span>
      <p className="mt-2 font-medium text-stone-800">{title}</p>
      {children && <div className="mt-1 text-sm text-stone-500">{children}</div>}
    </div>
  );
}

export const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍜",
  transport: "🚐",
  lodging: "🏝️",
  activities: "🏄",
  groceries: "🛒",
  drinks: "🍹",
  other: "🧾",
};
