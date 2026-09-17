export type ResellerProvider = {
  id: string;
  name: string;
  image: string;
  description: string;
};

export type ResellerCategory = {
  id: string;
  name: string;
  description: string;
  provider?: ResellerProvider;
};

export type ResellerBundle = {
  id: string;
  name: string;
  amount: string;
  sms: string | null;
  minutes: number | null;
  minutesInt: number | null;
  dataGb: string | null;
  dataMb: string | null;
  validity: number;
  validityType: string;
  description: string;
  category?: ResellerCategory;
};

export type ResellerTransactionBundle = {
  id: string;
  name: string;
  minutes: number | null;
  minutesInt: number | null;
  sms: string | null;
  dataGb: string | null;
  dataMb: string | null;
  validity: number;
  validityType: string;
  category: {
    id: string;
    name: string;
    provider: {
      id: string;
      name: string;
    };
  };
};

export type ResellerTransaction = {
  id: string;
  sender: number;
  receiver: number;
  amount: string;
  status: string;
  createdAt: string;
  bundle: ResellerTransactionBundle;
};

export type ResellerBusiness = {
  id: string;
  name: string;
  mobile: number;
  email: string;
  address: string;
  balance: string;
  createdAt: string;
};

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};

export type CursorListParams = {
  q?: string;
  cursor?: string;
  limit?: number;
};

export type RechargeInput = {
  sender: number;
  receiver: number;
  bundleId: string;
};

export type RechargeResult = {
  message: string;
  transactionIds: string[];
};
