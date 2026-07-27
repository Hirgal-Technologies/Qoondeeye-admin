"use client";

import { Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { StatePanel } from "@/components/states/StatePanel";

export type RosterColumn<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

type UserRosterTableProps<T> = {
  title: string;
  description: string;
  columns: RosterColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Values a row is matched against by the search box. */
  searchValues: (row: T) => (string | null | undefined)[];
  searchPlaceholder?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  errorTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  minWidthClass?: string;
  footer?: ReactNode;
};

/** Searchable, scrollable account roster used by the signup and activity pages. */
export function UserRosterTable<T>({
  title,
  description,
  columns,
  rows,
  rowKey,
  searchValues,
  searchPlaceholder = "Search users…",
  isLoading = false,
  error = null,
  onRetry,
  errorTitle,
  emptyTitle,
  emptyDescription,
  minWidthClass = "min-w-[760px]",
  footer,
}: UserRosterTableProps<T>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      searchValues(row)
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, rows, searchValues]);

  return (
    <section
      className="overflow-hidden rounded-lg border bg-card"
      aria-labelledby={`${toId(title)}-roster`}
    >
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 id={`${toId(title)}-roster`} className="text-sm font-semibold">
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <label className="relative sm:w-72">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search
            aria-hidden="true"
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
            placeholder={searchPlaceholder}
          />
        </label>
      </div>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <div className="space-y-2" aria-label={`Loading ${title.toLowerCase()}`}>
            {[0, 1, 2, 3, 4].map((row) => (
              <div className="skeleton h-10 rounded-md" key={row} />
            ))}
          </div>
        ) : null}
        {error ? (
          <StatePanel
            compact
            kind="error"
            title={errorTitle}
            description={error}
            actionLabel={onRetry ? "Retry" : undefined}
            onAction={onRetry}
          />
        ) : null}
        {!isLoading && !error && rows.length === 0 ? (
          <StatePanel compact title={emptyTitle} description={emptyDescription} />
        ) : null}
        {!isLoading && !error && rows.length > 0 && filtered.length === 0 ? (
          <StatePanel
            compact
            title="No matching users"
            description="Try another name, email, or account identifier."
          />
        ) : null}
        {!isLoading && !error && filtered.length > 0 ? (
          <>
            <div className="max-h-[32rem] overflow-auto rounded-md border">
              <table className={`w-full ${minWidthClass} text-left text-xs`}>
                <caption className="sr-only">{description}</caption>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    {columns.map((column) => (
                      <th
                        scope="col"
                        key={column.key}
                        className={`px-3 py-2.5 font-medium ${column.className ?? ""}`}
                      >
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, index) => (
                    <tr
                      key={rowKey(row)}
                      className={`border-b transition-colors last:border-0 hover:bg-[hsl(var(--surface-table-hover))] ${
                        index % 2 === 1 ? "bg-[hsl(var(--surface-table-row-alt))]" : ""
                      }`}
                    >
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={`px-3 py-3 ${column.className ?? ""}`}
                        >
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {footer ? (
              <p className="mt-3 text-[11px] text-muted-foreground">{footer}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function toId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
