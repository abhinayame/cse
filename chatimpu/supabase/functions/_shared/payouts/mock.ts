/**
 * Mock payout provider for development and automated tests. NO MONEY MOVES.
 * Payout state lives in a caller-supplied store (the payouts Edge Function uses the
 * payment_transactions row) and only changes when a developer simulates an outcome,
 * which is delivered through the real, signature-checked webhook handler.
 * Disabled when APP_ENV=production.
 */
import type { CreatePayoutInput, PayoutDestination, PayoutProvider, ProviderPayout, ProviderPayoutStatus } from './types.ts';

export interface MockStore {
  get(id: string): Promise<{ status: ProviderPayoutStatus; amount: number; utr?: string | null; reason?: string | null; referenceId?: string | null } | null>;
}

const rid = (prefix: string) => `${prefix}_mock${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;

export class MockProvider implements PayoutProvider {
  readonly name = 'mock' as const;
  readonly mode = 'test' as const;
  constructor(private readonly store: MockStore) {}
  async createContact() { return rid('cont'); }
  async createFundAccount(_c: string, _d: PayoutDestination) { return rid('fa'); }
  async createPayout(input: CreatePayoutInput): Promise<ProviderPayout> {
    // deterministic id per idempotency key, like the real API returning the same payout on retry
    const id = `pout_mock${(await digest(input.idempotencyKey)).slice(0, 14)}`;
    return { id, status: 'processing', amount: input.amountPaise, utr: null, fees: 0, tax: 0, failureReason: null, referenceId: input.referenceId,
      raw: { id, entity: 'payout', status: 'processing', amount: input.amountPaise, mode: input.mode, reference_id: input.referenceId, mock: true } };
  }
  async fetchPayout(id: string): Promise<ProviderPayout> {
    const s = await this.store.get(id);
    if (!s) throw new Error(`Mock payout ${id} not found`);
    return { id, status: s.status, amount: s.amount, utr: s.utr ?? null, fees: 0, tax: 0, failureReason: s.reason ?? null, referenceId: s.referenceId ?? null,
      raw: { id, entity: 'payout', status: s.status, amount: s.amount, utr: s.utr ?? null, mock: true } };
  }
}

async function digest(s: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build a RazorpayX-shaped webhook payload (payload.payout.entity) for simulations and tests. */
export function mockWebhookPayload(event: string, payout: { id: string; amount: number; status: ProviderPayoutStatus; utr?: string | null; reason?: string | null; referenceId?: string | null }) {
  return {
    entity: 'event', account_id: 'acc_mock', event, contains: ['payout'], created_at: Math.floor(Date.now() / 1000),
    payload: { payout: { entity: {
      id: payout.id, entity: 'payout', amount: payout.amount, currency: 'INR', status: payout.status, utr: payout.utr ?? null,
      reference_id: payout.referenceId ?? null, fees: 0, tax: 0,
      status_details: payout.reason ? { description: payout.reason, source: 'beneficiary_bank', reason: 'mock' } : null,
    } } },
  };
}
