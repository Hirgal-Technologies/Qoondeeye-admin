export type SalaamReviewReason =
  | "missing_faahfaahin"
  | "invalid_destination"
  | "unmatched_amount";

export type SalaamReviewView = {
  id: string;
  status: "needs_review" | "claimed" | "resolved";
  reason: SalaamReviewReason;
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
  providerName: string | null;
  bundleName: string | null;
  destinationType: string | null;
  orderId: string | null;
  eventId: string;
  intendedMappingId: string | null;
  intendedProviderName: string | null;
  intendedBundleName: string | null;
  intendedPriceCents: number | null;
  priceDifferenceCents: number | null;
  resolutionType: "no_fulfillment" | null;
  resolutionNote: string | null;
  resolvedAt?: string | null;
};

const NO_FULFILLMENT_REASONS: readonly SalaamReviewReason[] = [
  "missing_faahfaahin",
  "invalid_destination",
  "unmatched_amount",
];

/** Claimed Faahfaahin and unmatched cases can be closed without buying a bundle. */
export function salaamShowsResolveWithoutFulfillment(row: {
  status: string;
  reason: string;
}): boolean {
  return (
    row.status === "claimed" &&
    NO_FULFILLMENT_REASONS.includes(row.reason as SalaamReviewReason)
  );
}

/** Note and confirmation are required, and the case must already be claimed. */
export function salaamCanResolveWithoutFulfillment(input: {
  status: string;
  reason: string;
  note: string;
  confirmed: boolean;
}): boolean {
  return (
    salaamShowsResolveWithoutFulfillment(input) &&
    input.confirmed === true &&
    input.note.trim().length > 0
  );
}

/** Destination confirm and no-fulfillment actions leave the screen once the case is closed. */
export function salaamShowsFulfillmentActions(row: { status: string }): boolean {
  return row.status !== "resolved";
}

export type PayableOfflineBundle = {
  id: string;
  providerName: string;
  bundleName: string;
  priceCents: number;
  destinationType: string;
};

export function formatSalaamUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function formatSalaamDifference(cents: number): string {
  if (cents > 0) return `+${formatSalaamUsd(cents)}`;
  return formatSalaamUsd(cents);
}

/** Received amount minus the selected bundle price. */
export function salaamPriceDifferenceCents(receivedCents: number, requiredCents: number): number {
  return receivedCents - requiredCents;
}

export function salaamReviewReasonText(reason: SalaamReviewReason): string {
  if (reason === "missing_faahfaahin") return "Faahfaahin is missing";
  if (reason === "invalid_destination") return "Faahfaahin is not valid";
  return "Amount does not match any Offline bundle";
}

export function salaamUnmatchedReviewLines(
  row: Pick<
    SalaamReviewView,
    | "amountCents"
    | "payerMsisdn"
    | "originalFaahfaahin"
    | "bankTicket"
    | "providerReference"
    | "receivedAt"
    | "status"
  >,
): string[] {
  return [
    "PAID - Salaam Bank",
    `Amount paid: ${formatSalaamUsd(row.amountCents)}`,
    `Payer: ${row.payerMsisdn}`,
    `Faahfaahin: ${row.originalFaahfaahin?.trim() || "Missing"}`,
    `Tix: ${row.bankTicket?.trim() || "Missing"}`,
    `Ref: ${row.providerReference?.trim() || "Missing"}`,
    `Received: ${row.receivedAt}`,
    "Reason: Amount does not match any Offline bundle",
    `Status: ${row.status}`,
    "The user has already paid.",
  ];
}

export function salaamBundleDifferenceLines(input: {
  receivedCents: number;
  providerName: string;
  bundleName: string;
  requiredCents: number;
}): string[] {
  const difference = salaamPriceDifferenceCents(input.receivedCents, input.requiredCents);
  return [
    `Received: ${formatSalaamUsd(input.receivedCents)}`,
    `Selected bundle: ${input.providerName} ${input.bundleName}`,
    `Required price: ${formatSalaamUsd(input.requiredCents)}`,
    `Difference: ${formatSalaamDifference(difference)}`,
  ];
}
