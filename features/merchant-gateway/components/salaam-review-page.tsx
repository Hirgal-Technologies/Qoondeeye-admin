"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { salaamReviewActorLines } from "@/features/admin-users/identity";

type Review = {
  id: string;
  status: "needs_review" | "claimed" | "resolved";
  reason: "missing_faahfaahin" | "invalid_destination" | "unmatched_amount";
  amountCents: number;
  payerMsisdn: string;
  originalFaahfaahin: string | null;
  correctedDestination: string | null;
  bankTicket: string | null;
  providerReference: string | null;
  receivedAt: string;
  claimedBy: string | null;
  claimedByName: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  bundleId: string;
  providerName: string | null;
  bundleName: string | null;
  destinationType: string | null;
  orderId: string | null;
  eventId: string;
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function reasonLabel(reason: Review["reason"]): string {
  if (reason === "missing_faahfaahin") return "Faahfaahin is missing";
  if (reason === "unmatched_amount") return "Amount does not match any Offline bundle";
  return "Faahfaahin is not valid";
}

export function SalaamReviewPage({ hasAdminRole }: { hasAdminRole: boolean }) {
  const [rows, setRows] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/merchant-gateway/salaam-reviews");
    const payload = (await response.json()) as { data?: Review[]; error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not load Salaam reviews.");
      return;
    }
    setRows(payload.data ?? []);
  }

  async function act(reviewId: string, action: "preview" | "claim" | "resolve") {
    setBusy(reviewId + action);
    setError(null);
    const response = await fetch("/api/merchant-gateway/salaam-reviews/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        reviewId,
        destination: destination[reviewId] ?? "",
      }),
    });
    const payload = (await response.json()) as {
      data?: { destination?: string; message?: string; claimedBy?: string };
      error?: string;
    };
    setBusy(null);
    if (!response.ok) {
      setError(payload.error || payload.data?.message || "The action was rejected.");
      await load();
      return;
    }
    if (action === "preview" && payload.data?.destination) {
      setPreview((current) => ({ ...current, [reviewId]: payload.data?.destination ?? "" }));
    }
    if (action !== "preview") await load();
  }

  if (!hasAdminRole) {
    return (
      <PageHeading
        eyebrow="Operations"
        title="Salaam review"
        description="Only an administrator can correct a paid Salaam destination."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        eyebrow="Operations"
        title="Salaam review"
        description="These customers have already paid. Confirm the number that should receive the bundle. Do not ask them to pay again."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/dashboard/merchant-gateway" className="text-sm font-semibold">
              Merchant gateway
            </Link>
            <button type="button" className="text-sm font-semibold" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rows == null ? (
        <button type="button" className="text-sm font-semibold" onClick={() => void load()}>
          Load paid Salaam reviews
        </button>
      ) : rows.length === 0 ? (
        <p className="text-sm">No Salaam destination reviews.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-lg border p-4">
              <p className="font-semibold">PAID · Salaam Bank · {money(row.amountCents)}</p>
              <p className="text-sm">
                Bundle: {row.providerName ? `${row.providerName} — ` : ""}
                {row.bundleName || row.bundleId}
              </p>
              <p className="text-sm">Payer: {row.payerMsisdn}</p>
              <p className="text-sm">Faahfaahin: {row.originalFaahfaahin || "Missing"}</p>
              <p className="text-sm">Reason: {reasonLabel(row.reason)}</p>
              <p className="text-sm">Received: {row.receivedAt}</p>
              <p className="text-sm">Tix: {row.bankTicket || "Missing"}</p>
              <p className="text-sm">Ref: {row.providerReference || "Missing"}</p>
              <p className="text-sm">Status: {row.status}</p>
              {salaamReviewActorLines(row).map((line) => (
                <p key={line} className="text-sm">
                  {line}
                </p>
              ))}
              {row.status !== "resolved" && row.reason === "unmatched_amount" ? (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-sm">The user has already paid. Fulfillment stays off until a price policy exists.</p>
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => void act(row.id, "claim")}
                  >
                    Claim before calling
                  </button>
                </div>
              ) : null}
              {row.status !== "resolved" && row.reason !== "unmatched_amount" ? (
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => void act(row.id, "claim")}
                  >
                    Claim before calling
                  </button>
                  <label className="text-sm">
                    Confirmed destination
                    <input
                      className="mt-1 block w-full rounded border px-2 py-1"
                      value={destination[row.id] ?? ""}
                      onChange={(event) =>
                        setDestination((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                    />
                  </label>
                  <button type="button" disabled={busy != null} onClick={() => void act(row.id, "preview")}>
                    Check destination
                  </button>
                  {preview[row.id] ? (
                    <p className="text-sm">Normalized destination: {preview[row.id]}</p>
                  ) : null}
                  <button type="button" disabled={busy != null} onClick={() => void act(row.id, "resolve")}>
                    Confirm destination & continue
                  </button>
                </div>
              ) : (
                <p className="text-sm">
                  Corrected destination: {row.correctedDestination}. Order: {row.orderId}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
