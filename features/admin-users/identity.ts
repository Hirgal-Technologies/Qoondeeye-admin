/**
 * Human-readable label for an admin id already stored on a record.
 * The stored id stays the audit and authorization value.
 */

export type AdminIdentitySource = {
  id: string;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
};

export function textIdentity(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function firstIdentity(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const text = textIdentity(value);
    if (text) return text;
  }
  return null;
}

/** Profile name, then auth metadata, then the admin roster email. */
export function adminIdentityFromRecord(input: {
  id: string;
  profileFullName?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown> | null;
}): AdminIdentitySource {
  const metadata = input.metadata ?? {};
  return {
    id: input.id,
    fullName: firstIdentity(
      input.profileFullName,
      textIdentity(metadata.full_name),
      textIdentity(metadata.display_name),
      textIdentity(metadata.name),
    ),
    username: firstIdentity(
      textIdentity(metadata.username),
      textIdentity(metadata.preferred_username),
      textIdentity(metadata.user_name),
    ),
    email: firstIdentity(input.email, textIdentity(metadata.email)),
  };
}

export function adminIdentityLabel(
  source: AdminIdentitySource | null | undefined,
): string {
  if (!source?.id?.trim()) return "Unknown admin";
  return (
    firstIdentity(source.fullName) ??
    firstIdentity(source.username) ??
    firstIdentity(source.email) ??
    source.id
  );
}

export function salaamAdminDisplayName(
  adminId: string | null,
  identities: ReadonlyMap<string, AdminIdentitySource>,
): string | null {
  if (!adminId) return null;
  const source = identities.get(adminId);
  if (!source) return adminId;
  return adminIdentityLabel({ ...source, id: adminId });
}

export function withSalaamAdminNames<
  T extends { claimedBy: string | null; resolvedBy: string | null },
>(
  row: T,
  identities: ReadonlyMap<string, AdminIdentitySource>,
): T & { claimedByName: string | null; resolvedByName: string | null } {
  return {
    ...row,
    claimedBy: row.claimedBy,
    resolvedBy: row.resolvedBy,
    claimedByName: salaamAdminDisplayName(row.claimedBy, identities),
    resolvedByName: salaamAdminDisplayName(row.resolvedBy, identities),
  };
}

export function salaamReviewActorLines(row: {
  claimedBy: string | null;
  claimedByName?: string | null;
  resolvedBy: string | null;
  resolvedByName?: string | null;
}): string[] {
  const lines: string[] = [];
  if (row.claimedBy) {
    lines.push(`Claimed by: ${row.claimedByName?.trim() || row.claimedBy}`);
  }
  if (row.resolvedBy) {
    lines.push(`Resolved by: ${row.resolvedByName?.trim() || row.resolvedBy}`);
  }
  return lines;
}
