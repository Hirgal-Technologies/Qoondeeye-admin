import { redirect } from "next/navigation";
import { AuditLogTable } from "@/components/dashboard/AuditLogTable";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatePanel } from "@/components/states/StatePanel";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export default async function AuditPage() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  if (!hasRole(identity, "admin")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          eyebrow="Restricted module"
          title="Audit logs"
          description="Security audit history is limited to administrators."
        />
        <StatePanel
          kind="permission"
          title="Administrator permission required"
          description="Your current role cannot view recorded admin and support access events."
        />
      </div>
    );
  }

  return <AuditLogTable />;
}
