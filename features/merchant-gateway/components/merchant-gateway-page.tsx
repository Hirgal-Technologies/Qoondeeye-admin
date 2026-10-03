"use client";

import {
  Bell,
  CircleAlert,
  RefreshCw,
  Scale,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatePanel } from "@/components/states/StatePanel";
import { PaidOrdersPanel } from "@/features/merchant-gateway/components/paid-orders-panel";
import type {
  BundleOrderSnapshot,
  GatewayHistory,
  GatewayHistoryItem,
  MerchantGatewayDevice,
  MerchantGatewaySummary,
  MerchantPaymentEvent,
  PaidFulfillmentOrder,
  PaymentReviewFilter,
  ReconciliationContext,
  ReconciliationResult,
} from "@/features/merchant-gateway/contracts";
import {
  displayOptionalCount,
  maskPhone,
  paidOrderBucket,
  simDisplay,
  alertMatchesFilter,
  type AlertFilter,
} from "@/features/merchant-gateway/operations";
import {
  PAYMENT_REVIEW_FILTERS,
  buildReconcileRequest,
  canEnableConfirm,
  compareEventToOrder,
  formatBattery,
  formatMoney,
  formatOperatorNetwork,
  formatPaymentMethod,
  formatRelativeTime,
  formatTimestamp,
  fulfillmentResultCopy,
  gatewayHeadline,
  gatewayHeadlineTone,
  inferAuthorizedPaymentMethods,
  inspectReconciliation,
  isOrderExpired,
  operationalDevices,
  parseMerchantSection,
  parsePaymentReviewFilter,
  paymentFilterLabel,
  reconciliationErrorMessage,
  shouldRefreshReconciliation,
} from "@/features/merchant-gateway/presentation";
import { SafeguardsPanel } from "@/features/operations/components/safeguards-panel";
import { formatInteger } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

export function MerchantGatewayPage({ hasAdminRole }: { hasAdminRole: boolean }) {
  if (!hasAdminRole) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          eyebrow="Operations"
          title="Merchant gateway"
          description="Gateway health, merchant payment review, and fulfillment status for administrators."
        />
        <StatePanel
          kind="permission"
          title="Administrator permission required"
          description="Merchant payments include payer numbers and receiver accounts. Only administrators can open this section."
        />
      </div>
    );
  }

  return <AuthorizedMerchantGateway canReconcile={hasAdminRole} />;
}

function AuthorizedMerchantGateway({ canReconcile }: { canReconcile: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const section = parseMerchantSection(searchParams.get("section"));
  const paymentStatus = parsePaymentReviewFilter(searchParams.get("status")) ?? "UNMATCHED";
  const summary = useApiData<MerchantGatewaySummary>("/api/merchant-gateway/summary");
  const payments = useApiData<MerchantPaymentEvent[]>(
    `/api/merchant-gateway/payments?status=${paymentStatus}`,
  );
  const history = useApiData<GatewayHistory>("/api/merchant-gateway/alerts");
  const reconciliation = useApiData<ReconciliationContext>(
    "/api/merchant-gateway/reconciliation",
  );

  function openSection(nextSection: string, status?: PaymentReviewFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", nextSection);
    if (nextSection === "payments") params.set("status", status ?? paymentStatus);
    else params.delete("status");
    router.replace(`/dashboard/merchant-gateway?${params.toString()}`, { scroll: false });
  }

  const counts = summary.status === "success" ? summary.data.counts : null;
  const gatewayCount =
    summary.status === "success"
      ? operationalDevices(summary.data.devices).length
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        eyebrow="Operations"
        title="Merchant gateway"
        description="Live gateway health, paid orders waiting for a bundle, and payment reconciliation."
        actions={
          <div className="flex items-center gap-3">
            {summary.status === "success" ? (
              <p className="text-[11px] text-muted-foreground">
                Updated {formatTimestamp(summary.data.generatedAt)}
              </p>
            ) : null}
            <button
            type="button"
            onClick={() => {
              summary.retry();
              payments.retry();
              history.retry();
              reconciliation.retry();
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            Refresh
          </button>
          </div>
        }
      />

      <section aria-labelledby="merchant-summary">
        <h2 id="merchant-summary" className="sr-only">
          Merchant gateway summary
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          <CompactMetric
            label="Gateway status"
            value={counts ? gatewayHeadline(counts) : undefined}
            detail={
              counts
                ? `${formatInteger.format(gatewayCount)} active`
                : undefined
            }
            tone={
              counts
                ? gatewayHeadlineTone(counts) === "critical"
                  ? "critical"
                  : gatewayHeadlineTone(counts) === "warning"
                    ? "attention"
                    : "quiet"
                : "quiet"
            }
            href="/dashboard/merchant-gateway?section=gateways"
            loading={summary.status === "loading"}
          />
          <CompactMetric
            label="Paid awaiting"
            value={counts ? formatInteger.format(counts.paidAwaitingFulfillment) : undefined}
            detail="Open confirmed payments"
            tone={counts && counts.paidAwaitingFulfillment > 0 ? "attention" : "quiet"}
            href="/dashboard/merchant-gateway?section=gateways#fulfillment"
            loading={summary.status === "loading"}
          />
          <CompactMetric
            label="Recharge uncertain"
            value={counts ? formatInteger.format(counts.rechargeUncertain) : undefined}
            detail="Do not send another recharge"
            tone={counts && counts.rechargeUncertain > 0 ? "critical" : "quiet"}
            href="/dashboard/merchant-gateway?section=reconciliation"
            loading={summary.status === "loading"}
          />
          <CompactMetric
            label="Fulfillment held"
            value={counts ? formatInteger.format(counts.fulfillmentHeld) : undefined}
            detail="Safeguard hold"
            tone={counts && counts.fulfillmentHeld > 0 ? "attention" : "quiet"}
            href="/dashboard/merchant-gateway?section=gateways#fulfillment"
            loading={summary.status === "loading"}
          />
          <CompactMetric
            label="Unmatched"
            value={counts ? formatInteger.format(counts.unmatchedPayments) : undefined}
            detail="Unresolved payments"
            tone={counts && counts.unmatchedPayments > 0 ? "attention" : "quiet"}
            href="/dashboard/merchant-gateway?section=payments&status=UNMATCHED"
            loading={summary.status === "loading"}
          />
          <CompactMetric
            label="Ambiguous"
            value={counts ? formatInteger.format(counts.ambiguousPayments) : undefined}
            detail="Unresolved ambiguous"
            tone={counts && counts.ambiguousPayments > 0 ? "attention" : "quiet"}
            href="/dashboard/merchant-gateway?section=payments&status=AMBIGUOUS"
            loading={summary.status === "loading"}
          />
          <CompactMetric
            label="Active alerts"
            value={counts ? formatInteger.format(counts.activeAlerts) : undefined}
            detail={
              summary.status === "success" && !summary.data.fulfillmentAlertsAvailable
                ? "Fulfillment alerts unavailable"
                : "Current incidents"
            }
            tone={counts && counts.activeAlerts > 0 ? "attention" : "quiet"}
            href="/dashboard/merchant-gateway?section=alerts"
            loading={summary.status === "loading"}
          />
        </div>
      </section>

      <div
        role="tablist"
        aria-label="Merchant gateway sections"
        className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
      >
        <SectionTab
          active={section === "gateways"}
          icon={Smartphone}
          label="Gateways"
          onClick={() => openSection("gateways")}
        />
        <SectionTab
          active={section === "payments"}
          icon={CircleAlert}
          label="Payments"
          onClick={() => openSection("payments")}
        />
        <SectionTab
          active={section === "alerts"}
          icon={Bell}
          label="Alerts"
          onClick={() => openSection("alerts")}
        />
        <SectionTab
          active={section === "reconciliation"}
          icon={Scale}
          label="Reconciliation"
          onClick={() => openSection("reconciliation")}
        />
      </div>

      {section === "gateways" ? (
        <GatewaysPanel
          summary={summary}
          onRetry={summary.retry}
          onRefresh={() => {
            summary.retry();
            payments.retry();
            reconciliation.retry();
          }}
          onReconcile={() => openSection("reconciliation")}
        />
      ) : null}
      {section === "payments" ? (
        <PaymentsPanel
          events={payments}
          status={paymentStatus}
          onStatus={(status) => openSection("payments", status)}
          onRetry={payments.retry}
        />
      ) : null}
      {section === "alerts" ? (
        <AlertsPanel
          history={history}
          onRetry={history.retry}
          fulfillmentAlertsAvailable={
            summary.status === "success" ? summary.data.fulfillmentAlertsAvailable : true
          }
        />
      ) : null}
      {section === "reconciliation" ? (
        <ReconciliationPanel
          canReconcile={canReconcile}
          context={reconciliation}
          paidOrders={summary.status === "success" ? summary.data.paidOrders : null}
          recentCompleted={summary.status === "success" ? summary.data.recentCompleted : null}
          ordersState={summary.status}
          onRetry={reconciliation.retry}
          onRefresh={() => {
            summary.retry();
            payments.retry();
            reconciliation.retry();
          }}
        />
      ) : null}
    </div>
  );
}

function GatewaysPanel({
  summary,
  onRetry,
  onRefresh,
  onReconcile,
}: {
  summary: ReturnType<typeof useApiData<MerchantGatewaySummary>>;
  onRetry: () => void;
  onRefresh: () => void;
  onReconcile: () => void;
}) {
  const [revokeTarget, setRevokeTarget] = useState<MerchantGatewayDevice | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const productionDevices =
    summary.status === "success" ? operationalDevices(summary.data.devices) : [];
  const historicalDevices = summary.status === "success" ? summary.data.historicalDevices : [];

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const response = await fetch("/api/merchant-gateway/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: revokeTarget.id }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string | null } | null;
      if (!response.ok || payload?.error) {
        setRevokeError(payload?.error || "Qoondeeye did not revoke the gateway.");
        return;
      }
      setRevokeTarget(null);
      onRefresh();
    } catch {
      setRevokeError("Qoondeeye could not be reached. The gateway was not revoked.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {summary.status === "success" ? (
        <SafeguardsPanel view={summary.data.safeguards} compact />
      ) : null}
      <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Gateway devices</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Server health is authoritative. A payment method that is not authorized is shown as not configured.
        </p>
        <div className="mt-4">
          {summary.status === "loading" ? <CardSkeleton /> : null}
          {summary.status === "error" ? (
            <StatePanel
              compact
              kind="error"
              title="Gateway data unavailable"
              description={summary.error}
              actionLabel="Try again"
              onAction={onRetry}
            />
          ) : null}
          {summary.status === "success" && productionDevices.length === 0 ? (
            <StatePanel
              compact
              title="No production gateways"
              description="Enrolled gateway devices will appear here after the backend records them."
            />
          ) : null}
          {summary.status === "success" && productionDevices.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {productionDevices.map((device) => (
                <GatewayCard device={device} key={device.id} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {summary.status === "success" && historicalDevices.length > 0 ? (
        <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <h2 className="text-sm font-semibold text-foreground">Revoked and historical gateways</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Lab and revoked gateways stay out of the active count. Revoke keeps history and does not delete the device.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {historicalDevices.map((device) => (
              <article key={device.id} className="rounded-lg border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">{device.name}</h3>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{device.id}</p>
                  </div>
                  <GatewayStatusBadge status={device.status} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Last heartbeat {formatRelativeTime(device.lastHeartbeatAt)}
                </p>
                {device.status !== "REVOKED" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRevokeError(null);
                      setRevokeTarget(device);
                    }}
                    className="mt-3 inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] font-medium hover:border-primary/40 hover:text-primary"
                  >
                    Revoke gateway
                  </button>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">Revoked. History is kept.</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {revokeTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-gateway-title"
            className="w-full max-w-md rounded-lg border bg-card p-5 shadow-[var(--shadow-dialog)]"
          >
            <h3 id="revoke-gateway-title" className="text-sm font-semibold">
              Revoke gateway
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              This marks the gateway revoked in Qoondeeye. Payment history stays. Confirm this is the device you intend to revoke.
            </p>
            <dl className="mt-3 grid gap-2 text-xs">
              <div>
                <dt className="text-[11px] text-muted-foreground">Name</dt>
                <dd className="mt-0.5 font-medium text-foreground">{revokeTarget.name}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Device id</dt>
                <dd className="mt-0.5 font-mono text-foreground">{revokeTarget.id}</dd>
              </div>
            </dl>
            {revokeError ? <p className="mt-3 text-xs text-critical">{revokeError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={revoking}
                onClick={() => setRevokeTarget(null)}
                className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={() => void confirmRevoke()}
                className="inline-flex h-9 items-center rounded-md border border-critical/40 px-3 text-xs font-medium text-critical disabled:opacity-50"
              >
                {revoking ? "Revoking…" : "Revoke gateway"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {summary.status === "success" ? (
        <PaidOrdersPanel
          orders={summary.data.paidOrders}
          recentCompleted={summary.data.recentCompleted}
          reservationStateAvailable={summary.data.reservationStateAvailable}
          manualHistory={summary.data.manualHistory}
          manualHistoryAvailable={summary.data.manualHistoryAvailable}
          onRefresh={onRefresh}
          onReconcile={onReconcile}
        />
      ) : null}
    </div>
  );
}

function GatewayCard({ device }: { device: MerchantGatewayDevice }) {
  const authorized = inferAuthorizedPaymentMethods(device.receiverMsisdns);
  const sims = (["edahab", "evc_plus"] as const).map((method) =>
    simDisplay(
      method,
      authorized,
      method === "evc_plus" ? device.evcSimDetected : device.edahabSimDetected,
    ),
  );
  const problem =
    device.status === "DEGRADED" || device.status === "OFFLINE" ? device.statusReason : null;

  return (
    <article className="rounded-lg border bg-background px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="truncate text-sm font-semibold text-foreground">{device.name}</h3>
        <GatewayStatusBadge status={device.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        {sims.map((sim) => (
          <div key={sim.label}>
            <dt className="text-[11px] text-muted-foreground">{sim.label === "eDahab" ? "eDahab" : "EVC Plus"}</dt>
            <dd
              className={`mt-0.5 font-medium ${
                sim.tone === "success"
                  ? "text-success"
                  : sim.tone === "critical"
                    ? "text-critical"
                    : "text-muted-foreground"
              }`}
            >
              {sim.value}
            </dd>
          </div>
        ))}
        <Fact label="Heartbeat" value={formatRelativeTime(device.lastHeartbeatAt)} />
        <Fact label="Last payment" value={formatRelativeTime(device.lastMerchantEventAt)} />
        <Fact label="Pending upload" value={displayOptionalCount(device.pendingUploadCount)} />
        <Fact label="Network" value={formatOperatorNetwork(device.networkConnected, device.networkType)} />
        <Fact label="Battery" value={formatBattery(device.batteryPercent)} />
        <Fact label="App" value={device.appVersion || "Not reported"} />
      </dl>
      {device.receiverMsisdns.length > 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Receiver {device.receiverMsisdns.map((value) => maskPhone(value)).join(", ")}
        </p>
      ) : null}
      {problem ? <p className="mt-2 text-[11px] leading-5 text-warning">Reason: {problem}</p> : null}
    </article>
  );
}

function PaymentsPanel({
  events,
  status,
  onStatus,
  onRetry,
}: {
  events: ReturnType<typeof useApiData<MerchantPaymentEvent[]>>;
  status: PaymentReviewFilter;
  onStatus: (status: PaymentReviewFilter) => void;
  onRetry: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () =>
      events.status === "success"
        ? (events.data.find((event) => event.id === selectedId) ?? null)
        : null,
    [events, selectedId],
  );

  return (
    <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">Payment review</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {status === "MATCHED"
          ? "Latest payments already matched to an order, newest first."
          : "Inspect a merchant SMS payment without changing its match or fulfillment."}
      </p>
      <div
        role="tablist"
        aria-label="Payment statuses"
        className="mt-4 flex w-fit max-w-full flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
      >
        {PAYMENT_REVIEW_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={status === filter}
            onClick={() => {
              setSelectedId(null);
              onStatus(filter);
            }}
            className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition-colors ${
              status === filter
                ? "gradient-button text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            {paymentFilterLabel(filter)}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {events.status === "loading" ? <CardSkeleton label="Loading payments" /> : null}
        {events.status === "error" ? (
          <StatePanel
            compact
            kind="error"
            title="Payments could not be loaded"
            description={events.error}
            actionLabel="Try again"
            onAction={onRetry}
          />
        ) : null}
        {events.status === "success" && events.data.length === 0 ? (
          <StatePanel
            compact
            title={`No ${paymentFilterLabel(status).toLowerCase()} payments`}
            description="This queue is empty. Refresh after the gateway uploads a new SMS."
          />
        ) : null}
        {events.status === "success" && events.data.length > 0 ? (
          <>
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Payer</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Receiver</th>
                    <th className="px-3 py-2 font-medium">Provider txn</th>
                    <th className="px-3 py-2 font-medium">Received</th>
                    <th className="px-3 py-2 font-medium">Candidates</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.data.map((event, index) => (
                    <tr
                      key={event.id}
                      className={`border-b last:border-0 ${
                        selectedId === event.id
                          ? "bg-primary/10"
                          : index % 2 === 1
                            ? "bg-[hsl(var(--surface-table-row-alt))]"
                            : ""
                      }`}
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedId((current) => (current === event.id ? null : event.id))
                          }
                          className="font-medium text-primary underline-offset-2 hover:underline"
                          aria-expanded={selectedId === event.id}
                        >
                          {formatPaymentMethod(event.paymentMethod ?? event.provider)}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">
                        {maskPhone(event.payerMsisdn)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums">
                        {formatMoney(event.amountCents, event.currency)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">
                        {maskPhone(event.merchantReceiverMsisdn)}
                      </td>
                      <td className="max-w-28 truncate px-3 py-2 font-mono">
                        {event.providerTxnId || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatTimestamp(event.receivedAt)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {event.candidateCount == null
                          ? "—"
                          : event.candidateCount === 0
                            ? "None loaded"
                            : String(event.candidateCount)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill value={event.status} kind="payment" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selected ? <PaymentInspection event={selected} /> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function PaymentInspection({ event }: { event: MerchantPaymentEvent }) {
  return (
    <div className="mt-4 rounded-md border bg-background p-4" aria-live="polite">
      <h3 className="text-sm font-semibold text-foreground">Payment inspection</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
        <Fact label="Method" value={formatPaymentMethod(event.paymentMethod ?? event.provider)} />
        <Fact label="Payer" value={event.payerMsisdn || "—"} />
        <Fact label="Amount" value={formatMoney(event.amountCents, event.currency)} />
        <Fact label="Merchant receiver" value={event.merchantReceiverMsisdn || "—"} />
        <Fact label="Gateway received" value={formatTimestamp(event.receivedAt)} />
        <Fact label="Provider time" value={formatTimestamp(event.providerTimestamp)} />
        <Fact label="Uploaded" value={formatTimestamp(event.uploadedAt)} />
        <Fact label="Status" value={formatStatusLabel(event.status)} />
        <Fact label="Gateway" value={event.deviceName || "—"} />
        <Fact label="Provider transaction id" value={event.providerTxnId || "Not included in the SMS"} />
        <Fact
          label="Candidates"
          value={
            event.candidateCount == null
              ? "Not loaded for this tab"
              : event.candidateOrders.length > 0
                ? event.candidateOrders.map((order) => order.bundleName).join(", ")
                : "No pending order shares amount, method, and receiver"
          }
        />
        <Fact label="Matched order" value={event.order?.bundleName ?? "None"} />
        <Fact
          label="Fulfillment"
          value={event.order ? formatStatusLabel(event.order.fulfillmentStatus) : "—"}
        />
      </dl>
    </div>
  );
}

function AlertsPanel({
  history,
  onRetry,
  fulfillmentAlertsAvailable,
}: {
  history: ReturnType<typeof useApiData<GatewayHistory>>;
  onRetry: () => void;
  fulfillmentAlertsAvailable: boolean;
}) {
  const [filter, setFilter] = useState<AlertFilter>("active");
  const items =
    history.status === "success"
      ? [...history.data.alerts, ...history.data.transitions]
      : [];
  const visible = items.filter((item) => alertMatchesFilter(item, filter));
  const filters: AlertFilter[] = ["active", "resolved", "gateway", "payment", "fulfillment"];

  return (
    <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">Alerts</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Stored gateway and fulfillment alerts. This page does not create alerts.
      </p>
      {!fulfillmentAlertsAvailable ? (
        <p className="mt-2 text-xs text-muted-foreground">Fulfillment alerts unavailable</p>
      ) : null}
      <div
        role="tablist"
        aria-label="Alert filters"
        className="mt-4 flex w-fit max-w-full flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
      >
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={filter === item}
            onClick={() => setFilter(item)}
            className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-medium capitalize ${
              filter === item
                ? "gradient-button text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {history.status === "loading" ? <CardSkeleton /> : null}
        {history.status === "error" ? (
          <StatePanel
            compact
            kind="error"
            title="Alerts could not be loaded"
            description={history.error}
            actionLabel="Try again"
            onAction={onRetry}
          />
        ) : null}
        {history.status === "success" && visible.length === 0 ? (
          <StatePanel
            compact
            title={filter === "active" ? "No pending alerts" : `No ${filter} alerts`}
            description="Stored alerts for this filter will appear here."
          />
        ) : null}
        {history.status === "success" && visible.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {visible.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <HistoryTone tone={item.tone} label={item.label} />
                    <span className="text-[11px] capitalize text-muted-foreground">{item.category}</span>
                    <span className="text-[11px] text-muted-foreground">{item.deviceName}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <time className="shrink-0 text-[11px] text-muted-foreground">
                  {formatTimestamp(item.at)}
                </time>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function ReconciliationPanel({
  canReconcile,
  context,
  paidOrders,
  recentCompleted,
  ordersState,
  onRetry,
  onRefresh,
}: {
  canReconcile: boolean;
  context: ReturnType<typeof useApiData<ReconciliationContext>>;
  paidOrders: PaidFulfillmentOrder[] | null;
  recentCompleted: PaidFulfillmentOrder[] | null;
  ordersState: "loading" | "error" | "success";
  onRetry: () => void;
  onRefresh: () => void;
}) {
  const [eventId, setEventId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [allowPayerMismatch, setAllowPayerMismatch] = useState(false);
  const [allowExpiredOrder, setAllowExpiredOrder] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const data = context.status === "success" ? context.data : null;
  const event = data?.unresolvedEvents.find((item) => item.id === eventId) ?? null;
  const order = data?.eligibleOrders.find((item) => item.id === orderId) ?? null;
  const decision = event && order ? inspectReconciliation(event, order) : null;
  const comparison = event && order ? compareEventToOrder(event, order) : [];
  const role = canReconcile ? "admin" : "viewer";
  const orderQueueState = ordersState === "success" ? "ready" : ordersState;
  const confirmEnabled =
    decision != null &&
    canEnableConfirm({
      role,
      decision,
      allowPayerMismatch,
      allowExpiredOrder,
      reason,
    });
  const request =
    event && order && decision
      ? buildReconcileRequest({
          role,
          eventId: event.id,
          orderId: order.id,
          decision,
          allowPayerMismatch,
          allowExpiredOrder,
          reason,
        })
      : null;

  function resetOverrides() {
    setAllowPayerMismatch(false);
    setAllowExpiredOrder(false);
    setReason("");
  }

  async function submit() {
    if (!request || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/merchant-gateway/reconciliation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = (await response.json().catch(() => null)) as {
        data: ReconciliationResult | null;
        error: string | null;
        message?: string;
      } | null;
      if (response.ok && payload?.data?.ok) {
        setResult(payload.data);
        setModalOpen(false);
        setEventId("");
        setOrderId("");
        resetOverrides();
        onRefresh();
        return;
      }
      const code = payload?.error ?? "rejected";
      setNotice(payload?.message ?? reconciliationErrorMessage(code));
      setModalOpen(false);
      if (shouldRefreshReconciliation({ kind: "error", code })) onRefresh();
    } catch {
      setNotice("The reconciliation request could not be sent.");
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">Reconciliation</h2>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
        Unmatched payments, held fulfillment, and uncertain recharges stay separate. Confirming a match still goes through the audited backend action.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <QueueCard
          title="Unmatched merchant payments"
          empty="No unmatched payments"
          rows={
            data
              ? data.unresolvedEvents
                  .filter((event) => event.status === "UNMATCHED")
                  .map((event) => paymentQueueLine(event))
              : []
          }
          state={context.status === "success" ? "ready" : context.status}
        />
        <QueueCard
          title="Ambiguous payments"
          empty="No ambiguous payments"
          rows={
            data
              ? data.unresolvedEvents
                  .filter((event) => event.status === "AMBIGUOUS")
                  .map((event) => paymentQueueLine(event))
              : []
          }
          state={context.status === "success" ? "ready" : context.status}
        />
        <QueueCard
          title="Paid fulfillment held"
          empty="No fulfillment exceptions"
          rows={(paidOrders ?? [])
            .filter((order) => paidOrderBucket(order) === "fulfillment_held")
            .map((order) => orderQueueLine(order))}
          state={orderQueueState}
        />
        <QueueCard
          title="Recharge uncertain"
          empty="No recharge uncertain orders"
          rows={(paidOrders ?? [])
            .filter((order) => paidOrderBucket(order) === "recharge_uncertain")
            .map((order) => orderQueueLine(order))}
          state={orderQueueState}
        />
        <QueueCard
          title="TopTayo processing"
          empty="No TopTayo processing orders"
          rows={(paidOrders ?? [])
            .filter((order) => paidOrderBucket(order) === "toptayo_processing")
            .map((order) => orderQueueLine(order))}
          state={orderQueueState}
        />
        <QueueCard
          title="Resolved / completed"
          empty="No completed orders in this window"
          rows={(recentCompleted ?? []).map((order) => orderQueueLine(order))}
          state={orderQueueState}
        />
      </div>

      <h3 className="mt-6 text-sm font-semibold text-foreground">Manual payment match</h3>

      {context.status === "loading" ? (
        <div className="mt-4">
          <CardSkeleton />
        </div>
      ) : null}
      {context.status === "error" ? (
        <div className="mt-4">
          <StatePanel
            compact
            kind="error"
            title="Reconciliation data could not be loaded"
            description={context.error}
            actionLabel="Try again"
            onAction={onRetry}
          />
        </div>
      ) : null}

      {data ? (
        <div className="mt-4 flex flex-col gap-4">
          {result ? <ReconciliationResultBanner result={result} /> : null}
          {notice ? (
            <p className="rounded-md border border-dashed bg-warning-muted/40 px-3 py-2 text-xs leading-5 text-foreground" role="status">
              {notice}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
              Unresolved payment
              <select
                value={eventId}
                onChange={(input) => {
                  setEventId(input.target.value);
                  resetOverrides();
                  setNotice(null);
                }}
                className="h-10 rounded-md border bg-background px-2 text-xs font-normal text-foreground"
              >
                <option value="">Select a payment</option>
                {data.unresolvedEvents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {paymentOptionLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
              Eligible pending order
              <select
                value={orderId}
                onChange={(input) => {
                  setOrderId(input.target.value);
                  resetOverrides();
                  setNotice(null);
                }}
                className="h-10 rounded-md border bg-background px-2 text-xs font-normal text-foreground"
              >
                <option value="">Select an order</option>
                {data.eligibleOrders.map((item) => (
                  <option key={item.id} value={item.id}>
                    {orderOptionLabel(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {comparison.length > 0 && decision ? (
            <div className="overflow-auto rounded-md border">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Check</th>
                    <th className="px-3 py-2.5 font-medium">Payment event</th>
                    <th className="px-3 py-2.5 font-medium">Pending order</th>
                    <th className="px-3 py-2.5 font-medium">Inspection</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr className="border-b last:border-0" key={row.label}>
                      <td className="px-3 py-3 font-medium">{row.label}</td>
                      <td className="px-3 py-3 font-mono tabular-nums">{row.eventValue}</td>
                      <td className="px-3 py-3 font-mono tabular-nums">{row.orderValue}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${
                            row.aligned
                              ? "bg-success-muted text-success"
                              : "bg-critical-muted text-critical"
                          }`}
                        >
                          {row.aligned ? "Aligned" : "Differs"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                This comparison is a preview. The backend revalidates the payment before it confirms
                the order.
                {order
                  ? isOrderExpired(order.expiresAt)
                    ? ` Payment window ended ${formatTimestamp(order.expiresAt)}.`
                    : order.expiresAt
                      ? ` Payment window ends ${formatTimestamp(order.expiresAt)}.`
                      : " This order has no recorded payment window."
                  : ""}
              </p>
            </div>
          ) : null}

          {decision?.hardBlocked ? (
            <p className="rounded-md border bg-critical-muted/50 px-3 py-2 text-xs leading-5 text-foreground">
              Amount, currency, payment method, and merchant receiver must match. Those differences
              cannot be overridden.
            </p>
          ) : null}

          {canReconcile && decision && !decision.hardBlocked ? (
            <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-4">
              {decision.payerOverrideAvailable ? (
                <div className="rounded-md border border-dashed bg-warning-muted/50 p-3">
                  <p className="text-xs font-medium text-foreground">
                    This payment came from a different payer than the pending order expects.
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={allowPayerMismatch}
                      onChange={(input) => setAllowPayerMismatch(input.target.checked)}
                    />
                    Allow payer mismatch
                  </label>
                </div>
              ) : null}
              {decision.expiredOverrideAvailable ? (
                <div className="rounded-md border border-dashed bg-warning-muted/50 p-3">
                  <p className="text-xs font-medium text-foreground">
                    This order is past its payment window
                    {order?.expiresAt ? ` (${formatTimestamp(order.expiresAt)})` : ""}.
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={allowExpiredOrder}
                      onChange={(input) => setAllowExpiredOrder(input.target.checked)}
                    />
                    Allow expired order
                  </label>
                </div>
              ) : null}
              <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                Resolution reason
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(input) => setReason(input.target.value)}
                  placeholder={
                    decision.exact
                      ? "Optional note for the audit record"
                      : "Required reason for the audit record"
                  }
                  className="rounded-md border bg-background px-2 py-2 text-xs font-normal"
                />
              </label>
              <button
                type="button"
                disabled={!confirmEnabled}
                onClick={() => setModalOpen(true)}
                className="inline-flex h-9 w-fit items-center rounded-md px-3 text-xs font-medium gradient-button text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm match
              </button>
            </div>
          ) : null}

          {!canReconcile ? (
            <StatePanel
              compact
              kind="permission"
              title="Confirmation is limited to administrators"
              description="You can inspect this payment, but only an administrator can confirm it."
            />
          ) : null}

          <AuditList entries={data.audit} />
        </div>
      ) : null}

      {modalOpen && event && order && request ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reconcile-title"
            className="w-full max-w-md rounded-lg border bg-card p-5 shadow-[var(--shadow-dialog)]"
          >
            <h3 id="reconcile-title" className="text-sm font-semibold text-foreground">
              Confirm this match
            </h3>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs">
              <Fact label="Payer" value={event.payerMsisdn || "—"} />
              <Fact label="Amount" value={formatMoney(event.amountCents, event.currency)} />
              <Fact
                label="Payment method"
                value={formatPaymentMethod(event.paymentMethod ?? event.provider)}
              />
              <Fact label="Order" value={order.bundleName} />
              <Fact label="Recharge number" value={order.rechargePhone || "—"} />
            </dl>
            {request.allowPayerMismatch ? (
              <p className="mt-3 text-xs leading-5 text-foreground">
                You are allowing a payer mismatch. The reason will be stored with the audit record.
              </p>
            ) : null}
            {request.allowExpiredOrder ? (
              <p className="mt-3 text-xs leading-5 text-foreground">
                You are allowing an order whose payment window ended{" "}
                {formatTimestamp(order.expiresAt)}.
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="gradient-button inline-flex h-9 items-center rounded-md px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "Confirming…" : "Confirm match"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function QueueCard({
  title,
  empty,
  rows,
  state,
}: {
  title: string;
  empty: string;
  rows: string[];
  state: "loading" | "error" | "ready";
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      {state === "loading" ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
      ) : state === "error" ? (
        <p className="mt-2 text-xs text-muted-foreground">Unavailable</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.slice(0, 6).map((row, index) => (
            <li key={`${title}-${index}`} className="truncate text-xs text-foreground">
              {row}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function paymentQueueLine(event: MerchantPaymentEvent) {
  const candidates =
    event.candidateCount == null ? "" : ` · ${event.candidateCount} candidate${event.candidateCount === 1 ? "" : "s"}`;
  return `${formatPaymentMethod(event.paymentMethod ?? event.provider)} · ${maskPhone(event.payerMsisdn)} · ${formatMoney(event.amountCents, event.currency)} · ${event.merchantReceiverMsisdn ? maskPhone(event.merchantReceiverMsisdn) : "—"} · ${event.providerTxnId || "No provider id"} · ${formatTimestamp(event.receivedAt)}${candidates}`;
}

function orderQueueLine(order: PaidFulfillmentOrder) {
  return `${shortQueueId(order.id)} · ${maskPhone(order.destinationPhone)} · ${formatMoney(order.amountPaidCents, order.currency)} · ${order.bundleName} · ${order.failureCode?.replace(/_/g, " ") || order.fulfillmentStatus}`;
}

function shortQueueId(value: string) {
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

function ReconciliationResultBanner({ result }: { result: ReconciliationResult }) {
  return (
    <div className="rounded-md border bg-success-muted/40 p-4" role="status">
      <p className="text-sm font-medium text-foreground">
        Payment matched{result.idempotent ? " (already recorded)" : ""}
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <Fact label="Resolution" value={formatStatusLabel(result.resolutionType || "exact")} />
        <Fact
          label="Order fulfillment status"
          value={result.orderFulfillmentStatus ? formatStatusLabel(result.orderFulfillmentStatus) : "—"}
        />
        <Fact
          label="Order payment status"
          value={result.orderPaymentStatus ? formatStatusLabel(result.orderPaymentStatus) : "—"}
        />
      </dl>
      <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
        Audit {result.auditId || "—"}
      </p>
      <p className="mt-2 text-xs leading-5 text-foreground">{fulfillmentResultCopy(result.fulfillment)}</p>
    </div>
  );
}

function AuditList({
  entries,
}: {
  entries: ReconciliationContext["audit"];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">Reconciliation audit</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Who resolved a payment, which event and order, and why.
      </p>
      {entries.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No reconciliation audit records yet.</p>
      ) : (
        <div className="mt-3 overflow-auto rounded-md border">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">When</th>
                <th className="px-3 py-2.5 font-medium">Admin</th>
                <th className="px-3 py-2.5 font-medium">Event</th>
                <th className="px-3 py-2.5 font-medium">Order</th>
                <th className="px-3 py-2.5 font-medium">Resolution</th>
                <th className="px-3 py-2.5 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr className="border-b last:border-0" key={entry.id}>
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                    {formatTimestamp(entry.createdAt)}
                  </td>
                  <td className="px-3 py-3">{entry.adminEmail}</td>
                  <td className="px-3 py-3 font-mono">{shortId(entry.eventId)}</td>
                  <td className="px-3 py-3 font-mono">{shortId(entry.orderId)}</td>
                  <td className="px-3 py-3">{formatStatusLabel(entry.resolutionType)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{entry.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function shortId(value: string) {
  return value.length > 8 ? `${value.slice(0, 8)}…` : value || "—";
}

function CompactMetric({
  label,
  value,
  detail,
  tone,
  href,
  loading,
}: {
  label: string;
  value?: string;
  detail?: string;
  tone: "quiet" | "attention" | "critical";
  href: string;
  loading: boolean;
}) {
  const valueClass =
    tone === "critical" ? "text-critical" : tone === "attention" ? "text-warning" : "text-foreground";
  return (
    <Link
      href={href}
      className="rounded-md border bg-card px-3 py-2 transition-colors hover:border-primary/30"
    >
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold ${valueClass}`}>
        {loading ? "…" : (value ?? "—")}
      </p>
      {detail ? <p className="truncate text-[10px] text-muted-foreground">{detail}</p> : null}
    </Link>
  );
}

function SectionTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-medium transition-colors ${
        active
          ? "gradient-button text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background hover:text-foreground"
      }`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  );
}

function GatewayStatusBadge({ status }: { status: MerchantGatewayDevice["status"] }) {
  const classes =
    status === "ONLINE"
      ? "bg-success-muted text-success"
      : status === "DEGRADED"
        ? "bg-warning-muted text-warning"
        : status === "OFFLINE" || status === "REVOKED"
          ? "bg-critical-muted text-critical"
          : "bg-warning-muted text-warning";
  const dot =
    status === "ONLINE"
      ? "bg-success"
      : status === "DEGRADED"
        ? "bg-warning"
        : status === "UNKNOWN"
          ? "bg-warning"
          : "bg-critical";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${classes}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function StatusPill({
  value,
  kind,
}: {
  value: string;
  kind: "payment" | "fulfillment";
}) {
  const normalized = value.toUpperCase();
  const classes =
    normalized === "MATCHED" || normalized === "COMPLETED" || normalized === "PAYMENT_CONFIRMED"
      ? "bg-success-muted text-success"
      : normalized === "AMBIGUOUS" ||
          normalized === "FAILED" ||
          normalized === "UNCERTAIN" ||
          normalized === "ERROR" ||
          normalized === "UNKNOWN"
        ? "bg-critical-muted text-critical"
        : normalized === "MANUAL_REVIEW" || normalized === "PROCESSING" || normalized === "UNMATCHED"
          ? "bg-warning-muted text-warning"
          : "bg-neutral-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${classes}`}>
      {kind === "payment" && normalized === "MANUAL_REVIEW"
        ? "Manual review"
        : formatStatusLabel(value)}
    </span>
  );
}

function HistoryTone({ tone, label }: { tone: GatewayHistoryItem["tone"]; label: string }) {
  const classes =
    tone === "success"
      ? "bg-success-muted text-success"
      : tone === "warning"
        ? "bg-warning-muted text-warning"
        : tone === "critical"
          ? "bg-critical-muted text-critical"
          : "bg-neutral-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}

function CardSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-2" aria-label={label}>
      <div className="skeleton h-24 rounded-md" />
      <div className="skeleton h-24 rounded-md" />
    </div>
  );
}

function formatStatusLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function paymentOptionLabel(event: MerchantPaymentEvent) {
  return `${formatPaymentMethod(event.paymentMethod)} · ${event.payerMsisdn || "unknown payer"} · ${formatMoney(event.amountCents, event.currency)} · ${formatStatusLabel(event.status)}`;
}

function orderOptionLabel(order: BundleOrderSnapshot) {
  return `${order.bundleName} · ${order.payerPhone || "no payer"} · ${formatMoney(order.sellingPriceCents, order.currency)}`;
}
