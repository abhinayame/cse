/**
 * Client for the `ai-assist` Edge Function (Claude Opus 5.5 — see supabase/functions/_shared/ai.ts).
 * In demo mode (no Supabase configured) a simple extractive fallback runs locally so the
 * workflow can be tried end-to-end; it is clearly labelled in the UI.
 */
import { supabase } from './supabase';

export interface Card { headline: string; summary: string }
export interface Moderation { flags: string[]; risk: 'low' | 'medium' | 'high'; note: string; suggested?: Card }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase!.functions.invoke('ai-assist', { body });
  if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error ?? error.message);
  return data as T;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const sentences = (s: string) => s.replace(/\s+/g, ' ').match(/[^.!?।]+[.!?।]+/g) ?? [s];

export const ai = {
  live: !!supabase,
  async summarize(article: string, lang: string): Promise<Card & { wordCount: number }> {
    if (supabase) return call({ task: 'summarize', article, lang });
    // demo: lead sentences up to ~70 words
    const out: string[] = [];
    for (const s of sentences(article)) { if (words(out.join(' ')).length + words(s).length > 78) break; out.push(s.trim()); }
    const summary = out.join(' ') || words(article).slice(0, 70).join(' ');
    const headline = words(sentences(article)[0]).slice(0, 12).join(' ').replace(/[.,;:]$/, '');
    return { headline, summary, wordCount: words(summary).length };
  },
  async translate(card: Card, from: string, to: string[]): Promise<Record<string, Card>> {
    if (supabase) return call({ task: 'translate', card, from, to });
    return Object.fromEntries(to.map((l) => [l, { headline: `[${l}] ${card.headline}`, summary: `[${l} — connect Supabase + ANTHROPIC_API_KEY for real translation] ${card.summary}` }]));
  },
  async headlines(card: Card, lang: string): Promise<string[]> {
    if (supabase) return (await call<{ options: string[] }>({ task: 'headlines', card, lang })).options;
    const num = card.summary.match(/₹?\d[\d,]{1,}(\.\d+)?\s?(lakh|crore|km|%|tonnes)?/)?.[0];
    const base = card.headline.replace(/:.*/, '').trim();
    return [base, num ? `${num.trim()}: ${base}` : `${base} — what you need to know`, `What it means for you: ${base}`, `Local update: ${base}`];
  },
  async moderate(report: { headline: string; body: string; lang: string }): Promise<Moderation> {
    if (supabase) return call({ task: 'moderate', report });
    const flags: string[] = [];
    if (/!!|SHOCKING|share before|forward this/i.test(report.headline + report.body)) flags.push('clickbait');
    if (words(report.body).length < 25) flags.push('too short / unverifiable');
    if (/\b\d{10}\b/.test(report.body)) flags.push('personal data');
    return { flags, risk: flags.length > 1 ? 'high' : flags.length ? 'medium' : 'low', note: flags.length ? 'Needs verification before publishing.' : 'Looks like genuine local news.' };
  },
};
