import Link from "next/link";
import { Download, LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { getAdminSession, hasRole } from "@/lib/auth/session";

const exports = [
  { name: "User signup trend", source: "users/signups" },
  { name: "Cohort retention", source: "users/cohort-retention" },
  { name: "Transaction volume", source: "finance/transaction-volume" },
  { name: "Expense categories", source: "finance/category-distribution" },
  { name: "System sync health", source: "system/sync-health" },
  { name: "Operational incidents", source: "system/errors" },
];

export default async function ExportsPage() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  if (!hasRole(identity, "admin")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          eyebrow="Restricted module"
          title="Data exports"
          description="Bulk data exports are limited to administrators."
        />
        <div className="rounded-lg border bg-card p-8 text-center">
          <LockKeyhole aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Administrator permission required</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            Your current role cannot start bulk exports. Contact an administrator if this access is needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Administrator tools"
        title="Data exports"
        description="Download approved, aggregate datasets. Per-user data is excluded from these export sources."
      />

      <div className="flex items-start gap-3 rounded-lg border bg-muted/35 p-4">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p className="text-xs leading-5 text-muted-foreground">
          Export only what is necessary for the stated business purpose. Sensitive export sources
          require an additional confirmation and audit event before release.
        </p>
      </div>

      <section className="rounded-lg border bg-card" aria-labelledby="export-list">
        <div className="border-b px-4 py-4 sm:px-5">
          <h2 id="export-list" className="text-sm font-semibold">Available aggregate exports</h2>
          <p className="mt-1 text-xs text-muted-foreground">CSV · current default date window</p>
        </div>
        <div className="divide-y">
          {exports.map((item) => (
            <div className="flex items-center gap-3 px-4 py-3 sm:px-5" key={item.source}>
              <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-muted/40">
                <Download aria-hidden="true" className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{item.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{item.source}</p>
              </div>
              <Link
                href={`/api/export/csv?source=${encodeURIComponent(item.source)}`}
                className="ml-auto inline-flex min-h-9 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
              >
                Export CSV
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
