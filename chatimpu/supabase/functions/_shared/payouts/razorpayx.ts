/**
 * RazorpayX Payouts client (server-side only). Follows https://razorpay.com/docs/api/x/payouts/
 *  - Basic auth key_id:key_secret, base https://api.razorpay.com/v1
 *  - POST /contacts, POST /fund_accounts (bank_account | vpa), POST /payouts, GET /payouts/:id
 *  - X-Payout-Idempotency header is mandatory for payouts (since 15 Mar 2025). Retries of the same
 *    payout MUST reuse the same key; never retry a payout still `processing` with a new key.
 *  - account_number is YOUR RazorpayX business account (Customer Identifier), different in test/live.
 *  - Live mode requires the server's outbound IPs to be allowlisted in the RazorpayX dashboard.
 */
import { ProviderError, type CreatePayoutInput, type PayoutDestination, type PayoutProvider, type ProviderPayout } from './types.ts';

export interface RazorpayXConfig {
  keyId: string;
  keySecret: string;
  accountNumber: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function toProviderPayout(p: Record<string, any>): ProviderPayout {
  return {
    id: String(p.id),
    status: p.status,
    amount: Number(p.amount),
    utr: p.utr ?? null,
    fees: typeof p.fees === 'number' ? p.fees : null,
    tax: typeof p.tax === 'number' ? p.tax : null,
    failureReason: p.status_details?.description ?? p.failure_reason ?? null,
    referenceId: p.reference_id ?? null,
    raw: sanitize(p),
  };
}

/** Strip anything that could carry account details before storing provider responses. */
export function sanitize(p: Record<string, any>): Record<string, unknown> {
  const { fund_account, ...rest } = p ?? {};
  return { ...rest, fund_account_id: p?.fund_account_id ?? fund_account?.id ?? null };
}

export class RazorpayX implements PayoutProvider {
  readonly name = 'razorpayx' as const;
  readonly mode: 'test' | 'live';
  private readonly base: string;
  private readonly f: typeof fetch;

  constructor(private readonly cfg: RazorpayXConfig) {
    if (!cfg.keyId || !cfg.keySecret || !cfg.accountNumber) throw new Error('RazorpayX credentials are not configured');
    this.mode = cfg.keyId.startsWith('rzp_live_') ? 'live' : 'test';
    this.base = (cfg.baseUrl ?? 'https://api.razorpay.com/v1').replace(/\/$/, '');
    this.f = cfg.fetchImpl ?? fetch;
  }

  private async call(method: 'GET' | 'POST', path: string, body?: unknown, headers: Record<string, string> = {}) {
    let res: Response;
    try {
      res = await this.f(`${this.base}${path}`, {
        method,
        headers: { Authorization: `Basic ${btoa(`${this.cfg.keyId}:${this.cfg.keySecret}`)}`, 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new ProviderError(`RazorpayX unreachable: ${(e as Error).message}`, 0, true);
    }
    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON error page */ }
    if (!res.ok) {
      const d = json?.error?.description ?? `HTTP ${res.status}`;
      throw new ProviderError(`RazorpayX: ${d}`, res.status, res.status >= 500 || res.status === 429, json?.error);
    }
    return json;
  }

  async createContact(input: { name: string; referenceId: string; email?: string | null; phone?: string | null }) {
    const c = await this.call('POST', '/contacts', {
      name: input.name.slice(0, 50), type: 'vendor', reference_id: input.referenceId.slice(0, 40),
      ...(input.email ? { email: input.email } : {}), ...(input.phone ? { contact: input.phone } : {}),
      notes: { platform: 'chatimpu-reporter' },
    });
    return String(c.id);
  }

  async createFundAccount(contactId: string, dest: PayoutDestination) {
    const body = dest.kind === 'upi'
      ? { contact_id: contactId, account_type: 'vpa', vpa: { address: dest.vpa } }
      : { contact_id: contactId, account_type: 'bank_account', bank_account: { name: dest.name, ifsc: dest.ifsc, account_number: dest.accountNumber } };
    const fa = await this.call('POST', '/fund_accounts', body);
    return String(fa.id);
  }

  async createPayout(input: CreatePayoutInput) {
    if (!input.idempotencyKey) throw new Error('Idempotency key is mandatory for payouts');
    if (input.amountPaise < 100) throw new Error('Minimum payout is 100 paise');
    const p = await this.call('POST', '/payouts', {
      account_number: this.cfg.accountNumber,
      fund_account_id: input.fundAccountId,
      amount: input.amountPaise,
      currency: 'INR',
      mode: input.mode,
      purpose: 'payout',
      queue_if_low_balance: true,
      reference_id: input.referenceId.slice(0, 40),
      narration: input.narration.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 30),
      notes: input.notes ?? {},
    }, { 'X-Payout-Idempotency': input.idempotencyKey });
    return toProviderPayout(p);
  }

  async fetchPayout(id: string) {
    return toProviderPayout(await this.call('GET', `/payouts/${encodeURIComponent(id)}`));
  }
}
