/**
 * Local Supabase-style gateway for end-to-end tests (dev only, never deployed):
 *   /auth/v1 → GoTrue, /rest/v1 → PostgREST,
 *   /storage/v1 → file storage on disk whose permissions are decided by the REAL storage.objects RLS policies
 *                 (via dev_storage_* SQL helpers executed with the caller's JWT),
 *   /functions/v1/<name> → the REAL Edge Function code (supabase/functions/<name>/index.ts) under a tiny Deno shim,
 *   everything else → the CMS / reporter portal build (SPA).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const DIST = process.argv[2];
const FUNCS = fileURLToPath(new URL('../../functions', import.meta.url));
const STORE = process.env.STORAGE_DIR ?? path.join(os.tmpdir(), 'chatimpu-storage');
const PORT = 8090;
const keys = { anon: process.env.SUPABASE_ANON_KEY ?? '', service: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '' };
if (!keys.anon || !keys.service || !DIST) throw new Error('Usage: SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… tsx gateway.mts <admin dist dir>');
const GOTRUE = Number(process.env.GOTRUE_PORT ?? 9999), REST = Number(process.env.POSTGREST_PORT ?? 3000);
const SIGN_SECRET = crypto.randomBytes(32);

const ENV: Record<string, string> = {
  SUPABASE_URL: `http://127.0.0.1:${PORT}`, SUPABASE_ANON_KEY: keys.anon, SUPABASE_SERVICE_ROLE_KEY: keys.service,
  PAYOUT_PROVIDER: 'mock', APP_ENV: 'development', RAZORPAYX_WEBHOOK_SECRET: 'whsec_local_e2e', CRON_SECRET: process.env.CRON_SECRET ?? 'local-cron-secret-123456',
  PAYOUT_ENCRYPTION_KEY: Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 7 + 3) % 256)).toString('base64'),
};
const handlers: Record<string, (r: Request) => Promise<Response> | Response> = {};
let loading = '';
(globalThis as unknown as { Deno: unknown }).Deno = {
  env: { get: (k: string) => ENV[k] ?? process.env[k] },
  serve: (h: (r: Request) => Promise<Response>) => { handlers[loading] = h; },
};
for (const name of ['payout-methods', 'payouts', 'razorpayx-webhook', 'notify-dispatch', 'maintenance', 'intake']) { loading = name; await import(path.join(FUNCS, name, 'index.ts')); }

const rest = async (fn: string, token: string, body: unknown) => {
  const r = await fetch(`http://127.0.0.1:${REST}/rpc/${fn}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json().catch(() => null) };
};
const bucketPublic = async (b: string) => {
  const r = await fetch(`http://127.0.0.1:${REST}/rpc/dev_bucket_public`, { method: 'POST', headers: { Authorization: `Bearer ${keys.service}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_bucket: b }) });
  return (await r.json()) === true;
};
const tokenOf = (req: http.IncomingMessage) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || keys.anon;
const sendJson = (res: http.ServerResponse, status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)); };
const readBody = (req: http.IncomingMessage) => new Promise<Buffer>((ok) => { const c: Buffer[] = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });
const filePath = (bucket: string, name: string) => { const p = path.join(STORE, bucket, name); if (!p.startsWith(path.join(STORE, bucket) + path.sep)) throw new Error('bad path'); return p; };
const serveFile = (res: http.ServerResponse, bucket: string, name: string) => {
  const p = filePath(bucket, name);
  if (!fs.existsSync(p)) return sendJson(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' });
  const type = fs.existsSync(p + '.__type') ? fs.readFileSync(p + '.__type', 'utf8') : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'access-control-allow-origin': '*', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(res);
};
const sign = (bucket: string, name: string, exp: number) => crypto.createHmac('sha256', SIGN_SECRET).update(`${bucket}/${name}:${exp}`).digest('base64url');

async function storage(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ''));
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^\/object\/public\/([^/]+)\/(.+)$/)) && req.method === 'GET') {
    return (await bucketPublic(m[1])) ? serveFile(res, m[1], m[2]) : sendJson(res, 400, { error: 'Bucket not public' });
  }
  if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'GET') {
    const [exp, sig] = (url.searchParams.get('token') ?? '').split('.');
    if (!exp || Number(exp) < Date.now() / 1000 || sig !== sign(m[1], m[2], Number(exp))) return sendJson(res, 400, { error: 'InvalidJWT', message: 'Invalid or expired signature' });
    return serveFile(res, m[1], m[2]);
  }
  if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'POST') {
    const { expiresIn } = JSON.parse((await readBody(req)).toString() || '{}');
    const can = await rest('dev_storage_can_read', tokenOf(req), { p_bucket: m[1], p_name: m[2] });
    if (can.data !== true) return sendJson(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    const exp = Math.floor(Date.now() / 1000) + Number(expiresIn || 60);
    return sendJson(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2].split('/').map(encodeURIComponent).join('/')}?token=${exp}.${sign(m[1], m[2], exp)}` });
  }
  if ((m = p.match(/^\/object\/([^/]+)\/(.+)$/)) && (req.method === 'POST' || req.method === 'PUT')) {
    let body = await readBody(req);
    let ctype = String(req.headers['content-type'] ?? 'application/octet-stream');
    if (ctype.startsWith('multipart/form-data')) {
      // supabase-js sends Blob/File uploads as multipart; keep only the file part (as Storage does).
      const form = await new Request('http://x', { method: 'POST', headers: { 'content-type': ctype }, body }).formData();
      const file = [...form.values()].find((v) => typeof v !== 'string') as File | undefined;
      if (!file) return sendJson(res, 400, { error: 'No file in form data' });
      body = Buffer.from(await file.arrayBuffer()); ctype = file.type || 'application/octet-stream';
    }
    if (body.length > 100 * 1024 * 1024) return sendJson(res, 413, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
    const r = await rest('dev_storage_insert', tokenOf(req), { p_bucket: m[1], p_name: m[2] });
    if (!r.ok) return sendJson(res, 403, { statusCode: '403', error: 'Unauthorized', message: (r.data as { message?: string })?.message?.includes('duplicate') ? 'The resource already exists' : 'new row violates row-level security policy' });
    const f = filePath(m[1], m[2]); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body); fs.writeFileSync(f + '.__type', ctype);
    return sendJson(res, 200, { Key: `${m[1]}/${m[2]}`, Id: crypto.randomUUID() });
  }
  if ((m = p.match(/^\/object\/([^/]+)\/(.+)$/)) && req.method === 'GET') {
    const can = await rest('dev_storage_can_read', tokenOf(req), { p_bucket: m[1], p_name: m[2] });
    return can.data === true ? serveFile(res, m[1], m[2]) : sendJson(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
  }
  if ((m = p.match(/^\/object\/([^/]+)$/)) && req.method === 'DELETE') {
    const { prefixes } = JSON.parse((await readBody(req)).toString() || '{}');
    const r = await rest('dev_storage_delete', tokenOf(req), { p_bucket: m[1], p_names: prefixes ?? [] });
    for (const n of (r.data as string[] | null) ?? []) { try { fs.rmSync(filePath(m[1], n)); fs.rmSync(filePath(m[1], n) + '.__type'); } catch { /* gone */ } }
    return sendJson(res, 200, ((r.data as string[] | null) ?? []).map((name) => ({ name })));
  }
  sendJson(res, 404, { error: `storage route not implemented: ${req.method} ${p}` });
}

async function functions(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const name = url.pathname.split('/')[3];
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }); return res.end(); }
  const h = handlers[name];
  if (!h) return sendJson(res, 503, { error: name === 'ai-assist' ? 'AI assistant is not configured in the local test stack (needs ANTHROPIC_API_KEY)' : `Function ${name} not available locally` });
  const body = await readBody(req);
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const r = await h(new Request(`http://127.0.0.1:${PORT}${url.pathname}`, { method: req.method, headers, body: req.method === 'GET' ? undefined : body }));
  const out: Record<string, string> = { 'access-control-allow-origin': '*' }; r.headers.forEach((v, k) => { out[k] = v; });
  res.writeHead(r.status, out); res.end(Buffer.from(await r.arrayBuffer()));
}

const routes: [string, number][] = [['/auth/v1', GOTRUE], ['/rest/v1', REST]];
const types: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
    if (req.method === 'OPTIONS' && (url.pathname.startsWith('/storage/') || url.pathname.startsWith('/functions/'))) {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' }); return res.end();
    }
    const hit = routes.find(([p]) => url.pathname === p || url.pathname.startsWith(p + '/'));
    if (hit) {
      const up = http.request({ host: '127.0.0.1', port: hit[1], path: (req.url ?? '').slice(hit[0].length) || '/', method: req.method, headers: { ...req.headers, host: `127.0.0.1:${hit[1]}` } }, (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); });
      up.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
      return void req.pipe(up);
    }
    if (url.pathname.startsWith('/storage/v1/')) return await storage(req, res, url);
    if (url.pathname.startsWith('/functions/v1/')) return await functions(req, res, url);
    let f = path.join(DIST, decodeURIComponent(url.pathname));
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  } catch (e) { sendJson(res, 500, { error: String(e) }); }
}).listen(PORT, '127.0.0.1', () => console.log('dev gateway on', PORT, 'functions:', Object.keys(handlers).join(', ')));
