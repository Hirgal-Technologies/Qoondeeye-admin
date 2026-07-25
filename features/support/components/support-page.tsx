"use client";

import { Headphones, Ticket } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatePanel } from "@/components/states/StatePanel";
import { SupportLookup } from "@/components/dashboard/SupportLookup";
import { SupportTicketsPanel } from "@/components/dashboard/SupportTicketsPanel";

type Tab = "lookup" | "tickets";

export function SupportPage({ hasSupportRole }: { hasSupportRole: boolean }) {
  const [tab, setTab] = useState<Tab>("tickets");

  if (!hasSupportRole) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          eyebrow="Restricted module"
          title="Support tools"
          description="Support tickets and individual account lookup are limited to approved support and administrator roles."
        />
        <StatePanel
          kind="permission"
          title="Support permission required"
          description="Your current role cannot access support tools. General analytics remain available."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 border-b">
        <TabButton icon={Ticket} label="Tickets" active={tab === "tickets"} onClick={() => setTab("tickets")} />
        <TabButton
          icon={Headphones}
          label="Account lookup"
          active={tab === "lookup"}
          onClick={() => setTab("lookup")}
        />
      </div>

      {tab === "tickets" ? <SupportTicketsPanel /> : <SupportLookup />}
    </div>
  );
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Ticket;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
