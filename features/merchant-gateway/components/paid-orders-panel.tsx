"use client";

import { useState } from "react";
import { StatePanel } from "@/components/states/StatePanel";
import type {
  ManualFulfillmentHistoryEntry,
  PaidFulfillmentOrder,
} from "@/features/merchant-gateway/contracts";
import {
  RESUME_CANONICAL_FULFILLMENT_SUPPORTED,
  fulfillmentOperatorAction,
  isCanonicalResumeCase,
  isClosedFulfillment,
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
  recentCompleted,
  reservationStateAvailable,
  manualHistory,
  manualHistoryAvailable,
  onRefresh,
  onReconcile,
}: {
  orders: PaidFulfillmentOrder[];
  recentCompleted: PaidFulfillmentOrder[];
  reservationStateAvailable: boolean;
  manualHistory: ManualFulfillmentHistoryEntry[];
  manualHistoryAvailable: boolean;
  onRefresh: () => void;
  onReconcile: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"neutral" | "critical">("neutral");
  const [submitting, setSubmitting] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const attention = orders.filter(
    (order) => !isClosedFulfillment(order.fulfillmentStatus),
  );
  const confirmOrder = attention.find((order) => order.id === confirmId) ?? null;
  const detailOrder =
    [...attention, ...recentCompleted].find((order) => order.id === detailId) ?? null;

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
      setNoticeTone(response.ok && payload?.data ? "neutral" : "critical");
      setNotice(transactionId ? `${message} Transaction ${transactionId}.` : message);
      setConfirmId(null);
      onRefresh();
    } catch {
      setNoticeTone("critical");
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
      setNoticeTone("neutral");
      setNotice(
        "No TopTayo transaction id is stored. Qoondeeye must reconcile this order. This dashboard will not send another recharge.",
      );
      return;
    }
    setCheckingId(order.id);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/resellers/transactions/${encodeURIComponent(transactionId)}`,
      );
      const payload = (await response.json().catch(() => null)) as {
        data?: { id?: string; status?: string } | null;
        error?: string | null;
      } | null;
      if (!response.ok || payload?.error || !payload?.data) {
        setNoticeTone("critical");
        setNotice(payload?.error || "TopTayo status unavailable");
        return;
      }
      const status = payload.data.status ?? "status unavailable";
      const completed = /complete|success|delivered/i.test(status);
      setNoticeTone("neutral");
      setNotice(
        completed
          ? `TopTayo ${payload.data.id ?? transactionId} reports ${status}. The order was reloaded from Qoondeeye. This console did not mark fulfillment successful.`
          : `TopTayo ${payload.data.id ?? transactionId}: ${status}. The order was reloaded from Qoondeeye and was not changed here.`,
      );
      onRefresh();
    } catch {
      setNoticeTone("critical");
      setNotice("TopTayo status unavailable");
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <section
      id="fulfillment"
      className="scroll-mt-24 rounded-lg border bg-card p-3 shadow-[var(--shadow-card)] sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            Confirmed payments whose bundle is still open. A recharge is offered only when Qoondeeye has reserved exactly one send.
          </p>
        </div>
        {!reservationStateAvailable ? (
          <p className="text-xs text-muted-foreground">Reservation state unavailable</p>
        ) : null}
      </div>
      {notice ? (
        <p
          className={`mt-3 rounded-md border px-3 py-2 text-xs leading-5 ${
            noticeTone === "critical" ? "border-critical/40 text-critical" : "border-dashed bg-muted/30"
          }`}
          role="status"
        >
          {notice}
        </p>
      ) : null}
      {attention.length === 0 ? (
        <div className="mt-3">
          <StatePanel
            compact
            title="No paid orders waiting"
            description="Confirmed payments that still need fulfillment or reconciliation will show up here."
          />
        </div>
      ) : (
        <>
          <div className="mt-3 hidden md:block">
            <table className="w-full table-fixed text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="w-[12%] px-2 py-2 font-medium">Order</th>
                  <th className="w-[12%] px-2 py-2 font-medium">Destination</th>
                  <th className="w-[10%] px-2 py-2 font-medium">Method</th>
                  <th className="w-[10%] px-2 py-2 font-medium">Paid</th>
                  <th className="w-[16%] px-2 py-2 font-medium">Bundle</th>
                  <th className="w-[14%] px-2 py-2 font-medium">Fulfillment</th>
                  <th className="w-[10%] px-2 py-2 font-medium">Waiting</th>
                  <th className="sticky right-0 w-[16%] bg-card px-2 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {attention.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    checking={checkingId === order.id}
                    onOpen={() => setDetailId(order.id)}
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
          <div className="mt-3 flex flex-col gap-2 md:hidden">
            {attention.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                checking={checkingId === order.id}
                onOpen={() => setDetailId(order.id)}
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
          </div>
        </>
      )}

      <div className="mt-3 border-t pt-3">
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-expanded={historyOpen}
        >
          {historyOpen ? "Hide" : "Show"} history / resolved ({recentCompleted.length})
        </button>
        {historyOpen ? (
          recentCompleted.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No completed orders in the recent window.</p>
          ) : (
            <ul className="mt-2 divide-y rounded-md border">
              {recentCompleted.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="font-mono">{shortId(order.id)}</span>
                    {" · "}
                    {order.bundleName}
                    {" · "}
                    {formatMoney(order.amountPaidCents, order.currency)}
                  </span>
                  <span className="shrink-0 rounded-full bg-success-muted px-2 py-0.5 text-[10px] font-medium text-success">
                    Completed
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      {detailOrder ? (
        <OrderDetails order={detailOrder} onClose={() => setDetailId(null)} />
      ) : null}

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

type RowActions = {
  order: PaidFulfillmentOrder;
  checking: boolean;
  onOpen: () => void;
  onFulfill: () => void;
  onRetryRecording: () => void;
  onReconcile: () => void;
  onRefresh: () => void;
  onCheck: () => void;
};

function OrderRow(props: RowActions) {
  const { order, onOpen } = props;
  const bucket = bucketFor(order);
  return (
    <tr className="border-b align-middle last:border-0">
      <td className="px-2 py-2">
        <button type="button" onClick={onOpen} className="font-mono text-primary underline-offset-2 hover:underline">
          {shortId(order.id)}
        </button>
      </td>
      <td className="truncate px-2 py-2 font-mono">{maskPhone(order.destinationPhone)}</td>
      <td className="px-2 py-2">{formatPaymentMethod(order.paymentMethod)}</td>
      <td className="px-2 py-2 tabular-nums">{formatMoney(order.amountPaidCents, order.currency)}</td>
      <td className="truncate px-2 py-2 font-medium">{order.bundleName}</td>
      <td className="px-2 py-2">
        <BucketPill bucket={bucket} fulfillment={order.fulfillmentStatus} />
      </td>
      <td className="px-2 py-2 text-muted-foreground">{formatRelativeTime(order.paidAt ?? order.lastFulfillmentAttemptAt)}</td>
      <td className="sticky right-0 bg-card px-2 py-2">
        <OrderActions {...props} />
      </td>
    </tr>
  );
}

function OrderCard(props: RowActions) {
  const { order, onOpen } = props;
  return (
    <article className="rounded-md border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="text-left">
          <p className="font-mono text-xs text-primary">{shortId(order.id)}</p>
          <p className="mt-1 text-sm font-medium">{order.bundleName}</p>
        </button>
        <BucketPill bucket={bucketFor(order)} fulfillment={order.fulfillmentStatus} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {maskPhone(order.destinationPhone)} · {formatPaymentMethod(order.paymentMethod)} ·{" "}
        {formatMoney(order.amountPaidCents, order.currency)}
      </p>
      <div className="mt-2">
        <OrderActions {...props} />
      </div>
    </article>
  );
}

function OrderActions({
  order,
  checking,
  onFulfill,
  onRetryRecording,
  onReconcile,
  onRefresh,
  onCheck,
}: RowActions) {
  const safety = {
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    failureCode: order.failureCode,
    topTayoTransactionIds: order.topTayoTransactionIds,
    pendingRecordTransactionId: order.pendingRecordTransactionId,
    reservation: order.reservationKnown
      ? { known: true as const, outcome: order.reservationOutcome }
      : { known: false as const },
  };
  const action = fulfillmentOperatorAction(safety);
  const resumeCase = isCanonicalResumeCase(safety);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {resumeCase && !RESUME_CANONICAL_FULFILLMENT_SUPPORTED ? (
        <span className="inline-flex flex-col items-start gap-0.5">
          <button
            type="button"
            disabled
            className="inline-flex h-7 cursor-not-allowed items-center rounded-md border px-2 text-[11px] font-medium opacity-60"
          >
            Resume fulfillment
          </button>
          <span className="text-[10px] leading-4 text-muted-foreground">
            Backend required: resume canonical fulfillment
          </span>
        </span>
      ) : null}
      {action === "resume_fulfillment" ? (
        <span className="text-[11px] text-muted-foreground">Backend required: resume canonical fulfillment</span>
      ) : null}
      {action === "fulfill_manually" ? (
        <ActionButton onClick={onFulfill}>Fulfill manually</ActionButton>
      ) : null}
      {action === "continue_manual" ? (
        <ActionButton onClick={onFulfill}>Continue manual fulfillment</ActionButton>
      ) : null}
      {action === "retry_recording" ? (
        <>
          <ActionButton onClick={onRetryRecording}>Retry recording transaction</ActionButton>
          <ActionButton onClick={onCheck} disabled={checking}>
            {checking ? "Checking…" : "Check TopTayo"}
          </ActionButton>
        </>
      ) : null}
      {action === "reconcile" ? (
        <>
          <ActionButton onClick={onCheck} disabled={checking}>
            {checking ? "Checking…" : "Check TopTayo"}
          </ActionButton>
          <ActionButton onClick={onReconcile}>Reconcile</ActionButton>
        </>
      ) : null}
      {action === "check_toptayo" ? (
        <ActionButton onClick={onCheck} disabled={checking} prominent>
          {checking ? "Checking…" : "Check TopTayo"}
        </ActionButton>
      ) : null}
      {action !== "none" ? <ActionButton onClick={onRefresh}>Refresh</ActionButton> : null}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  prominent,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  prominent?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium disabled:opacity-50 ${
        prominent
          ? "border-primary/40 bg-primary/10 text-primary"
          : "hover:border-primary/40 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function OrderDetails({ order, onClose }: { order: PaidFulfillmentOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border bg-card p-5 shadow-[var(--shadow-dialog)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="order-detail-title" className="text-sm font-semibold">
            Order {shortId(order.id)}
          </h3>
          <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <Fact label="Payer" value={maskPhone(order.payerPhone)} />
          <Fact label="Destination" value={order.destinationPhone || "—"} />
          <Fact label="Method" value={formatPaymentMethod(order.paymentMethod)} />
          <Fact label="Paid" value={formatMoney(order.amountPaidCents, order.currency)} />
          <Fact label="TopTayo cost" value={formatMoney(order.topTayoCostCents, order.currency)} />
          <Fact
            label="Merchant txn"
            value={
              order.merchantTxnLookup === "unavailable"
                ? "Unavailable"
                : order.merchantProviderTxnId || "—"
            }
          />
          <Fact
            label="Reservation"
            value={order.reservationKnown ? order.reservationOutcome || "None" : "Unavailable"}
          />
          <Fact label="Failure" value={order.failureCode?.replace(/_/g, " ") || "—"} />
          <Fact
            label="TopTayo txn"
            value={
              order.topTayoTransactionIds.length > 0
                ? order.topTayoTransactionIds.join(", ")
                : order.pendingRecordTransactionId || "—"
            }
          />
          <Fact label="Paid at" value={formatTimestamp(order.paidAt)} />
          <Fact label="Last attempt" value={formatTimestamp(order.lastFulfillmentAttemptAt)} />
          <Fact label="Updated" value={formatTimestamp(order.updatedAt)} />
        </dl>
      </div>
    </div>
  );
}

function bucketFor(order: PaidFulfillmentOrder) {
  return paidOrderBucket({
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    failureCode: order.failureCode,
    reservationOutcome: order.reservationOutcome,
    topTayoTransactionIds: order.topTayoTransactionIds,
  });
}

function BucketPill({ bucket, fulfillment }: { bucket: PaidOrderBucket; fulfillment: string }) {
  const classes =
    bucket === "recharge_uncertain" || bucket === "toptayo_processing" || bucket === "needs_fulfillment"
      ? "bg-warning-muted text-warning"
      : bucket === "fulfillment_held"
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
          : bucket === "needs_fulfillment"
            ? "Needs fulfillment"
            : bucket === "completed"
              ? "Completed"
              : fulfillment;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${classes}`}>
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
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {open ? "Hide" : "Show"} manual fulfillment history
      </button>
      {open ? (
        !available ? (
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
        )
      ) : null}
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
      <dd className="mt-0.5 break-all font-medium text-foreground">{value}</dd>
    </div>
  );
}

function shortId(value: string) {
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}
