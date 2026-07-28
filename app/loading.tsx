import { BrandMark } from "@/components/brand/BrandMark";

export default function RootLoading() {
  return (
    <main
      className="grid min-h-screen place-items-center"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-4">
        <BrandMark size={40} priority className="ring-1 ring-border" />
        <div className="flex flex-col items-center gap-2">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-3 w-28 rounded" />
        </div>
      </div>
      <span className="sr-only">Loading Qoondeeye Admin…</span>
    </main>
  );
}
