"use client";

import { useMemo, useState } from "react";
import type { MerchantGatewayDevice } from "@/features/merchant-gateway/contracts";
import {
  cleanupPreviewKey,
  type PreproductionCleanupPreview,
} from "@/features/merchant-gateway/preproduction-cleanup";

export function PreproductionCleanupPanel({
  devices,
  onApplied,
}: {
  devices: MerchantGatewayDevice[];
  onApplied: () => void;
}) {
  const preferred = useMemo(() => {
    const live = devices.find((device) => device.status === "ONLINE" || device.status === "DEGRADED");
    const named = devices.find((device) => /galaxy/i.test(device.name));
    return live?.id ?? named?.id ?? "";
  }, [devices]);
  const [protectedDeviceId, setProtectedDeviceId] = useState(preferred);
  const [cutoffLocal, setCutoffLocal] = useState("");
  const [reason, setReason] = useState(
    "Testers confirmed historical bundle purchases were delivered before production.",
  );
  const [preview, setPreview] = useState<PreproductionCleanupPreview | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

  const selected = protectedDeviceId || preferred;
  const requestKey = cleanupPreviewKey({
    cutoffAt: cutoffLocal,
    protectedDeviceId: selected,
    reason: reason.trim(),
  });
  const canApply = preview != null && preview.dryRun && previewKey === requestKey && busy == null;

  async function submit(apply: boolean) {
    setBusy(apply ? "apply" : "preview");
    setError(null);
    try {
      const cutoffAt = cutoffLocal ? new Date(cutoffLocal).toISOString() : "";
      const response = await fetch("/api/merchant-gateway/preproduction-cleanup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cutoffAt,
          protectedDeviceId: selected,
          reason,
          apply,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: PreproductionCleanupPreview;
        error?: string | null;
      } | null;
      if (!response.ok || !payload?.data) {
        setError(payload?.error || "The cleanup preview could not be loaded.");
        if (apply) setPreview(null);
        return;
      }
      setPreview(payload.data);
      setPreviewKey(requestKey);
      if (apply) onApplied();
    } catch {
      setError("Qoondeeye could not be reached. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <details className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)]">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Pre-production cleanup
      </summary>
      <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
        Archives verified testing records from before the cutoff and revokes obsolete offline registrations.
        The protected device is never revoked. Payment status, fulfillment status, and transaction ids stay as stored.
        This does not send a TopTayo recharge.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Production started
          <input
            type="datetime-local"
            value={cutoffLocal}
            onChange={(event) => {
              setCutoffLocal(event.target.value);
              setPreview(null);
            }}
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Protected production device
          <select
            value={selected}
            onChange={(event) => {
              setProtectedDeviceId(event.target.value);
              setPreview(null);
            }}
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
          >
            <option value="">Choose a device</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} · {device.status} · {device.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-xs text-muted-foreground">
        Reason
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setPreview(null);
          }}
          rows={2}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void submit(false)}
          className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium disabled:opacity-50"
        >
          {busy === "preview" ? "Checking…" : "Dry-run preview"}
        </button>
        <button
          type="button"
          disabled={!canApply}
          onClick={() => void submit(true)}
          className="inline-flex h-9 items-center rounded-md border border-primary/40 px-3 text-xs font-medium text-primary disabled:opacity-50"
        >
          {busy === "apply" ? "Archiving…" : "Archive verified records"}
        </button>
      </div>
      {error ? <p className="mt-3 text-xs text-critical">{error}</p> : null}
      {preview ? <CleanupCounts preview={preview} /> : null}
    </details>
  );
}

function CleanupCounts({ preview }: { preview: PreproductionCleanupPreview }) {
  const rows: Array<[string, number]> = [
    ["Orders to archive", preview.counts.ordersToArchive],
    ["Payments to archive", preview.counts.paymentsToArchive],
    ["Gateway alerts to archive", preview.counts.gatewayAlertsToArchive],
    ["Fulfillment alerts to archive", preview.counts.fulfillmentAlertsToArchive],
    ["Devices to revoke", preview.counts.devicesToRevoke],
    ["Orders left on the live board", preview.counts.blockedOrders],
  ];
  return (
    <div className="mt-3 rounded-md border bg-background p-3">
      <p className="text-xs font-medium text-foreground">
        {preview.dryRun ? "Dry run. Nothing has been changed." : "Archive applied. Live counts exclude these records."}
      </p>
      {preview.applied ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Archived {preview.applied.ordersArchived} orders, {preview.applied.paymentsArchived} payments,{" "}
          {preview.applied.gatewayAlertsArchived + preview.applied.fulfillmentAlertsArchived} alerts, and revoked{" "}
          {preview.applied.devicesRevoked} devices.
        </p>
      ) : null}
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {preview.revokeDevices.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {preview.revokeDevices.map((device) => (
            <li key={device.id}>
              Revoke {device.name} ({device.id})
            </li>
          ))}
        </ul>
      ) : null}
      {preview.truncated ? (
        <p className="mt-2 text-xs text-warning">
          This preview covers the first 500 rows in a category. Run it again after applying to archive the rest.
        </p>
      ) : null}
      <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-5 text-muted-foreground">
        {preview.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
