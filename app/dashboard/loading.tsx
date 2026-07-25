export default function DashboardLoading() {
  return (
    <div
      className="flex flex-col gap-6 lg:gap-7"
      role="status"
      aria-label="Loading page"
    >
      <div className="flex flex-col gap-2">
        <div className="skeleton h-3 w-32 rounded" />
        <div className="skeleton h-7 w-64 rounded" />
        <div className="skeleton h-3 w-full max-w-md rounded" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="rounded-lg border bg-card p-4">
            <div className="skeleton size-8 rounded-md" />
            <div className="skeleton mt-4 h-3 w-24 rounded" />
            <div className="skeleton mt-2 h-6 w-32 rounded" />
            <div className="skeleton mt-2 h-3 w-20 rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="rounded-lg border bg-card p-4 sm:p-5">
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton mt-2 h-3 w-56 rounded" />
            <div className="mt-4 flex h-64 items-end gap-2 border-b border-l px-3 pb-3">
              {[42, 72, 56, 88, 64, 76, 92, 68, 84, 58, 73, 90].map(
                (height, index) => (
                  <div
                    className="skeleton flex-1 rounded-t-sm"
                    key={`${height}-${index}`}
                    style={{ height: `${height}%` }}
                  />
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Loading page content…</span>
    </div>
  );
}
