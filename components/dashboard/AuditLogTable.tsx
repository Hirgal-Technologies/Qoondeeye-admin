"use client";

import { Download, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatePanel } from "@/components/states/StatePanel";
import type { AuditLogRow } from "@/lib/data/audit";
import { formatDateTime } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

export function AuditLogTable() {
  const audit = useApiData<AuditLogRow[]>("/api/audit/logs?limit=200");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (audit.status !== "success") return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return audit.data;
    return audit.data.filter((row) =>
      [row.actorEmail, row.actorRole, row.action, row.resource, row.outcome]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [audit, query]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Security"
        title="Audit logs"
        description="Review recorded administrator actions, support lookups, protected resources, timestamps, and outcomes."
      />

      <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="audit-events">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 id="audit-events" className="text-sm font-semibold">Recorded events</h2>
            <p className="mt-1 text-xs text-muted-foreground">Newest activity first</p>
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1 sm:w-64">
              <span className="sr-only">Search audit logs</span>
              <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                placeholder="Search admin, action, resource…"
              />
            </label>
            <button
              type="button"
              disabled
              title="Audit export policy is not configured"
              className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Download aria-hidden="true" className="size-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {audit.status === "loading" ? (
            <div className="space-y-2" aria-label="Loading audit events">
              {[0, 1, 2, 3, 4].map((row) => (
                <div className="skeleton h-10 rounded-md" key={row} />
              ))}
            </div>
          ) : null}
          {audit.status === "error" ? (
            <StatePanel
              compact
              kind="error"
              title="Audit history unavailable"
              description={audit.error}
              actionLabel="Retry"
              onAction={audit.retry}
            />
          ) : null}
          {audit.status === "success" && audit.data.length === 0 ? (
            <StatePanel
              compact
              title="No audit events"
              description="Protected actions will appear here after the first recorded event."
            />
          ) : null}
          {audit.status === "success" && audit.data.length > 0 && filtered.length === 0 ? (
            <StatePanel
              compact
              title="No matching events"
              description="Try another admin name, role, action, resource, or outcome."
            />
          ) : null}
          {filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <caption className="sr-only">Administrator audit events</caption>
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th scope="col" className="px-3 py-2.5 font-medium">Admin</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Role</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Action</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Resource</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Timestamp</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-3 font-medium">{row.actorEmail}</td>
                      <td className="px-3 py-3 capitalize text-muted-foreground">{row.actorRole}</td>
                      <td className="px-3 py-3">{row.action.replace(/_/g, " ")}</td>
                      <td className="px-3 py-3 text-muted-foreground">{row.resource}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground tabular-nums">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-[10px] font-medium">
                          <ShieldCheck aria-hidden="true" className="size-3" />
                          {row.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
