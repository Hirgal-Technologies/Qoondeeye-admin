import Link from "next/link";
import {
  Activity,
  ArrowRight,
  FileBarChart,
  Users,
  WalletCards,
} from "lucide-react";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatePanel } from "@/components/states/StatePanel";

const reports = [
  {
    title: "Growth and retention",
    description: "Registration, active-user, churn, and cohort-retention metrics.",
    href: "/dashboard/users",
    icon: Users,
  },
  {
    title: "Financial activity",
    description: "Aggregated volume, budgets, categories, subscriptions, and accounts.",
    href: "/dashboard/finance",
    icon: WalletCards,
  },
  {
    title: "Operational health",
    description: "Synchronization, OCR, incident, latency, and storage readiness.",
    href: "/dashboard/system",
    icon: Activity,
  },
];

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Reporting"
        title="Reports"
        description="Open a standard report or review saved report definitions for recurring analysis."
      />

      <section aria-labelledby="available-reports">
        <h2 id="available-reports" className="mb-3 text-sm font-semibold">
          Available report types
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {reports.map((report) => {
            const Icon = report.icon;
            return (
              <Link
                href={report.href}
                key={report.title}
                className="group rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-accent"
              >
                <span className="grid size-9 place-items-center rounded-md border bg-background">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{report.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{report.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium">
                  Open report
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 sm:p-5" aria-labelledby="saved-reports">
        <div className="flex items-center gap-2">
          <FileBarChart aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="saved-reports" className="text-sm font-semibold">Saved reports</h2>
        </div>
        <div className="mt-4">
          <StatePanel
            compact
            title="No saved reports"
            description="Saved report scheduling is not configured yet. Standard reports remain available above."
          />
        </div>
      </section>
    </div>
  );
}
