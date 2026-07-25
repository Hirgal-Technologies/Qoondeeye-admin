"use client";

import {
  Ban,
  KeyRound,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  UserRoundSearch,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { PageHeading } from "@/components/dashboard/PageHeading";
import type { AuditLogRow } from "@/features/audit/contracts";
import type { SupportUser } from "@/features/support/contracts";
import { formatDateTime } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

type PendingAction = "disable" | "enable" | "reset_password" | null;

export function SupportLookup() {
  const [identifier, setIdentifier] = useState("");
  const [reason, setReason] = useState("");
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [result, setResult] = useState<SupportUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  const recentActivity = useApiData<AuditLogRow[]>("/api/support/activity");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setActionNotice("");

    const response = await fetch("/api/support/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, reason, permissionConfirmed }),
    });
    const body = await response.json().catch(() => ({ data: null, error: "request failed" }));
    setLoading(false);

    if (!response.ok || body.error) {
      setError(
        response.status === 404
          ? "No account matched that ID or email."
          : "The lookup could not be completed. Check the account ID/email, reason, and permission confirmation."
      );
      return;
    }
    setResult(body.data as SupportUser);
    recentActivity.retry();
  }

  async function runAction(action: Exclude<PendingAction, null>) {
    if (!result) return;
    setActionBusy(true);
    setActionError("");

    const response = await fetch("/api/support/account-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: result.id, action, reason: actionReason }),
    }).catch(() => null);

    const body = await response
      ?.json()
      .catch(() => ({ data: null, error: "The server returned an invalid response." }));
    setActionBusy(false);

    if (!response || !response.ok || body.error) {
      setActionError(
        typeof body?.error === "string" ? body.error : "The action could not be completed."
      );
      return;
    }

    setResult(body.data as SupportUser);
    setPendingAction(null);
    setActionReason("");
    setActionNotice(
      action === "disable"
        ? "The account has been disabled."
        : action === "enable"
          ? "The account has been re-enabled."
          : "A password reset email has been sent."
    );
    recentActivity.retry();
  }

  const isBanned = result?.isBanned ?? false;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Audited support access"
        title="Support tools"
        description="Look up a single account for an active support case. Every attempt is permission-checked and audit logged."
      />

      <div className="flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/5 p-4">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="text-xs font-medium">Privacy-sensitive area</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Access only the minimum account information required to resolve the stated support case.
            Financial records are not included in this lookup.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={onSubmit} className="gradient-surface rounded-lg border p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <UserRoundSearch aria-hidden="true" className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Account lookup</h2>
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-xs font-medium">Qoondeeye user ID or email</span>
            <input
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000 or user@example.com"
              className="h-11 w-full rounded-md border bg-background px-3 font-mono text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-medium">Reason for access</span>
            <textarea
              required
              minLength={20}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Describe the active support case and why account access is required."
              className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2.5 text-xs leading-5 outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
            />
            <span className="mt-1.5 block text-[10px] text-muted-foreground">
              Minimum 20 characters · stored in the audit event
            </span>
          </label>

          <label className="mt-4 flex items-start gap-3 rounded-md border bg-muted/35 p-3 text-xs">
            <input
              type="checkbox"
              checked={permissionConfirmed}
              onChange={(event) => setPermissionConfirmed(event.target.checked)}
              className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
            />
            <span className="leading-5 text-muted-foreground">
              I confirm I am authorized to access this account for the support reason above.
            </span>
          </label>

          {error ? <p className="mt-4 text-xs text-destructive" role="alert">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || !permissionConfirmed || reason.trim().length < 20}
            className="gradient-button mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search aria-hidden="true" className="size-4" />
            {loading ? "Recording access…" : "Record access and look up"}
          </button>

          <div className="mt-6 border-t pt-4">
            <h3 className="text-xs font-semibold">Recent support lookups</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Last 15 audited support events</p>
            <div className="mt-3 max-h-64 space-y-2 overflow-auto">
              {recentActivity.status === "loading" ? (
                <div className="space-y-2" aria-label="Loading recent activity">
                  {[0, 1, 2].map((row) => (
                    <div className="skeleton h-9 rounded-md" key={row} />
                  ))}
                </div>
              ) : null}
              {recentActivity.status === "success" && recentActivity.data.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No support activity recorded yet.</p>
              ) : null}
              {recentActivity.status === "success"
                ? recentActivity.data.map((event) => (
                    <div key={event.id} className="rounded-md border bg-background px-2.5 py-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{event.action.replace(/_/g, " ")}</span>
                        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground">
                        {event.actorEmail} · {event.resource}
                      </p>
                    </div>
                  ))
                : null}
            </div>
          </div>
        </form>

        <section className="gradient-surface rounded-lg border p-4 sm:p-5" aria-labelledby="lookup-result">
          <h2 id="lookup-result" className="text-sm font-semibold">Read-only support details</h2>
          <p className="mt-1 text-xs text-muted-foreground">Identity and account-access metadata only.</p>

          {result ? (
            <div className="mt-5">
              <div className="mb-4 rounded-md border border-destructive/35 bg-destructive/5 p-3 text-xs text-destructive">
                Private account data · Do not copy into unapproved tools or channels.
              </div>

              {actionNotice ? (
                <div role="status" className="mb-4 flex items-center gap-2 rounded-md border border-success/25 bg-success-muted px-3 py-2.5 text-xs font-medium text-success">
                  <ShieldCheck aria-hidden="true" className="size-4" />
                  {actionNotice}
                </div>
              ) : null}

              <dl className="divide-y rounded-md border">
                <SupportField label="User ID" value={result.id} mono />
                <SupportField label="Email" value={result.email} />
                <SupportField label="Created" value={formatDateTime(result.createdAt)} />
                <SupportField
                  label="Last sign-in"
                  value={result.lastSignInAt ? formatDateTime(result.lastSignInAt) : "No sign-in recorded"}
                />
                <SupportField
                  label="Providers"
                  value={result.providers.length ? result.providers.join(", ") : "Email"}
                />
                <SupportField label="Access status" value={isBanned ? "Disabled" : "Active"} />
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {isBanned ? (
                  <ActionButton
                    icon={UserRoundCheck}
                    label="Re-enable account"
                    onClick={() => {
                      setPendingAction("enable");
                      setActionReason("");
                      setActionError("");
                    }}
                  />
                ) : (
                  <ActionButton
                    icon={Ban}
                    label="Disable account"
                    destructive
                    onClick={() => {
                      setPendingAction("disable");
                      setActionReason("");
                      setActionError("");
                    }}
                  />
                )}
                <ActionButton
                  icon={KeyRound}
                  label="Trigger password reset"
                  onClick={() => {
                    setPendingAction("reset_password");
                    setActionReason("");
                    setActionError("");
                  }}
                />
              </div>

              {pendingAction ? (
                <div className="mt-4 rounded-md border bg-muted/35 p-3">
                  <p className="text-xs font-medium">
                    {pendingAction === "disable"
                      ? "Confirm disabling this account"
                      : pendingAction === "enable"
                        ? "Confirm re-enabling this account"
                        : "Confirm password reset email"}
                  </p>
                  <label className="mt-2 block">
                    <span className="mb-1.5 block text-[11px] text-muted-foreground">
                      Reason (10+ characters, stored in the audit event)
                    </span>
                    <textarea
                      value={actionReason}
                      onChange={(event) => setActionReason(event.target.value)}
                      minLength={10}
                      className="min-h-16 w-full resize-y rounded-md border bg-background px-2.5 py-2 text-xs leading-5 outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                      placeholder="Explain why this action is required for the support case."
                    />
                  </label>
                  {actionError ? (
                    <p className="mt-2 text-xs text-destructive" role="alert">{actionError}</p>
                  ) : null}
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setPendingAction(null)}
                      className="h-9 rounded-md border px-3 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy || actionReason.trim().length < 10}
                      onClick={() => runAction(pendingAction)}
                      className={`h-9 rounded-md px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                        pendingAction === "disable" ? "bg-destructive" : "gradient-button text-primary-foreground"
                      }`}
                    >
                      {actionBusy ? "Working…" : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 grid min-h-64 place-items-center rounded-md border border-dashed bg-muted/20 p-6 text-center">
              <div>
                <UserRoundSearch aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-3 text-xs font-medium">No account loaded</p>
                <p className="mt-1 max-w-xs text-[11px] leading-5 text-muted-foreground">
                  Complete the audited lookup form to view approved read-only details.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: typeof Ban;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium ${
        destructive
          ? "hover:border-destructive/40 hover:text-destructive"
          : "hover:border-primary/30 hover:text-primary"
      }`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  );
}

function SupportField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 px-3 py-3 sm:grid-cols-[120px_1fr]">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={`break-all text-xs font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
