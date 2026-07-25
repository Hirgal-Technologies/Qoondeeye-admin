export type SupportTicketStatus = "open" | "pending" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export type SupportTicketRow = {
  id: number;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  requesterEmail: string;
  requesterUserId: string | null;
  assigneeId: string | null;
  assigneeEmail: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type CreateSupportTicketInput = {
  subject: string;
  description: string;
  priority: SupportTicketPriority;
  requesterEmail: string;
  requesterUserId?: string | null;
};

export type UpdateSupportTicketInput = {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assigneeId?: string | null;
};

export type AssignableAdmin = {
  id: string;
  email: string;
  role: string;
};
