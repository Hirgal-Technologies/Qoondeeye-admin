"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/dashboard/PageHeading";
import {
  formatSalaamUsd,
  salaamBundleDifferenceLines,
  salaamCanResolveWithoutFulfillment,
  salaamReviewReasonText,
  salaamShowsFulfillmentActions,
  salaamShowsResolveWithoutFulfillment,
  salaamUnmatchedReviewLines,
  type PayableOfflineBundle,
  type SalaamReviewView,
} from "@/features/merchant-gateway/salaam-review-view";
import { salaamReviewActorLines } from "@/features/admin-users/identity";

type Review = SalaamReviewView & { bundleId: string };

function money(cents: number): string {
  return formatSalaamUsd(cents);
}

export function SalaamReviewPage({ hasAdminRole }: { hasAdminRole: boolean }) {
  const [rows, setRows] = useState<Review[] | null>(null);
  const [bundles, setBundles] = useState<PayableOfflineBundle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [chosenBundle, setChosenBundle] = useState<Record<string, string>>({});
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/merchant-gateway/salaam-reviews");
    const payload = (await response.json()) as { data?: Review[]; error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not load Salaam reviews.");
      return;
    }
    const next = payload.data ?? [];
    setRows(next);
    const unmatched = next.find((row) => row.reason === "unmatched_amount");
    if (!unmatched) return;
    const bundleResponse = await fetch("/api/merchant-gateway/salaam-reviews/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "payable_bundles", reviewId: unmatched.id }),
    });
    const bundlePayload = (await bundleResponse.json()) as {
      data?: { bundles?: PayableOfflineBundle[] };
      error?: string;
    };
    if (bundleResponse.ok) {
      setBundles(bundlePayload.data?.bundles ?? []);
    }
  }

  async function act(
    reviewId: string,
    action:
      | "preview"
      | "claim"
      | "resolve"
      | "select_intended_bundle"
      | "resolve_without_fulfillment",
  ) {
    setBusy(reviewId + action);
    setError(null);
    const response = await fetch("/api/merchant-gateway/salaam-reviews/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        reviewId,
        destination: destination[reviewId] ?? "",
        mappingId: chosenBundle[reviewId] ?? "",
        resolutionNote: resolutionNote[reviewId] ?? "",
        confirmed: confirmed[reviewId] === true,
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
        description="Only an administrator can handle a paid Salaam payment."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        eyebrow="Operations"
        title="Salaam review"
        description="These customers have already paid. Confirm a destination, or record which bundle an unknown amount was meant for. Do not ask them to pay again."
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
        <p className="text-sm">No Salaam payments waiting for review.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-lg border p-4">
              {row.reason === "unmatched_amount" ? (
                <UnmatchedReview
                  row={row}
                  bundles={bundles}
                  chosenBundleId={chosenBundle[row.id] ?? ""}
                  onChooseBundle={(mappingId) =>
                    setChosenBundle((current) => ({ ...current, [row.id]: mappingId }))
                  }
                  busy={busy != null}
                  onClaim={() => void act(row.id, "claim")}
                  onRecord={() => void act(row.id, "select_intended_bundle")}
                />
              ) : (
                <KnownAmountReview
                  row={row}
                  destination={destination[row.id] ?? ""}
                  preview={preview[row.id] ?? ""}
                  busy={busy != null}
                  onDestination={(value) =>
                    setDestination((current) => ({ ...current, [row.id]: value }))
                  }
                  onClaim={() => void act(row.id, "claim")}
                  onPreview={() => void act(row.id, "preview")}
                  onResolve={() => void act(row.id, "resolve")}
                />
              )}
              {salaamShowsResolveWithoutFulfillment(row) ? (
                <ResolveWithoutFulfillment
                  note={resolutionNote[row.id] ?? ""}
                  confirmed={confirmed[row.id] === true}
                  canResolve={salaamCanResolveWithoutFulfillment({
                    status: row.status,
                    reason: row.reason,
                    note: resolutionNote[row.id] ?? "",
                    confirmed: confirmed[row.id] === true,
                  })}
                  busy={busy != null}
                  onNote={(value) => setResolutionNote((current) => ({ ...current, [row.id]: value }))}
                  onConfirmed={(value) => setConfirmed((current) => ({ ...current, [row.id]: value }))}
                  onResolve={() => void act(row.id, "resolve_without_fulfillment")}
                />
              ) : row.resolutionType === "no_fulfillment" ? (
                <p className="mt-3 text-sm">
                  Closed without fulfillment. {row.resolutionNote}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function UnmatchedReview({
  row,
  bundles,
  chosenBundleId,
  onChooseBundle,
  busy,
  onClaim,
  onRecord,
}: {
  row: Review;
  bundles: PayableOfflineBundle[];
  chosenBundleId: string;
  onChooseBundle: (mappingId: string) => void;
  busy: boolean;
  onClaim: () => void;
  onRecord: () => void;
}) {
  const chosen = bundles.find((bundle) => bundle.id === chosenBundleId);
  const recorded =
    row.intendedPriceCents != null && row.intendedProviderName && row.intendedBundleName
      ? salaamBundleDifferenceLines({
          receivedCents: row.amountCents,
          providerName: row.intendedProviderName,
          bundleName: row.intendedBundleName,
          requiredCents: row.intendedPriceCents,
        })
      : [];
  return (
    <div className="flex flex-col gap-1">
      {salaamUnmatchedReviewLines(row).map((line) => (
        <p key={line} className={line.startsWith("PAID") ? "font-semibold" : "text-sm"}>
          {line}
        </p>
      ))}
      <p className="text-sm">Payment: {row.eventId}</p>
      <AdminActorLines row={row} />
      {recorded.length > 0 ? <p className="mt-2 text-sm font-semibold">Recorded intended bundle</p> : null}
      {recorded.map((line) => (
        <p key={line} className="text-sm">
          {line}
        </p>
      ))}
      {salaamShowsFulfillmentActions(row) ? (
        <div className="mt-3 flex flex-col gap-2">
          <button type="button" disabled={busy} onClick={onClaim}>
            Claim before calling
          </button>
          <label className="text-sm">
            Bundle the customer says they intended
            <select
              className="mt-1 block w-full rounded border px-2 py-1"
              value={chosenBundleId}
              onChange={(event) => onChooseBundle(event.target.value)}
            >
              <option value="">Choose the bundle the customer asked for</option>
              {bundles.map((bundle) => (
                <option key={bundle.id} value={bundle.id}>
                  {bundle.providerName} {bundle.bundleName} · {money(bundle.priceCents)}
                </option>
              ))}
            </select>
          </label>
          {chosen ? (
            <div className="text-sm">
              {salaamBundleDifferenceLines({
                receivedCents: row.amountCents,
                providerName: chosen.providerName,
                bundleName: chosen.bundleName,
                requiredCents: chosen.priceCents,
              }).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            disabled={busy || !chosenBundleId || row.status !== "claimed"}
            onClick={onRecord}
          >
            Record intended bundle
          </button>
          <p className="text-sm">
            Recording the bundle does not buy it. A price difference is not fulfilled automatically.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function KnownAmountReview({
  row,
  destination,
  preview,
  busy,
  onDestination,
  onClaim,
  onPreview,
  onResolve,
}: {
  row: Review;
  destination: string;
  preview: string;
  busy: boolean;
  onDestination: (value: string) => void;
  onClaim: () => void;
  onPreview: () => void;
  onResolve: () => void;
}) {
  return (
    <div>
      <p className="font-semibold">PAID · Salaam Bank · {money(row.amountCents)}</p>
      <p className="text-sm">
        Bundle: {row.providerName ? `${row.providerName} — ` : ""}
        {row.bundleName || row.bundleId}
      </p>
      <p className="text-sm">Payer: {row.payerMsisdn}</p>
      <p className="text-sm">Faahfaahin: {row.originalFaahfaahin || "Missing"}</p>
      <p className="text-sm">Reason: {salaamReviewReasonText(row.reason)}</p>
      <p className="text-sm">Received: {row.receivedAt}</p>
      <p className="text-sm">Tix: {row.bankTicket || "Missing"}</p>
      <p className="text-sm">Ref: {row.providerReference || "Missing"}</p>
      <p className="text-sm">Status: {row.status}</p>
      <AdminActorLines row={row} />
      {salaamShowsFulfillmentActions(row) ? (
        <div className="mt-3 flex flex-col gap-2">
          <button type="button" disabled={busy} onClick={onClaim}>
            Claim before calling
          </button>
          <label className="text-sm">
            Confirmed destination
            <input
              className="mt-1 block w-full rounded border px-2 py-1"
              value={destination}
              onChange={(event) => onDestination(event.target.value)}
            />
          </label>
          <button type="button" disabled={busy} onClick={onPreview}>
            Check destination
          </button>
          {preview ? <p className="text-sm">Normalized destination: {preview}</p> : null}
          <button type="button" disabled={busy} onClick={onResolve}>
            Confirm destination & continue
          </button>
        </div>
      ) : row.resolutionType === "no_fulfillment" ? null : (
        <p className="text-sm">
          Corrected destination: {row.correctedDestination}. Order: {row.orderId}
        </p>
      )}
    </div>
  );
}

function AdminActorLines({
  row,
}: {
  row: Pick<Review, "claimedBy" | "claimedByName" | "resolvedBy" | "resolvedByName" | "resolvedAt">;
}) {
  return (
    <>
      {salaamReviewActorLines(row).map((line) => (
        <p key={line} className="text-sm">
          {line}
        </p>
      ))}
    </>
  );
}

function ResolveWithoutFulfillment({
  note,
  confirmed,
  canResolve,
  busy,
  onNote,
  onConfirmed,
  onResolve,
}: {
  note: string;
  confirmed: boolean;
  canResolve: boolean;
  busy: boolean;
  onNote: (value: string) => void;
  onConfirmed: (value: boolean) => void;
  onResolve: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-3">
      <p className="text-sm font-semibold">Resolve without fulfillment</p>
      <p className="text-sm">
        Use this when the payment was a test, the customer was refunded, or the case was handled
        manually. This does not buy a bundle.
      </p>
      <label className="text-sm">
        Resolution reason
        <textarea
          className="mt-1 block w-full rounded border px-2 py-1"
          value={note}
          onChange={(event) => onNote(event.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => onConfirmed(event.target.checked)}
        />
        I confirm this payment should be closed without buying a bundle.
      </label>
      <button type="button" disabled={busy || !canResolve} onClick={onResolve}>
        Resolve without fulfillment
      </button>
    </div>
  );
}
