/** Skeleton shown while a group page loads, shaped like the real layout so nothing jumps. */
export default function Loading() {
  const bar = "animate-pulse rounded-md bg-stone-200";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading group">
      <div className="space-y-2">
        <div className={`${bar} h-4 w-24`} />
        <div className={`${bar} h-9 w-64`} />
        <div className={`${bar} h-4 w-48`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {[3, 4].map((rows, i) => (
            <div key={i} className="card space-y-3">
              <div className={`${bar} h-5 w-32`} />
              {Array.from({ length: rows }, (_, j) => (
                <div key={j} className={`${bar} h-12 w-full`} />
              ))}
            </div>
          ))}
        </div>
        <div className="card space-y-3">
          <div className={`${bar} h-5 w-24`} />
          {Array.from({ length: 5 }, (_, j) => (
            <div key={j} className={`${bar} h-6 w-full`} />
          ))}
        </div>
      </div>
    </div>
  );
}
