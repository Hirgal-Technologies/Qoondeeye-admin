import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatePanel } from "@/components/states/StatePanel";
import { SupportLookup } from "@/components/dashboard/SupportLookup";

export function SupportPage({ hasSupportRole }: { hasSupportRole: boolean }) {
  if (!hasSupportRole) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          eyebrow="Restricted module"
          title="Support tools"
          description="Individual account lookup is limited to approved support and administrator roles."
        />
        <StatePanel
          kind="permission"
          title="Support permission required"
          description="Your current role cannot access individual account information. General analytics remain available."
        />
      </div>
    );
  }

  return <SupportLookup />;
}
