"use client";

import { Search, ShieldAlert, UserRoundSearch } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeading } from "@/components/dashboard/PageHeading";
import type { SupportUser } from "@/features/support/contracts";
import { formatDateTime } from "@/lib/formatters";

export function SupportLookup() {
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [result, setResult] = useState<SupportUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const response = await fetch("/api/support/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason, permissionConfirmed }),
    });
    const body = await response.json().catch(() => ({ data: null, error: "request failed" }));
    setLoading(false);

    if (!response.ok || body.error) {
      setError(
        response.status === 404
          ? "No account matched that ID."
          : "The lookup could not be completed. Check the account ID, reason, and permission confirmation."
      );
      return;
    }
    setResult(body.data as SupportUser);
  }

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
            <span className="mb-2 block text-xs font-medium">Qoondeeye user ID</span>
            <input
              required
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
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
        </form>

        <section className="gradient-surface rounded-lg border p-4 sm:p-5" aria-labelledby="lookup-result">
          <h2 id="lookup-result" className="text-sm font-semibold">Read-only support details</h2>
          <p className="mt-1 text-xs text-muted-foreground">Identity and account-access metadata only.</p>

          {result ? (
            <div className="mt-5">
              <div className="mb-4 rounded-md border border-destructive/35 bg-destructive/5 p-3 text-xs text-destructive">
                Private account data · Do not copy into unapproved tools or channels.
              </div>
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
              </dl>
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

function SupportField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 px-3 py-3 sm:grid-cols-[120px_1fr]">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={`break-all text-xs font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
