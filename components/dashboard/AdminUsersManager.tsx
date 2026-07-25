"use client";

import {
  KeyRound,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatePanel } from "@/components/states/StatePanel";
import type { AdminUserRow } from "@/features/admin-users/contracts";
import type { AdminRole } from "@/features/auth/contracts";
import { formatDateTime } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; user: AdminUserRow }
  | { kind: "delete"; user: AdminUserRow }
  | null;

const ROLE_OPTIONS: { value: AdminRole; label: string; detail: string }[] = [
  { value: "admin", label: "Administrator", detail: "Full dashboard access" },
  { value: "support", label: "Support", detail: "Analytics and support tools" },
  { value: "viewer", label: "Viewer", detail: "Read-only analytics" },
];

export function AdminUsersManager({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const roster = useApiData<AdminUserRow[]>("/api/admin-users");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState("");

  const users = roster.status === "success" ? roster.data : [];
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? users.filter((user) =>
        `${user.email} ${user.role} ${user.id}`
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : users;

  function completed(message: string) {
    setDialog(null);
    setNotice(message);
    roster.retry();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Access control"
        title="Admin users"
        description="Grant, change, or revoke access to the Qoondeeye administration dashboard."
        actions={
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setDialog({ kind: "create" });
            }}
            className="gradient-button inline-flex h-10 items-center gap-2 rounded-md px-4 text-xs font-semibold text-primary-foreground"
          >
            <UserPlus aria-hidden="true" className="size-4" />
            Add admin user
          </button>
        }
      />

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-success/25 bg-success-muted px-3 py-2.5 text-xs font-medium text-success"
        >
          <ShieldCheck aria-hidden="true" className="size-4" />
          {notice}
        </div>
      ) : null}

      {roster.status === "success" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary label="Total access" value={users.length} />
          <Summary
            label="Administrators"
            value={users.filter((user) => user.role === "admin").length}
          />
          <Summary
            label="Support & viewers"
            value={users.filter((user) => user.role !== "admin").length}
          />
        </div>
      ) : null}

      <section
        className="overflow-hidden rounded-lg border bg-card"
        aria-labelledby="admin-roster"
      >
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 id="admin-roster" className="text-sm font-semibold">
              Access roster
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Accounts authorized to enter this dashboard
            </p>
          </div>
          <label className="relative sm:w-72">
            <span className="sr-only">Search admin users</span>
            <Search
              aria-hidden="true"
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
              placeholder="Search email, role, or ID…"
            />
          </label>
        </div>

        <div className="p-4 sm:p-5">
          {roster.status === "loading" ? (
            <div className="space-y-2" aria-label="Loading admin users">
              {[0, 1, 2, 3].map((row) => (
                <div className="skeleton h-12 rounded-md" key={row} />
              ))}
            </div>
          ) : null}
          {roster.status === "error" ? (
            <StatePanel
              compact
              kind="error"
              title="Admin roster unavailable"
              description={roster.error}
              actionLabel="Retry"
              onAction={roster.retry}
            />
          ) : null}
          {roster.status === "success" && users.length === 0 ? (
            <StatePanel
              compact
              title="No admin users"
              description="Add an authorized account to start building the dashboard access roster."
            />
          ) : null}
          {roster.status === "success" &&
          users.length > 0 &&
          filtered.length === 0 ? (
            <StatePanel
              compact
              title="No matching admin users"
              description="Try another email address, role, or account ID."
            />
          ) : null}
          {filtered.length > 0 ? (
            <div className="overflow-auto rounded-md border">
              <table className="w-full min-w-[760px] text-left text-xs">
                <caption className="sr-only">Admin dashboard access roster</caption>
                <thead>
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Account
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Added
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user, index) => {
                    const isCurrent = user.id === currentUserId;
                    return (
                      <tr
                        key={user.id}
                        className={`border-b transition-colors last:border-0 hover:bg-[hsl(var(--surface-table-hover))] ${
                          index % 2
                            ? "bg-[hsl(var(--surface-table-row-alt))]"
                            : ""
                        }`}
                      >
                        <td className="px-3 py-3">
                          <div className="font-medium">
                            {user.email}
                            {isCurrent ? (
                              <span className="ml-2 rounded-full bg-info-muted px-2 py-0.5 text-[10px] text-info">
                                You
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {user.id}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                          {formatDateTime(user.createdAt)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setDialog({ kind: "edit", user })}
                              className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:text-foreground"
                              aria-label={`Edit ${user.email}`}
                            >
                              <Pencil aria-hidden="true" className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isCurrent}
                              title={
                                isCurrent
                                  ? "You cannot revoke your own access"
                                  : `Revoke ${user.email}`
                              }
                              onClick={() => setDialog({ kind: "delete", user })}
                              className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Revoke ${user.email}`}
                            >
                              <Trash2 aria-hidden="true" className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      {dialog ? (
        <AdminUserDialog
          key={
            dialog.kind === "create"
              ? "create"
              : `${dialog.kind}-${dialog.user.id}`
          }
          state={dialog}
          currentUserId={currentUserId}
          onClose={() => setDialog(null)}
          onCompleted={completed}
        />
      ) : null}
    </div>
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

function RoleBadge({ role }: { role: AdminRole }) {
  const classes =
    role === "admin"
      ? "bg-info-muted text-info"
      : role === "support"
        ? "bg-success-muted text-success"
        : "bg-neutral-muted text-neutral";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${classes}`}
    >
      {role}
    </span>
  );
}

function AdminUserDialog({
  state,
  currentUserId,
  onClose,
  onCompleted,
}: {
  state: Exclude<DialogState, null>;
  currentUserId: string;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const user = state.kind === "create" ? null : state.user;
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<AdminRole>(user?.role ?? "viewer");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const deleting = state.kind === "delete";
    const response = await fetch(
      state.kind === "create" ? "/api/admin-users" : `/api/admin-users/${user!.id}`,
      {
        method:
          state.kind === "create" ? "POST" : state.kind === "edit" ? "PATCH" : "DELETE",
        headers: deleting ? undefined : { "Content-Type": "application/json" },
        body: deleting
          ? undefined
          : JSON.stringify({
              email,
              role,
              ...(state.kind === "create" && password ? { password } : {}),
            }),
      }
    ).catch(() => null);

    if (!response) {
      setError("The request could not reach the server. Try again.");
      setBusy(false);
      return;
    }

    const result = await response
      .json()
      .catch(() => ({ error: "The server returned an invalid response." }));
    if (!response.ok) {
      setError(
        typeof result.error === "string"
          ? result.error
          : "The request could not be completed."
      );
      setBusy(false);
      return;
    }

    onCompleted(
      state.kind === "create"
        ? `${email} now has dashboard access.`
        : state.kind === "edit"
          ? `${email} was updated.`
          : `${user!.email} no longer has dashboard access.`
    );
  }

  const title =
    state.kind === "create"
      ? "Add admin user"
      : state.kind === "edit"
        ? "Edit admin user"
        : "Revoke dashboard access";

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
        aria-labelledby="admin-user-dialog-title"
        className="w-full max-w-lg rounded-t-xl border bg-popover p-5 sm:rounded-xl"
        style={{ boxShadow: "var(--shadow-dialog)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              Access control
            </p>
            <h2 id="admin-user-dialog-title" className="mt-1 text-lg font-semibold">
              {title}
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
          {state.kind === "delete" ? (
            <div className="rounded-md border border-destructive/25 bg-critical-muted p-4">
              <p className="text-sm font-medium">{user!.email}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                This removes the admin_users roster entry immediately. The
                underlying Supabase Auth account and audit history are retained.
              </p>
            </div>
          ) : (
            <>
              <Field label="Email address">
                <input
                  autoFocus
                  required
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                  placeholder="admin@qoondeeye.com"
                />
              </Field>
              <Field label="Dashboard role">
                <select
                  value={role}
                  disabled={user?.id === currentUserId}
                  onChange={(event) => setRole(event.target.value as AdminRole)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:opacity-60"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.detail}
                    </option>
                  ))}
                </select>
                {user?.id === currentUserId ? (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Your own administrator role cannot be changed.
                  </p>
                ) : null}
              </Field>
              {state.kind === "create" ? (
                <Field label="Temporary password (optional)">
                  <div className="relative">
                    <KeyRound
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="password"
                      minLength={8}
                      maxLength={72}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                      placeholder="Only needed for a new Auth account"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                    Leave blank to grant access to an existing Supabase Auth
                    account. Use 8–72 characters when creating a new account.
                  </p>
                </Field>
              ) : null}
            </>
          )}

          {error ? (
            <p
              role="alert"
              className="rounded-md bg-critical-muted px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="h-10 rounded-md border px-4 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className={`h-10 rounded-md px-4 text-xs font-semibold text-white disabled:opacity-60 ${
                state.kind === "delete"
                  ? "bg-destructive"
                  : "gradient-button text-primary-foreground"
              }`}
            >
              {busy
                ? "Saving…"
                : state.kind === "create"
                  ? "Grant access"
                  : state.kind === "edit"
                    ? "Save changes"
                    : "Revoke access"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
