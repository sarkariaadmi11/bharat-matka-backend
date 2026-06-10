export type ApiResponse<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
};

export type InitiateUpiDepositRequest = {
  amount: number;
};

export type UpiIntentFields = {
  pa: string;
  pn: string;
  tr: string;
  tn: string;
  am: string;
  cu: string;
  url: string;
  upiUrl: string;
};

export type InitiateUpiDepositResponse = ApiResponse<{
  depositId: string;
  amount: number;
  currency: string;
  merchantTxnId: string;
  upi: UpiIntentFields;
}>;

export type SubmitUpiCallbackRequest = {
  depositId: string;
  statusFromClient: 'SUCCESS' | 'FAILED' | 'PENDING' | 'SUBMITTED' | string;
  txnRef?: string;
  approvalRefNo?: string;
  transactionId?: string;
  responseCode?: string;
  rawResponse?: unknown;
};

export type DepositStatusData = {
  depositId: string;
  amount: number; // INR
  currency: string;
  merchantTxnId: string;
  status: 'pending' | 'submitted' | 'verifying' | 'manual_review' | 'success' | 'failed';
  verificationStatus: 'pending' | 'submitted' | 'verifying' | 'verified' | 'manual_review' | 'failed';
  clientStatus: string | null;
  credited: boolean;
  alreadyProcessed: boolean;
  walletBalance: number | null;
  message: string;
  createdAt: string;
  updatedAt: string;
  creditedAt: string | null;
  failedAt: string | null;
};

export type SubmitUpiCallbackResponse = ApiResponse<DepositStatusData>;

export type GetUpiDepositStatusResponse = ApiResponse<DepositStatusData>;

/**
 * Frontend integration notes:
 * - Use POST /payments/deposits/upi-callback when the app resumes after deep linking.
 * - If data.status === 'success', update the wallet from data.walletBalance.
 * - If data.alreadyProcessed === true and status === 'success', treat it as a final success state.
 * - If status is 'submitted' or 'verifying', poll GET /payments/deposits/:depositId/status.
 * - amount is expressed in INR.
 * - walletBalance is expressed in rupee.
 */
