/**
 * Automated intake (migrations/0008_content.sql §4): approved RSS/Atom feeds → short summarised cards on
 * the editorial desk. Pure TypeScript with injected Supabase client / fetch / summariser so it runs under
 * Deno (Edge Function) and Node (tests). Nothing is published from here except via intake_enqueue's
 * "official source, not sensitive, not a duplicate" rule; everything else waits for an editor.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface FeedItem { guid: string; title: string; link: string | null; published: Date | null; text: string }
export interface Source { id: string; name: string; kind: 'rss' | 'atom'; url: string; language: string; district_id: string }
export type Summariser = (article: string, lang: string) => Promise<{ headline: string; summary: string }>;

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const strip = (html: string) => decode(decode(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : null;
};
const attr = (block: string, name: string, a: string) => block.match(new RegExp(`<${name}\\b[^>]*\\b${a}="([^"]+)"`, 'i'))?.[1] ?? null;

/** Minimal RSS 2.0 / Atom parser — enough for government and agency feeds, no dependencies. */
export function parseFeed(xml: string): FeedItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return blocks.map((b) => {
    const title = strip(tag(b, 'title') ?? '');
    const link = (tag(b, 'link') && !/<link\b[^>]*href=/i.test(b) ? strip(tag(b, 'link')!) : attr(b, 'link', 'href')) || null;
    const guid = strip(tag(b, 'guid') ?? tag(b, 'id') ?? '') || link || title;
    const date = tag(b, 'pubDate') ?? tag(b, 'published') ?? tag(b, 'updated') ?? tag(b, 'dc:date');
    const body = tag(b, 'content:encoded') ?? tag(b, 'content') ?? tag(b, 'description') ?? tag(b, 'summary') ?? '';
    const d = date ? new Date(strip(date)) : null;
    return { guid, title, link, published: d && !isNaN(d.getTime()) ? d : null, text: strip(body) };
  }).filter((i) => i.title.length >= 8);
}

/** Without an AI key: keep the item's own opening sentences (≈70 words). */
export function extractiveSummary(text: string, maxWords = 70) {
  const sentences = text.match(/[^.!?।]+[.!?।]+/g) ?? [text];
  const out: string[] = [];
  for (const s of sentences) { if ((out.join(' ') + ' ' + s).trim().split(/\s+/).length > maxWords) break; out.push(s.trim()); }
  return (out.join(' ') || text.split(/\s+/).slice(0, maxWords).join(' ')).trim();
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

/** The "Chatimpu Desk" system account that owns intake cards (created once, id kept in app_settings). */
export async function ensureDeskUser(db: SupabaseClient): Promise<string> {
  const s = check(await db.from('app_settings').select('value').eq('key', 'intake_desk_user_id').maybeSingle()) as { value: string } | null;
  if (s?.value) return String(s.value).replace(/^"+|"+$/g, '');
  const created = await db.auth.admin.createUser({ email: `desk+${crypto.randomUUID().slice(0, 8)}@chatimpu.invalid`, email_confirm: true, user_metadata: { system: 'intake' } });
  if (created.error) throw new Error(created.error.message);
  const id = created.data.user!.id;
  check(await db.from('profiles').update({ display_name: 'Chatimpu Desk' }).eq('id', id));
  check(await db.from('app_settings').upsert({ key: 'intake_desk_user_id', value: id }));
  return id;
}

export const editionNow = (d = new Date()) => {
  const h = new Date(d.getTime() + 5.5 * 3600e3).getUTCHours();
  return h < 12 ? 'morning' : 'evening';
};

export interface RunOptions { fetchImpl?: typeof fetch; summarise?: Summariser | null; edition?: 'morning' | 'evening' | 'manual'; startedBy?: string | null; now?: Date }

export async function runIntake(db: SupabaseClient, opts: RunOptions = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? new Date();
  const settings = Object.fromEntries((check(await db.from('app_settings').select('key, value').in('key', ['intake_enabled', 'intake_max_per_run', 'intake_max_age_hours'])) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
  if (settings.intake_enabled === false || settings.intake_enabled === 'false') return { skipped: 'intake disabled' };
  const maxPerRun = Number(settings.intake_max_per_run ?? 60);
  const maxAge = Number(settings.intake_max_age_hours ?? 18) * 3600e3;
  const desk = await ensureDeskUser(db);
  const run = check(await db.from('intake_runs').insert({ edition: opts.edition ?? editionNow(now), started_by: opts.startedBy ?? null }).select('id').single()) as { id: string };
  const sources = check(await db.from('news_sources').select('id, name, kind, url, language, district_id').eq('active', true).order('created_at')) as Source[];
  const stats = { fetched: 0, queued: 0, published: 0, duplicates: 0, errors: 0, old: 0, seen: 0 };
  const perSource: Record<string, unknown> = {};

  for (const src of sources) {
    if (stats.queued + stats.published >= maxPerRun) break;
    let items: FeedItem[] = [];
    try {
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 15000);
      const res = await fetchImpl(src.url, { signal: ctl.signal, headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': 'ChatimpuIntake/1.0' } });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = (await res.text()).slice(0, 2_000_000);
      items = parseFeed(xml);
      await db.from('news_sources').update({ last_fetched_at: now.toISOString(), last_error: null }).eq('id', src.id);
    } catch (e) {
      stats.errors++; perSource[src.name] = { error: (e as Error).message };
      await db.from('news_sources').update({ last_fetched_at: now.toISOString(), last_error: (e as Error).message.slice(0, 300) }).eq('id', src.id);
      continue;
    }
    stats.fetched += items.length;
    let added = 0;
    for (const it of items) {
      if (stats.queued + stats.published >= maxPerRun) break;
      if (it.published && now.getTime() - it.published.getTime() > maxAge) { stats.old++; continue; }
      const fingerprint = await sha256(`${src.id}|${it.guid || it.link || it.title}`);
      let headline = it.title, summary = extractiveSummary(it.text || it.title), machine = false;
      if (opts.summarise && it.text.split(/\s+/).length > 40) {
        try { const c = await opts.summarise(`${it.title}\n\n${it.text}`, src.language); headline = c.headline || headline; summary = c.summary || summary; machine = true; } catch { /* keep extractive */ }
      }
      let r: { status: string };
      try {
        r = check(await db.rpc('intake_enqueue', {
          p_source: src.id, p_desk: desk, p_fingerprint: fingerprint, p_title: headline, p_summary: summary, p_lang: src.language,
          p_link: it.link, p_published_at: it.published?.toISOString() ?? null, p_run: run.id, p_machine: machine,
        })) as { status: string };
      } catch (e) { // one bad item never stops the run
        stats.errors++; perSource[`${src.name} · ${it.title.slice(0, 40)}`] = { error: (e as Error).message }; continue;
      }
      if (r.status === 'seen') stats.seen++;
      else if (r.status === 'duplicate') stats.duplicates++;
      else if (r.status === 'published') { stats.published++; added++; }
      else { stats.queued++; added++; }
    }
    perSource[src.name] = { items: items.length, added };
    if (added) await db.rpc('intake_bump_source', { p_id: src.id, p_n: added });
  }
  check(await db.from('intake_runs').update({ finished_at: new Date().toISOString(), fetched: stats.fetched, queued: stats.queued, published: stats.published,
    duplicates: stats.duplicates, errors: stats.errors, details: { ...stats, sources: perSource } }).eq('id', run.id));
  return { run: run.id, ...stats, sources: perSource };
}
