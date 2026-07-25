import { AdminUsersManager } from "@/components/dashboard/AdminUsersManager";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatePanel } from "@/components/states/StatePanel";

type AdminUsersPageProps = {
  isAdmin: boolean;
  currentUserId: string;
};

export function AdminUsersPage({ isAdmin, currentUserId }: AdminUsersPageProps) {
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          eyebrow="Restricted module"
          title="Admin users"
          description="Dashboard access management is limited to administrators."
        />
        <StatePanel
          kind="permission"
          title="Administrator permission required"
          description="Your current role cannot view or manage the admin user roster."
        />
      </div>
    );
  }

  return <AdminUsersManager currentUserId={currentUserId} />;
}
