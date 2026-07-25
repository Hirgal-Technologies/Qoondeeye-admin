import { Bell, LockKeyhole, MonitorCog, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/dashboard/PageHeading";
import type { AdminIdentity } from "@/features/auth/contracts";

export function SettingsPage({ identity }: { identity: AdminIdentity }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Workspace"
        title="Settings"
        description="Review your access, security posture, appearance, and notification readiness."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Admin access</h2>
          </div>
          <dl className="mt-4 divide-y rounded-md border">
            <SettingRow label="Signed in as" value={identity.email} />
            <SettingRow label="Assigned role" value={`${identity.role} access`} />
            <SettingRow label="Session security" value="Supabase verified" />
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <MonitorCog aria-hidden="true" className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Appearance</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use the theme control in the dashboard header to switch between the neutral light and
            true-black dark themes. Your preference is stored on this device.
          </p>
        </section>

        <section className="rounded-lg border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Bell aria-hidden="true" className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Notifications</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Operational notification delivery is not configured. In-dashboard telemetry notices
            remain available from the header.
          </p>
        </section>

        <section className="rounded-lg border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <LockKeyhole aria-hidden="true" className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Security</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Roles are managed server-side in the admin roster. Contact an administrator to request
            an access change.
          </p>
        </section>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-3 py-3 sm:grid-cols-[120px_1fr]">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="break-all text-xs font-medium capitalize">{value}</dd>
    </div>
  );
}
