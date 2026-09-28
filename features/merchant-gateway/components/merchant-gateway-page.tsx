"use client";

import {
  Bell,
  CircleAlert,
  ClipboardList,
  RefreshCw,
  Scale,
  ShieldAlert,
  Signal,
  Smartphone,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatTile } from "@/components/dashboard/StatTile";
import { StatePanel } from "@/components/states/StatePanel";
import type {
  BundleOrderSnapshot,
  GatewayHistory,
  GatewayHistoryItem,
  MerchantGatewayDevice,
  MerchantGatewaySummary,
  MerchantPaymentEvent,
  PaymentReviewFilter,
  ReconciliationContext,
  ReconciliationResult,
} from "@/features/merchant-gateway/contracts";
import {
  PAYMENT_REVIEW_FILTERS,
  buildReconcileRequest,
  canEnableConfirm,
  compareEventToOrder,
  formatBattery,
  formatCharging,
  formatMoney,
  formatNetwork,
  formatPaymentMethod,
  formatSim,
  formatTimestamp,
  fulfillmentResultCopy,
  gatewayHeadline,
  gatewayHeadlineIsCritical,
  inspectReconciliation,
  isOrderExpired,
  parseMerchantSection,
  parsePaymentReviewFilter,
  paymentFilterLabel,
  reconciliationErrorMessage,
  shouldRefreshReconciliation,
} from "@/features/merchant-gateway/presentation";
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
    summary.status === "success" ? summary.data.devices.length : 0;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="Operations"
        title="Merchant gateway"
        description="Review gateway health and merchant payments. Confirmation is sent to the backend. This dashboard does not call TopTayo."
        actions={
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
        }
      />

      <section aria-labelledby="merchant-summary">
        <h2 id="merchant-summary" className="sr-only">
          Merchant gateway summary
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            icon={Signal}
            label="Gateway status"
            value={counts ? gatewayHeadline(counts) : undefined}
            sublabel={
              counts
                ? `${formatInteger.format(gatewayCount)} ${gatewayCount === 1 ? "gateway" : "gateways"}`
                : undefined
            }
            status={counts && gatewayHeadlineIsCritical(counts) ? "critical" : "default"}
            href="/dashboard/merchant-gateway?section=gateways"
            isLoading={summary.status === "loading"}
            error={summary.status === "error" ? summary.error : null}
          />
          <StatTile
            icon={ClipboardList}
            label="Pending orders"
            value={counts ? formatInteger.format(counts.pendingOrders) : undefined}
            sublabel="Awaiting payment"
            href="/dashboard/merchant-gateway?section=reconciliation"
            isLoading={summary.status === "loading"}
            error={summary.status === "error" ? summary.error : null}
          />
          <StatTile
            icon={CircleAlert}
            label="Unmatched payments"
            value={counts ? formatInteger.format(counts.unmatchedPayments) : undefined}
            sublabel="No order attached"
            status={counts && counts.unmatchedPayments > 0 ? "critical" : "default"}
            href="/dashboard/merchant-gateway?section=payments&status=UNMATCHED"
            isLoading={summary.status === "loading"}
            error={summary.status === "error" ? summary.error : null}
          />
          <StatTile
            icon={Scale}
            label="Ambiguous payments"
            value={counts ? formatInteger.format(counts.ambiguousPayments) : undefined}
            sublabel="More than one possible order"
            status={counts && counts.ambiguousPayments > 0 ? "critical" : "default"}
            href="/dashboard/merchant-gateway?section=payments&status=AMBIGUOUS"
            isLoading={summary.status === "loading"}
            error={summary.status === "error" ? summary.error : null}
          />
          <StatTile
            icon={ShieldAlert}
            label="Manual review"
            value={counts ? formatInteger.format(counts.manualReviewPayments) : undefined}
            sublabel="Waiting for an operator"
            status={counts && counts.manualReviewPayments > 0 ? "critical" : "default"}
            href="/dashboard/merchant-gateway?section=payments&status=MANUAL_REVIEW"
            isLoading={summary.status === "loading"}
            error={summary.status === "error" ? summary.error : null}
          />
          <StatTile
            icon={TriangleAlert}
            label="Failed fulfillment"
            value={counts ? formatInteger.format(counts.failedFulfillment) : undefined}
            sublabel="Failed or uncertain bundle delivery"
            status={counts && counts.failedFulfillment > 0 ? "critical" : "default"}
            href="/dashboard/merchant-gateway?section=gateways#fulfillment"
            isLoading={summary.status === "loading"}
            error={summary.status === "error" ? summary.error : null}
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
      {section === "alerts" ? <AlertsPanel history={history} onRetry={history.retry} /> : null}
      {section === "reconciliation" ? (
        <ReconciliationPanel
          canReconcile={canReconcile}
          context={reconciliation}
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
}: {
  summary: ReturnType<typeof useApiData<MerchantGatewaySummary>>;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Gateway devices</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Live heartbeat, SIM detection, and the last message the gateway exchanged with the backend.
        </p>
        <div className="mt-4">
          {summary.status === "loading" ? <CardSkeleton /> : null}
          {summary.status === "error" ? (
            <StatePanel
              compact
              kind="error"
              title="Gateways could not be loaded"
              description={summary.error}
              actionLabel="Try again"
              onAction={onRetry}
            />
          ) : null}
          {summary.status === "success" && summary.data.devices.length === 0 ? (
            <StatePanel
              compact
              title="No merchant gateways"
              description="Enrolled gateway devices will appear here after the backend records them."
            />
          ) : null}
          {summary.status === "success" && summary.data.devices.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {summary.data.devices.map((device) => (
                <GatewayCard device={device} key={device.id} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section
        id="fulfillment"
        className="scroll-mt-24 rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
      >
        <h2 className="text-sm font-semibold text-foreground">Failed or uncertain fulfillment</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Bundle orders whose delivery failed, is uncertain, or recorded a failure after payment.
        </p>
        <div className="mt-4">
          {summary.status === "loading" ? <CardSkeleton /> : null}
          {summary.status === "error" ? (
            <StatePanel
              compact
              kind="error"
              title="Fulfillment status could not be loaded"
              description={summary.error}
              actionLabel="Try again"
              onAction={onRetry}
            />
          ) : null}
          {summary.status === "success" && summary.data.fulfillmentExceptions.length === 0 ? (
            <StatePanel
              compact
              title="No fulfillment exceptions"
              description="Paid orders with a failed or uncertain delivery will show up here."
            />
          ) : null}
          {summary.status === "success" && summary.data.fulfillmentExceptions.length > 0 ? (
            <div className="overflow-auto rounded-md border">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Bundle</th>
                    <th className="px-3 py-2.5 font-medium">Payment</th>
                    <th className="px-3 py-2.5 font-medium">Fulfillment</th>
                    <th className="px-3 py-2.5 font-medium">Failure</th>
                    <th className="px-3 py-2.5 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data.fulfillmentExceptions.map((order) => (
                    <tr className="border-b last:border-0" key={order.id}>
                      <td className="px-3 py-3 font-medium">{order.bundleName}</td>
                      <td className="px-3 py-3">{formatStatusLabel(order.paymentStatus)}</td>
                      <td className="px-3 py-3">
                        <StatusPill value={order.fulfillmentStatus} kind="fulfillment" />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {order.failureCode ? formatStatusLabel(order.failureCode) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                        {formatTimestamp(order.updatedAt)}
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

function GatewayCard({ device }: { device: MerchantGatewayDevice }) {
  return (
    <article className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{device.name}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            App {device.appVersion || "—"}
            {device.uploadFailures > 0
              ? ` · ${formatInteger.format(device.uploadFailures)} upload failures`
              : ""}
          </p>
        </div>
        <GatewayStatusBadge status={device.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <Fact label="Last heartbeat" value={formatTimestamp(device.lastHeartbeatAt)} />
        <Fact
          label="Battery"
          value={`${formatBattery(device.batteryPercent)} · ${formatCharging(device.isCharging)}`}
        />
        <Fact
          label="Network"
          value={formatNetwork(device.networkConnected, device.networkType)}
        />
        <Fact label="Last SMS" value={formatTimestamp(device.lastSmsReceivedAt)} />
        <div>
          <dt className="text-[11px] text-muted-foreground">EVC Plus SIM</dt>
          <dd className="mt-0.5">
            <SimState detected={device.evcSimDetected} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">eDahab SIM</dt>
          <dd className="mt-0.5">
            <SimState detected={device.edahabSimDetected} />
          </dd>
        </div>
        <Fact label="Last merchant event" value={formatTimestamp(device.lastMerchantEventAt)} />
        <Fact label="Last backend acknowledgement" value={formatTimestamp(device.lastBackendAckAt)} />
      </dl>
      {device.receiverMsisdns.length > 0 ? (
        <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
          Watching {device.receiverMsisdns.join(", ")}
        </p>
      ) : null}
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
            <div className="max-h-[36rem] overflow-auto rounded-md border">
              <table className="w-full min-w-[1080px] text-left text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Method</th>
                    <th className="px-3 py-2.5 font-medium">Payer</th>
                    <th className="px-3 py-2.5 font-medium">Amount</th>
                    <th className="px-3 py-2.5 font-medium">Merchant receiver</th>
                    <th className="px-3 py-2.5 font-medium">Gateway received</th>
                    <th className="px-3 py-2.5 font-medium">Provider time</th>
                    <th className="px-3 py-2.5 font-medium">Uploaded</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Matched order</th>
                    <th className="px-3 py-2.5 font-medium">Fulfillment</th>
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
                      <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">
                        {event.payerMsisdn || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium tabular-nums">
                        {formatMoney(event.amountCents, event.currency)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">
                        {event.merchantReceiverMsisdn || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                        {formatTimestamp(event.receivedAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                        {formatTimestamp(event.providerTimestamp)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                        {formatTimestamp(event.uploadedAt)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill value={event.status} kind="payment" />
                      </td>
                      <td className="max-w-40 truncate px-3 py-3">
                        {event.order?.bundleName ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        {event.order ? (
                          <StatusPill value={event.order.fulfillmentStatus} kind="fulfillment" />
                        ) : (
                          "—"
                        )}
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
        <Fact label="Provider reference" value={event.providerTxnId || "Not included in the SMS"} />
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
}: {
  history: ReturnType<typeof useApiData<GatewayHistory>>;
  onRetry: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <HistoryCard
        title="Gateway alerts"
        description="Offline, recovered, degraded, missing SIM, and any other gateway health alert already stored."
        items={history.status === "success" ? history.data.alerts : []}
        status={history.status}
        error={history.status === "error" ? history.error : null}
        emptyTitle="No gateway alerts"
        emptyDescription="Health alerts appear here when a gateway goes offline, recovers, degrades, or loses a SIM."
        onRetry={onRetry}
      />
      <HistoryCard
        title="Health transitions"
        description="Recorded status changes for each gateway."
        items={history.status === "success" ? history.data.transitions : []}
        status={history.status}
        error={history.status === "error" ? history.error : null}
        emptyTitle="No health transitions"
        emptyDescription="Status changes such as online to offline will be listed here."
        onRetry={onRetry}
      />
    </div>
  );
}

function HistoryCard({
  title,
  description,
  items,
  status,
  error,
  emptyTitle,
  emptyDescription,
  onRetry,
}: {
  title: string;
  description: string;
  items: GatewayHistoryItem[];
  status: "loading" | "error" | "success";
  error: string | null;
  emptyTitle: string;
  emptyDescription: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      <div className="mt-4">
        {status === "loading" ? <CardSkeleton /> : null}
        {status === "error" ? (
          <StatePanel
            compact
            kind="error"
            title={`${title} could not be loaded`}
            description={error ?? "Something went wrong."}
            actionLabel="Try again"
            onAction={onRetry}
          />
        ) : null}
        {status === "success" && items.length === 0 ? (
          <StatePanel compact title={emptyTitle} description={emptyDescription} />
        ) : null}
        {status === "success" && items.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <HistoryTone tone={item.tone} label={item.label} />
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
  onRetry,
  onRefresh,
}: {
  canReconcile: boolean;
  context: ReturnType<typeof useApiData<ReconciliationContext>>;
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
      <h2 className="text-sm font-semibold text-foreground">Manual reconciliation</h2>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
        Match one unresolved payment to one pending order. The backend rechecks the payment and
        records the admin who resolved it.
      </p>

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

function SimState({ detected }: { detected: boolean | null }) {
  const className =
    detected === true
      ? "font-medium text-success"
      : detected === false
        ? "font-medium text-critical"
        : "text-muted-foreground";
  return <span className={className}>{formatSim(detected)}</span>;
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
