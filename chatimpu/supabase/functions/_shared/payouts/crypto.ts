/**
 * Encryption for payout details (AES-256-GCM) and HMAC helpers. Uses WebCrypto only, so the
 * same code runs in Supabase Edge Functions (Deno) and in the Node test suite.
 *
 * PAYOUT_ENCRYPTION_KEY: 32 random bytes, base64. Generate with `openssl rand -base64 32`.
 * Rotating the key: add the new key as PAYOUT_ENCRYPTION_KEY and keep the old one as
 * PAYOUT_ENCRYPTION_KEY_V1 until every secret has been re-encrypted (key_version column).
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function keyBytes(base64Key: string) {
  if (!base64Key) throw new Error('PAYOUT_ENCRYPTION_KEY is not configured');
  const k = unb64(base64Key);
  if (k.length !== 32) throw new Error('PAYOUT_ENCRYPTION_KEY must be 32 bytes (base64)');
  return k;
}

export async function encryptJson(value: unknown, base64Key: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', keyBytes(base64Key), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decryptJson<T>(payload: string, base64Key: string): Promise<T> {
  const [v, iv, ct] = payload.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('Unsupported ciphertext format');
  const key = await crypto.subtle.importKey('raw', keyBytes(base64Key), 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct)); // throws if tampered
  return JSON.parse(dec.decode(pt)) as T;
}

export async function hmacHex(secret: string | Uint8Array<ArrayBuffer>, message: string): Promise<string> {
  const raw = typeof secret === 'string' ? enc.encode(secret) : secret;
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** Keyed fingerprint of normalised payout details (detects duplicates without storing them). */
export async function fingerprint(parts: string[], base64Key: string): Promise<string> {
  return hmacHex(keyBytes(base64Key), `fp|${parts.map((p) => p.trim().toLowerCase()).join('|')}`);
}

/** Constant-time comparison of two hex strings. */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** RazorpayX webhook signature: HMAC-SHA256(raw body, webhook secret), hex, in X-Razorpay-Signature. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature) return false;
  return safeEqual(await hmacHex(secret, rawBody), signature.trim());
}
