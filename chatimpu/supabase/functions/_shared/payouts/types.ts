/** Provider-neutral payout types. Amounts are always integer paise. */
export type PayoutDestination =
  | { kind: 'upi'; vpa: string; name: string }
  | { kind: 'bank'; accountNumber: string; ifsc: string; name: string };

/** RazorpayX payout states (docs: payouts/states-life-cycle). */
export type ProviderPayoutStatus = 'queued' | 'pending' | 'scheduled' | 'processing' | 'processed' | 'reversed' | 'cancelled' | 'rejected' | 'failed';
export const TERMINAL_FAILURES: ProviderPayoutStatus[] = ['reversed', 'cancelled', 'rejected', 'failed'];

export interface ProviderPayout {
  id: string;
  status: ProviderPayoutStatus;
  amount: number;
  utr: string | null;
  fees: number | null;
  tax: number | null;
  failureReason: string | null;
  referenceId: string | null;
  raw: Record<string, unknown>;
}

export interface CreatePayoutInput {
  idempotencyKey: string;
  fundAccountId: string;
  amountPaise: number;
  mode: 'UPI' | 'IMPS' | 'NEFT';
  referenceId: string; // ≤ 40 chars
  narration: string; // ≤ 30 chars, letters/digits/spaces
  notes?: Record<string, string>;
}

export interface PayoutProvider {
  readonly name: 'razorpayx' | 'mock';
  readonly mode: 'test' | 'live';
  createContact(input: { name: string; referenceId: string; email?: string | null; phone?: string | null }): Promise<string>;
  createFundAccount(contactId: string, dest: PayoutDestination): Promise<string>;
  createPayout(input: CreatePayoutInput): Promise<ProviderPayout>;
  fetchPayout(id: string): Promise<ProviderPayout>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status: number, readonly retryable: boolean, readonly body?: unknown) { super(message); }
}
