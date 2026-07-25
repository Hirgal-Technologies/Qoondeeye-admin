"use client";

import { Plus, Search, Ticket, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { StatePanel } from "@/components/states/StatePanel";
import type {
  AssignableAdmin,
  SupportTicketPriority,
  SupportTicketRow,
  SupportTicketStatus,
} from "@/features/support-tickets/contracts";
import { formatDateTime } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

const STATUS_OPTIONS: SupportTicketStatus[] = ["open", "pending", "resolved", "closed"];
const PRIORITY_OPTIONS: SupportTicketPriority[] = ["low", "normal", "high", "urgent"];

const STATUS_BADGE: Record<SupportTicketStatus, string> = {
  open: "bg-info-muted text-info",
  pending: "bg-neutral-muted text-neutral",
  resolved: "bg-success-muted text-success",
  closed: "bg-neutral-muted text-muted-foreground",
};

const PRIORITY_BADGE: Record<SupportTicketPriority, string> = {
  low: "bg-neutral-muted text-neutral",
  normal: "bg-info-muted text-info",
  high: "bg-warning-muted text-warning",
  urgent: "bg-critical-muted text-destructive",
};

export function SupportTicketsPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [pendingRowId, setPendingRowId] = useState<number | null>(null);

  const listUrl = statusFilter
    ? `/api/support/tickets?status=${statusFilter}`
    : "/api/support/tickets";
  const tickets = useApiData<SupportTicketRow[]>(listUrl);
  const assignees = useApiData<AssignableAdmin[]>("/api/support/tickets/assignees");
  const assigneeOptions = assignees.status === "success" ? assignees.data : [];

  const rows = useMemo(() => (tickets.status === "success" ? tickets.data : []), [tickets]);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? rows.filter((row) =>
        `${row.subject} ${row.requesterEmail} ${row.description}`
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : rows;

  const summary = useMemo(
    () => ({
      open: rows.filter((row) => row.status === "open").length,
      pending: rows.filter((row) => row.status === "pending").length,
      urgent: rows.filter((row) => row.priority === "urgent" && row.status !== "closed").length,
    }),
    [rows]
  );

  async function patchTicket(
    id: number,
    body: Partial<{ status: SupportTicketStatus; priority: SupportTicketPriority; assigneeId: string | null }>
  ) {
    setPendingRowId(id);
    setRowError(null);
    const response = await fetch(`/api/support/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    const result = await response
      ?.json()
      .catch(() => ({ error: "The server returned an invalid response." }));

    setPendingRowId(null);
    if (!response || !response.ok) {
      setRowError({
        id,
        message:
          typeof result?.error === "string" ? result.error : "The ticket could not be updated.",
      });
      return;
    }
    tickets.retry();
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="support-tickets">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="support-tickets" className="text-sm font-semibold">Support tickets</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Case queue backed by the support_tickets table
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice("");
            setCreateOpen(true);
          }}
          className="gradient-button inline-flex h-10 items-center gap-2 rounded-md px-4 text-xs font-semibold text-primary-foreground"
        >
          <Plus aria-hidden="true" className="size-4" />
          New ticket
        </button>
      </div>

      {notice ? (
        <div role="status" className="rounded-md border border-success/25 bg-success-muted px-3 py-2.5 text-xs font-medium text-success">
          {notice}
        </div>
      ) : null}

      {tickets.status === "success" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary label="Open" value={summary.open} />
          <Summary label="Pending" value={summary.pending} />
          <Summary label="Urgent (unresolved)" value={summary.urgent} />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <label className="relative sm:w-72">
            <span className="sr-only">Search tickets</span>
            <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
              placeholder="Search subject, requester, description…"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status} className="capitalize">
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="p-4 sm:p-5">
          {tickets.status === "loading" ? (
            <div className="space-y-2" aria-label="Loading tickets">
              {[0, 1, 2, 3].map((row) => (
                <div className="skeleton h-12 rounded-md" key={row} />
              ))}
            </div>
          ) : null}
          {tickets.status === "error" ? (
            <StatePanel
              compact
              kind="error"
              title="Tickets unavailable"
              description={tickets.error}
              actionLabel="Retry"
              onAction={tickets.retry}
            />
          ) : null}
          {tickets.status === "success" && rows.length === 0 ? (
            <StatePanel
              compact
              title="No support tickets"
              description="New cases will appear here once they're logged."
            />
          ) : null}
          {tickets.status === "success" && rows.length > 0 && filtered.length === 0 ? (
            <StatePanel compact title="No matching tickets" description="Try another search term or status filter." />
          ) : null}
          {filtered.length > 0 ? (
            <div className="overflow-auto rounded-md border">
              <table className="w-full min-w-[880px] text-left text-xs">
                <caption className="sr-only">Support ticket queue</caption>
                <thead>
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    <th scope="col" className="px-3 py-2.5 font-medium">Ticket</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Requester</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Priority</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Assignee</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`border-b transition-colors last:border-0 hover:bg-[hsl(var(--surface-table-hover))] ${
                        index % 2 ? "bg-[hsl(var(--surface-table-row-alt))]" : ""
                      }`}
                    >
                      <td className="max-w-[240px] px-3 py-3">
                        <div className="font-medium">{row.subject}</div>
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {row.description}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{row.requesterEmail}</td>
                      <td className="px-3 py-3">
                        <select
                          value={row.status}
                          disabled={pendingRowId === row.id}
                          onChange={(event) =>
                            patchTicket(row.id, { status: event.target.value as SupportTicketStatus })
                          }
                          className={`rounded-full border-0 px-2 py-1 text-[10px] font-semibold capitalize outline-none disabled:opacity-50 ${STATUS_BADGE[row.status]}`}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={row.priority}
                          disabled={pendingRowId === row.id}
                          onChange={(event) =>
                            patchTicket(row.id, { priority: event.target.value as SupportTicketPriority })
                          }
                          className={`rounded-full border-0 px-2 py-1 text-[10px] font-semibold capitalize outline-none disabled:opacity-50 ${PRIORITY_BADGE[row.priority]}`}
                        >
                          {PRIORITY_OPTIONS.map((priority) => (
                            <option key={priority} value={priority}>
                              {priority}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={row.assigneeId ?? ""}
                          disabled={pendingRowId === row.id}
                          onChange={(event) =>
                            patchTicket(row.id, { assigneeId: event.target.value || null })
                          }
                          className="h-8 rounded-md border bg-background px-2 text-[11px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:opacity-50"
                        >
                          <option value="">Unassigned</option>
                          {assigneeOptions.map((admin) => (
                            <option key={admin.id} value={admin.id}>
                              {admin.email}
                            </option>
                          ))}
                        </select>
                        {rowError?.id === row.id ? (
                          <p className="mt-1 text-[10px] text-destructive">{rowError.message}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground tabular-nums">
                        {formatDateTime(row.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {createOpen ? (
        <CreateTicketDialog
          onClose={() => setCreateOpen(false)}
          onCompleted={(message) => {
            setCreateOpen(false);
            setNotice(message);
            tickets.retry();
          }}
        />
      ) : null}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="gradient-kpi rounded-lg border p-4">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CreateTicketDialog({
  onClose,
  onCompleted,
}: {
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, description, requesterEmail, priority }),
    }).catch(() => null);

    if (!response) {
      setError("The request could not reach the server. Try again.");
      setBusy(false);
      return;
    }

    const result = await response
      .json()
      .catch(() => ({ error: "The server returned an invalid response." }));
    if (!response.ok) {
      setError(typeof result.error === "string" ? result.error : "The ticket could not be created.");
      setBusy(false);
      return;
    }

    onCompleted(`Ticket "${subject}" was created.`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-dialog-title"
        className="w-full max-w-lg rounded-t-xl border bg-popover p-5 sm:rounded-xl"
        style={{ boxShadow: "var(--shadow-dialog)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Support</p>
            <h2 id="ticket-dialog-title" className="mt-1 flex items-center gap-2 text-lg font-semibold">
              <Ticket aria-hidden="true" className="size-4" />
              New ticket
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground"
            aria-label="Close dialog"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Subject">
            <input
              autoFocus
              required
              maxLength={200}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
              placeholder="Cannot access account after password change"
            />
          </Field>
          <Field label="Requester email">
            <input
              required
              type="email"
              maxLength={254}
              value={requesterEmail}
              onChange={(event) => setRequesterEmail(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
              placeholder="customer@example.com"
            />
          </Field>
          <Field label="Priority">
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option} className="capitalize">
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              required
              minLength={10}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2.5 text-sm leading-5 outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
              placeholder="Describe the issue reported by the customer."
            />
          </Field>

          {error ? (
            <p role="alert" className="rounded-md bg-critical-muted px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t pt-4">
            <button type="button" onClick={onClose} disabled={busy} className="h-10 rounded-md border px-4 text-xs font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="gradient-button h-10 rounded-md px-4 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create ticket"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
