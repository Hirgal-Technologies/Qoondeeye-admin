"use client";

import { useState } from "react";
import { StatePanel } from "@/components/states/StatePanel";
import type {
  ManualFulfillmentHistoryEntry,
  PaidFulfillmentOrder,
} from "@/features/merchant-gateway/contracts";
import {
  fulfillmentOperatorAction,
  maskPhone,
  paidOrderBucket,
  type PaidOrderBucket,
} from "@/features/merchant-gateway/operations";
import {
  formatMoney,
  formatPaymentMethod,
  formatRelativeTime,
  formatTimestamp,
} from "@/features/merchant-gateway/presentation";

export function PaidOrdersPanel({
  orders,
  reservationStateAvailable,
  manualHistory,
  manualHistoryAvailable,
  onRefresh,
  onReconcile,
}: {
  orders: PaidFulfillmentOrder[];
  reservationStateAvailable: boolean;
  manualHistory: ManualFulfillmentHistoryEntry[];
  manualHistoryAvailable: boolean;
  onRefresh: () => void;
  onReconcile: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [topTayoNote, setTopTayoNote] = useState<string | null>(null);
  const confirmOrder = orders.find((order) => order.id === confirmId) ?? null;

  async function submitManual(order: PaidFulfillmentOrder, retryRecording: boolean) {
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/merchant-gateway/manual-fulfillment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id, retryRecording }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { message?: string; state?: string; transactionId?: string | null } | null;
        error?: string | null;
      } | null;
      const message =
        payload?.data?.message ||
        payload?.error ||
        "Manual fulfillment stopped. Refresh the order before trying again.";
      const transactionId = payload?.data?.transactionId?.trim();
      setNotice(transactionId ? `${message} Transaction ${transactionId}.` : message);
      setConfirmId(null);
      onRefresh();
    } catch {
      setNotice(
        "Manual fulfillment stopped. Refresh the order before trying again. Do not purchase if TopTayo may already have been sent.",
      );
      setConfirmId(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function checkTopTayo(order: PaidFulfillmentOrder) {
    const transactionId =
      order.topTayoTransactionIds.find((id) => id.trim())?.trim() ||
      order.pendingRecordTransactionId?.trim() ||
      "";
    if (!transactionId) {
      setTopTayoNote(
        "No TopTayo transaction id is stored. Qoondeeye must reconcile this order. This dashboard will not send another recharge.",
      );
      return;
    }
    setTopTayoNote(null);
    try {
      const response = await fetch(
        `/api/resellers/transactions/${encodeURIComponent(transactionId)}`,
      );
      const payload = (await response.json().catch(() => null)) as {
        data?: { id?: string; status?: string } | null;
        error?: string | null;
      } | null;
      if (!response.ok || payload?.error || !payload?.data) {
        setTopTayoNote(payload?.error || "TopTayo status unavailable");
        return;
      }
      setTopTayoNote(
        `TopTayo ${payload.data.id ?? transactionId}: ${payload.data.status ?? "status unavailable"}. Order state was not changed.`,
      );
    } catch {
      setTopTayoNote("TopTayo status unavailable");
    }
  }

  return (
    <section
      id="fulfillment"
      className="scroll-mt-24 rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Paid, bundle not completed</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            Customers whose payment is confirmed and whose bundle is not completed. A recharge is sent only after Qoondeeye authorizes that one send.
          </p>
        </div>
        {!reservationStateAvailable ? (
          <p className="text-xs text-muted-foreground">Reservation state unavailable</p>
        ) : null}
      </div>
      {notice ? (
        <p className="mt-3 rounded-md border border-dashed bg-warning-muted/40 px-3 py-2 text-xs leading-5" role="status">
          {notice}
        </p>
      ) : null}
      {topTayoNote ? (
        <p className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5" role="status">
          {topTayoNote}
        </p>
      ) : null}
      {orders.length === 0 ? (
        <div className="mt-4">
          <StatePanel
            compact
            title="No paid orders waiting"
            description="Confirmed payments whose bundle has not completed will show up here."
          />
        </div>
      ) : (
        <div className="mt-4 overflow-auto rounded-md border">
          <table className="w-full min-w-[1280px] text-left text-xs">
            <thead>
              <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Order</th>
                <th className="px-3 py-2.5 font-medium">Payer</th>
                <th className="px-3 py-2.5 font-medium">Destination</th>
                <th className="px-3 py-2.5 font-medium">Method</th>
                <th className="px-3 py-2.5 font-medium">Paid</th>
                <th className="px-3 py-2.5 font-medium">Bundle</th>
                <th className="px-3 py-2.5 font-medium">TopTayo cost</th>
                <th className="px-3 py-2.5 font-medium">Merchant txn</th>
                <th className="px-3 py-2.5 font-medium">Fulfillment</th>
                <th className="px-3 py-2.5 font-medium">Reservation</th>
                <th className="px-3 py-2.5 font-medium">Hold</th>
                <th className="px-3 py-2.5 font-medium">TopTayo txn</th>
                <th className="px-3 py-2.5 font-medium">Paid at</th>
                <th className="px-3 py-2.5 font-medium">Waiting</th>
                <th className="px-3 py-2.5 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onFulfill={() => {
                    setNotice(null);
                    setConfirmId(order.id);
                  }}
                  onRetryRecording={() => void submitManual(order, true)}
                  onReconcile={onReconcile}
                  onRefresh={onRefresh}
                  onCheck={() => void checkTopTayo(order)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmOrder ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-fulfill-title"
            className="w-full max-w-md rounded-lg border bg-card p-5 shadow-[var(--shadow-dialog)]"
          >
            <h3 id="manual-fulfill-title" className="text-sm font-semibold">
              {confirmOrder.reservationOutcome === "manual_claimed"
                ? "Continue manual fulfillment"
                : "Fulfill manually"}
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Qoondeeye claims this order and returns the destination, bundle, and cost. One TopTayo recharge is sent only after begin-send authorizes it. This form does not choose those values.
            </p>
            <dl className="mt-3 grid gap-2 text-xs">
              <Fact label="Destination" value={confirmOrder.destinationPhone || "—"} />
              <Fact label="Bundle" value={confirmOrder.bundleName} />
              <Fact
                label="TopTayo cost"
                value={formatMoney(confirmOrder.topTayoCostCents, confirmOrder.currency)}
              />
              <Fact label="Amount paid" value={formatMoney(confirmOrder.amountPaidCents, confirmOrder.currency)} />
            </dl>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmId(null)}
                className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitManual(confirmOrder, false)}
                className="gradient-button inline-flex h-9 items-center rounded-md px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "Checking…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ManualHistory entries={manualHistory} available={manualHistoryAvailable} />
    </section>
  );
}

function OrderRow({
  order,
  onFulfill,
  onRetryRecording,
  onReconcile,
  onRefresh,
  onCheck,
}: {
  order: PaidFulfillmentOrder;
  onFulfill: () => void;
  onRetryRecording: () => void;
  onReconcile: () => void;
  onRefresh: () => void;
  onCheck: () => void;
}) {
  const action = fulfillmentOperatorAction({
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    failureCode: order.failureCode,
    topTayoTransactionIds: order.topTayoTransactionIds,
    pendingRecordTransactionId: order.pendingRecordTransactionId,
    reservation: order.reservationKnown
      ? { known: true, outcome: order.reservationOutcome }
      : { known: false },
  });
  const bucket = paidOrderBucket({
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    failureCode: order.failureCode,
    reservationOutcome: order.reservationOutcome,
  });

  return (
    <tr className="border-b align-top last:border-0">
      <td className="px-3 py-3 font-mono">{shortId(order.id)}</td>
      <td className="whitespace-nowrap px-3 py-3 font-mono">{maskPhone(order.payerPhone)}</td>
      <td className="whitespace-nowrap px-3 py-3 font-mono">{maskPhone(order.destinationPhone)}</td>
      <td className="px-3 py-3">{formatPaymentMethod(order.paymentMethod)}</td>
      <td className="whitespace-nowrap px-3 py-3 tabular-nums">
        {formatMoney(order.amountPaidCents, order.currency)}
      </td>
      <td className="px-3 py-3">
        <p className="font-medium">{order.bundleName}</p>
        <p className="text-[11px] text-muted-foreground">{order.providerName || "—"}</p>
      </td>
      <td className="whitespace-nowrap px-3 py-3 tabular-nums">
        {formatMoney(order.topTayoCostCents, order.currency)}
      </td>
      <td className="px-3 py-3 font-mono">
        {order.merchantTxnLookup === "unavailable"
          ? "Unavailable"
          : order.merchantProviderTxnId || "—"}
      </td>
      <td className="px-3 py-3">
        <BucketPill bucket={bucket} fulfillment={order.fulfillmentStatus} />
      </td>
      <td className="px-3 py-3">
        {order.reservationKnown ? order.reservationOutcome || "None" : "Unavailable"}
      </td>
      <td className="px-3 py-3 text-muted-foreground">
        {order.failureCode ? order.failureCode.replace(/_/g, " ") : "—"}
      </td>
      <td className="px-3 py-3 font-mono">
        {order.topTayoTransactionIds.length > 0 ? order.topTayoTransactionIds.join(", ") : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
        {formatTimestamp(order.paidAt)}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
        {formatRelativeTime(order.paidAt ?? order.lastFulfillmentAttemptAt)}
      </td>
      <td className="px-3 py-3">
        {action === "fulfill_manually" ? (
          <button
            type="button"
            onClick={onFulfill}
            className="inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] font-medium hover:border-primary/40 hover:text-primary"
          >
            Fulfill manually
          </button>
        ) : null}
        {action === "continue_manual" ? (
          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={onFulfill}
              className="inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] font-medium hover:border-primary/40 hover:text-primary"
            >
              Continue manual fulfillment
            </button>
            <p className="max-w-[14rem] text-[11px] leading-4 text-muted-foreground">
              Manual fulfillment claimed — ready to continue
            </p>
          </div>
        ) : null}
        {action === "retry_recording" ? (
          <div className="flex flex-col items-start gap-1">
            <p className="max-w-[16rem] text-[11px] leading-4 text-warning">
              Bundle purchase was submitted to TopTayo. Qoondeeye recording is still pending. Do not purchase again.
            </p>
            <button type="button" onClick={onRetryRecording} className="text-[11px] font-medium text-primary">
              Retry recording transaction
            </button>
            <button type="button" onClick={onCheck} className="text-[11px] font-medium text-primary">
              Check TopTayo
            </button>
            <button type="button" onClick={onRefresh} className="text-[11px] font-medium text-primary">
              Refresh status
            </button>
          </div>
        ) : null}
        {action === "reconcile" ? (
          <div className="flex flex-col items-start gap-1">
            <p className="text-[11px] font-medium text-warning">Reconciliation required</p>
            <button type="button" onClick={onCheck} className="text-[11px] font-medium text-primary">
              Check TopTayo
            </button>
            <button type="button" onClick={onReconcile} className="text-[11px] font-medium text-primary">
              Reconcile
            </button>
            <button type="button" onClick={onRefresh} className="text-[11px] font-medium text-primary">
              Refresh
            </button>
          </div>
        ) : null}
        {action === "check_toptayo" ? (
          <div className="flex flex-col items-start gap-1">
            <button type="button" onClick={onCheck} className="text-[11px] font-medium text-primary">
              Check TopTayo
            </button>
            <button type="button" onClick={onRefresh} className="text-[11px] font-medium text-primary">
              Refresh status
            </button>
          </div>
        ) : null}
        {action === "refresh_only" ? (
          <button type="button" onClick={onRefresh} className="text-[11px] font-medium text-primary">
            Refresh status
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function BucketPill({
  bucket,
  fulfillment,
}: {
  bucket: PaidOrderBucket;
  fulfillment: string;
}) {
  const classes =
    bucket === "recharge_uncertain" ||
    bucket === "toptayo_processing" ||
    bucket === "fulfillment_held"
        ? "bg-warning-muted text-warning"
        : bucket === "completed"
          ? "bg-success-muted text-success"
          : "bg-neutral-muted text-muted-foreground";
  const label =
    bucket === "recharge_uncertain"
      ? "Recharge uncertain"
      : bucket === "toptayo_processing"
        ? "TopTayo processing"
        : bucket === "fulfillment_held"
          ? "Fulfillment held"
          : bucket === "completed"
            ? "Completed"
            : fulfillment;
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${classes}`}>
      {label}
    </span>
  );
}

function ManualHistory({
  entries,
  available,
}: {
  entries: ManualFulfillmentHistoryEntry[];
  available: boolean;
}) {
  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="text-xs font-semibold text-foreground">Manual fulfillment history</h3>
      {!available ? (
        <p className="mt-2 text-xs text-muted-foreground">Manual fulfillment history unavailable</p>
      ) : entries.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No manual fulfillment events recorded yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="text-xs leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">{historyActionLabel(entry.action)}</span>
              {" · "}
              {entry.adminEmail}
              {" · "}
              {formatTimestamp(entry.createdAt)}
              {" · "}
              <span className="font-mono">{shortId(entry.orderId)}</span>
              {entry.reservationOutcome ? ` · ${entry.reservationOutcome}` : ""}
              {entry.topTayoTransactionId ? ` · ${entry.topTayoTransactionId}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function historyActionLabel(action: string) {
  if (action === "claim") return "Claimed";
  if (action === "begin_send") return "Send started";
  if (action === "finalize") return "Transaction recorded";
  if (action === "uncertain") return "Uncertain";
  return action.replace(/_/g, " ");
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function shortId(value: string) {
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}
