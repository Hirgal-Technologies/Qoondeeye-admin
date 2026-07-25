export type SyncHealthPoint = {
  date: string;
  successRate: number;
  avgQueueDepth: number;
  failures: number;
};

export type OcrSuccessPoint = {
  date: string;
  successRate: number;
  attempts: number;
};

export type SyncStatus = {
  lastEntryAt: string | null;
  working: boolean;
};

export type AlertTrendPoint = {
  date: string;
  total: number;
  high: number;
};

export type TableCountRow = {
  table: string;
  rows: number;
};

export type SystemErrorRow = {
  timestamp: string;
  errorType: string;
  message: string;
  priority: string;
  count: number;
};
