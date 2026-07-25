export type AuditLogRow = {
  id: number;
  actorEmail: string;
  actorRole: string;
  action: string;
  resource: string;
  createdAt: string;
  outcome: string;
};
